// ==============================================================================
// AssetVault: Account Protection & Brute-Force Defense Service
// Course: BCSE307L Database Systems (Fall 2026-27)
// Enforces:
// 1. Lockout keyed on (email + IP) to prevent Denial of Service on targeted accounts
// 2. Exponential backoff lockout duration (15m, 30m, 60m, 120m...)
// 3. Persistent state stored in PostgreSQL (failed_login_attempts) surviving restarts
// ==============================================================================

import { prisma } from '../config/prisma';
import { TooManyRequestsError } from '../errors/AppError';
import { logger } from '../config/logger';

export const WINDOW_MS = 15 * 60 * 1000; // 15 minutes sliding window
export const MAX_ATTEMPTS = 5; // 5 failed attempts before lockout triggers
export const BASE_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes base backoff
export const MAX_LOCKOUT_MS = 24 * 60 * 60 * 1000; // 24 hours max backoff

export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

export function normalizeIp(ip?: string): string {
  if (!ip) return '127.0.0.1';
  // Strip IPv6-mapped IPv4 prefix (e.g., ::ffff:127.0.0.1 -> 127.0.0.1)
  if (ip.startsWith('::ffff:')) {
    return ip.substring(7);
  }
  if (ip === '::1') {
    return '127.0.0.1';
  }
  return ip.trim();
}

export function getLockoutKey(email: string, ip?: string): string {
  return `${normalizeEmail(email)}#${normalizeIp(ip)}`;
}

export function calculateExponentialBackoff(attemptCount: number): number {
  const exponent = Math.max(0, attemptCount - MAX_ATTEMPTS);
  return Math.min(BASE_LOCKOUT_MS * Math.pow(2, exponent), MAX_LOCKOUT_MS);
}

// In-memory sliding window cache for fallback
export interface AttemptRecord {
  count: number;
  firstAttemptAt: number;
  lockedUntil?: number;
}
export const memoryFallbackMap = new Map<string, AttemptRecord>();

/**
 * Periodic cleanup function to remove expired attempts from memoryFallbackMap.
 * Deletes entries whose firstAttemptAt is older than WINDOW_MS and whose lockedUntil (if any) has passed.
 */
export function cleanupMemoryFallback(now: number = Date.now()): number {
  let cleanedCount = 0;
  for (const [key, record] of memoryFallbackMap.entries()) {
    const isFirstAttemptOld = now - record.firstAttemptAt > WINDOW_MS;
    const isLockoutPassed = !record.lockedUntil || now >= record.lockedUntil;
    if (isFirstAttemptOld && isLockoutPassed) {
      memoryFallbackMap.delete(key);
      cleanedCount++;
    }
  }
  return cleanedCount;
}

// Periodic cleanup timer every WINDOW_MS to prevent memory leakage
export const memoryCleanupInterval: NodeJS.Timeout = setInterval(() => {
  cleanupMemoryFallback();
}, WINDOW_MS);
memoryCleanupInterval.unref?.();

/**
 * Checks if the specific (email + IP) key is currently locked out.
 * Throws TooManyRequestsError (429) if locked.
 */
export const checkAccountLockout = async (email: string, ip?: string): Promise<void> => {
  const key = getLockoutKey(email, ip);
  const now = Date.now();

  try {
    const rows: any = await prisma.$queryRaw`
      SELECT key, email, ip_address, count, first_attempt_at, last_attempt_at, locked_until
      FROM failed_login_attempts
      WHERE key = ${key}
      LIMIT 1;
    `;

    if (rows && rows.length > 0) {
      const record = rows[0];

      // 1. Check if explicitly locked until a future timestamp
      if (record.locked_until) {
        const lockedUntilMs = new Date(record.locked_until).getTime();
        if (now < lockedUntilMs) {
          const remainingMinutes = Math.ceil((lockedUntilMs - now) / 60000);
          logger.warn({ key, email, ip, remainingMinutes }, 'Blocked login attempt on temporarily locked account/IP');
          throw new TooManyRequestsError(
            `Too many failed login attempts for this account from this IP. Account locked for ${remainingMinutes} more minute(s).`
          );
        }
      }

      // 2. Check if active window exceeded maximum attempts without explicit lockout timestamp
      const firstAttemptMs = new Date(record.first_attempt_at).getTime();
      if (now - firstAttemptMs <= WINDOW_MS && record.count >= MAX_ATTEMPTS) {
        const backoffMs = calculateExponentialBackoff(record.count);
        const lockedUntil = new Date(now + backoffMs);

        await prisma.$executeRaw`
          UPDATE failed_login_attempts
          SET locked_until = ${lockedUntil}
          WHERE key = ${key};
        `;

        const remainingMinutes = Math.ceil(backoffMs / 60000);
        logger.warn({ key, email, ip, count: record.count, remainingMinutes }, 'Account locked due to consecutive failed attempts');
        throw new TooManyRequestsError(
          `Too many failed login attempts for this account from this IP. Account locked for ${remainingMinutes} minute(s).`
        );
      }
    }
  } catch (err: any) {
    if (err instanceof TooManyRequestsError) {
      throw err;
    }
    // Fallback to in-memory check
    logger.warn({ err: err.message, key }, 'Database check failed in accountProtection, falling back to in-memory check');
    const memRecord = memoryFallbackMap.get(key);
    if (memRecord) {
      if (memRecord.lockedUntil && now < memRecord.lockedUntil) {
        const remainingMinutes = Math.ceil((memRecord.lockedUntil - now) / 60000);
        throw new TooManyRequestsError(
          `Too many failed login attempts for this account from this IP. Account locked for ${remainingMinutes} more minute(s).`
        );
      }
      if (now - memRecord.firstAttemptAt <= WINDOW_MS && memRecord.count >= MAX_ATTEMPTS) {
        const backoffMs = calculateExponentialBackoff(memRecord.count);
        memRecord.lockedUntil = now + backoffMs;
        const remainingMinutes = Math.ceil(backoffMs / 60000);
        throw new TooManyRequestsError(
          `Too many failed login attempts for this account from this IP. Account locked for ${remainingMinutes} minute(s).`
        );
      }
    }
  }
};

/**
 * Backward compatibility alias for checkAccountLockout
 */
export const checkEmailLockout = async (email: string, ip?: string): Promise<void> => {
  return checkAccountLockout(email, ip);
};

/**
 * Records a failed authentication attempt for (email + IP) with exponential backoff.
 * Persists atomically into PostgreSQL failed_login_attempts table.
 */
export const recordFailedLogin = async (email: string, ip?: string): Promise<void> => {
  const key = getLockoutKey(email, ip);
  const normalizedEmail = normalizeEmail(email);
  const normalizedIp = normalizeIp(ip);
  const now = new Date();
  const nowMs = now.getTime();

  // Also update memory fallback
  const memRecord = memoryFallbackMap.get(key);
  if (!memRecord || nowMs - memRecord.firstAttemptAt > WINDOW_MS) {
    memoryFallbackMap.set(key, { count: 1, firstAttemptAt: nowMs });
  } else {
    memRecord.count += 1;
    if (memRecord.count >= MAX_ATTEMPTS) {
      const backoffMs = calculateExponentialBackoff(memRecord.count);
      memRecord.lockedUntil = nowMs + backoffMs;
    }
  }

  try {
    await prisma.$executeRaw`
      INSERT INTO failed_login_attempts (key, email, ip_address, count, first_attempt_at, last_attempt_at, locked_until)
      VALUES (${key}, ${normalizedEmail}, ${normalizedIp}, 1, ${now}, ${now}, NULL)
      ON CONFLICT (key) DO UPDATE SET
        first_attempt_at = CASE
          WHEN (failed_login_attempts.last_attempt_at < ${now}::timestamptz - INTERVAL '1 millisecond' * ${WINDOW_MS})
               AND (failed_login_attempts.locked_until IS NULL OR failed_login_attempts.locked_until < ${now})
          THEN ${now}
          ELSE failed_login_attempts.first_attempt_at
        END,
        count = CASE
          WHEN (failed_login_attempts.last_attempt_at < ${now}::timestamptz - INTERVAL '1 millisecond' * ${WINDOW_MS})
               AND (failed_login_attempts.locked_until IS NULL OR failed_login_attempts.locked_until < ${now})
          THEN 1
          ELSE failed_login_attempts.count + 1
        END,
        last_attempt_at = ${now},
        locked_until = CASE
          WHEN (
            CASE
              WHEN (failed_login_attempts.last_attempt_at < ${now}::timestamptz - INTERVAL '1 millisecond' * ${WINDOW_MS})
                   AND (failed_login_attempts.locked_until IS NULL OR failed_login_attempts.locked_until < ${now})
              THEN 1
              ELSE failed_login_attempts.count + 1
            END
          ) >= ${MAX_ATTEMPTS}
          THEN ${now}::timestamptz + INTERVAL '1 millisecond' * LEAST(${MAX_LOCKOUT_MS}, ${BASE_LOCKOUT_MS} * (2 ^ GREATEST(0, failed_login_attempts.count + 1 - ${MAX_ATTEMPTS})))
          ELSE NULL
        END;
    `;
  } catch (err: any) {
    logger.warn({ err: err.message, key }, 'Failed to persist failed login to database, in-memory updated');
  }
};

/**
 * Resets failed login counters for (email + IP) upon successful authentication.
 */
export const resetFailedLogins = async (email: string, ip?: string): Promise<void> => {
  const key = getLockoutKey(email, ip);
  memoryFallbackMap.delete(key);

  try {
    await prisma.$executeRaw`
      DELETE FROM failed_login_attempts
      WHERE key = ${key};
    `;
  } catch (err: any) {
    logger.warn({ err: err.message, key }, 'Failed to clear failed login attempts from database');
  }
};
