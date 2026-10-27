import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { prisma } from '../config/prisma';
import {
  recordFailedLogin,
  resetFailedLogins,
  calculateExponentialBackoff,
  getLockoutKey,
  BASE_LOCKOUT_MS,
  MAX_LOCKOUT_MS,
  WINDOW_MS,
  memoryFallbackMap,
  cleanupMemoryFallback,
} from '../services/accountProtection.service';
import { createUserSchema, resetPasswordSchema } from '../validators/user.validator';

describe('Authentication Hardening & Account Protection Suite', () => {
  let tenantAdminToken: string;

  beforeAll(async () => {
    // Authenticate as TechCorp Admin to get token for user management tests
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'techcorp.admin@techcorp.io', password: 'Password123!' });
    expect(loginRes.status).toBe(200);
    tenantAdminToken = loginRes.body.data.accessToken;
  });

  describe('1. Constant-Time Dummy BCrypt Compare on Missing User', () => {
    it('executes full bcrypt comparison when user does not exist to prevent timing attacks', async () => {
      const nonExistentEmail = `ghost.${Date.now()}@nowhere.io`;

      const start = Date.now();
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: nonExistentEmail, password: 'RandomPassword123!' });
      const durationMs = Date.now() - start;

      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Invalid email or password');
      // In bcrypt cost 12, comparison takes substantial time (not instant < 10ms exit)
      expect(durationMs).toBeGreaterThanOrEqual(15);
    });

    it('returns identical generic error for existing user with wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'techcorp.admin@techcorp.io', password: 'IncorrectPassword123!' });

      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Invalid email or password');
    });
  });

  describe('2. (Email + IP) Lockout with Exponential Backoff & DB Persistence', () => {
    const victimEmail = `lockout.test.${Date.now()}@techcorp.io`;
    const attackerIp = '198.51.100.55';
    const legitimateIp = '203.0.113.88';

    it('locks out attacker IP after 5 failed attempts without locking out legitimate user IP', async () => {
      // Attacker attempts 5 failed logins from attackerIp
      for (let i = 1; i <= 5; i++) {
        const res = await request(app)
          .post('/api/auth/login')
          .set('X-Forwarded-For', attackerIp)
          .send({ email: victimEmail, password: 'WrongPassword!' });
        expect(res.status).toBe(401);
      }

      // 6th attempt from attackerIp must be locked out (HTTP 429)
      const lockedRes = await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', attackerIp)
        .send({ email: victimEmail, password: 'WrongPassword!' });

      expect(lockedRes.status).toBe(429);
      expect(lockedRes.body.error.code).toBe('TOO_MANY_REQUESTS');
      expect(lockedRes.body.error.message).toContain('Too many failed login attempts');

      // Crucial: Legitimate user from a DIFFERENT IP is NOT locked out!
      const legitRes = await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', legitimateIp)
        .send({ email: victimEmail, password: 'WrongPassword!' });

      // Legitimate user gets standard 401 (not locked out with 429!)
      expect(legitRes.status).toBe(401);
    });

    it('calculates exponential backoff progression accurately', () => {
      // 5th attempt: base backoff (15 minutes)
      expect(calculateExponentialBackoff(5)).toBe(BASE_LOCKOUT_MS); // 15m
      // 6th attempt: 2^1 * 15m = 30 minutes
      expect(calculateExponentialBackoff(6)).toBe(BASE_LOCKOUT_MS * 2); // 30m
      // 7th attempt: 2^2 * 15m = 60 minutes
      expect(calculateExponentialBackoff(7)).toBe(BASE_LOCKOUT_MS * 4); // 60m
      // 8th attempt: 2^3 * 15m = 120 minutes
      expect(calculateExponentialBackoff(8)).toBe(BASE_LOCKOUT_MS * 8); // 120m

      // Caps at MAX_LOCKOUT_MS
      expect(calculateExponentialBackoff(25)).toBe(MAX_LOCKOUT_MS);
    });

    it('persists failed attempts and lockouts in the DB to survive restarts', async () => {
      const testEmail = `survive.reboot.${Date.now()}@techcorp.io`;
      const testIp = '10.0.0.99';
      const key = getLockoutKey(testEmail, testIp);

      // Record 3 failed logins
      await recordFailedLogin(testEmail, testIp);
      await recordFailedLogin(testEmail, testIp);
      await recordFailedLogin(testEmail, testIp);

      // Verify row exists in PostgreSQL failed_login_attempts table
      const rows: any = await prisma.$queryRaw`
        SELECT key, count, email, ip_address
        FROM failed_login_attempts
        WHERE key = ${key};
      `;
      expect(rows.length).toBe(1);
      expect(rows[0].count).toBe(3);
      expect(rows[0].email).toBe(testEmail.toLowerCase());
      expect(rows[0].ip_address).toBe(testIp);

      // Reset
      await resetFailedLogins(testEmail, testIp);
      const remaining: any = await prisma.$queryRaw`
        SELECT key FROM failed_login_attempts WHERE key = ${key};
      `;
      expect(remaining.length).toBe(0);
    });
  });

  describe('3. Looser Rate Limiting on /auth/refresh', () => {
    it('permits rapid consecutive refresh requests without triggering 429', async () => {
      // Get initial valid refresh token
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'techcorp.mgr1@techcorp.io', password: 'Password123!' });
      expect(loginRes.status).toBe(200);

      const cookie = loginRes.headers['set-cookie'] as any;
      expect(cookie).toBeDefined();

      // Fire 5 rapid refresh requests
      for (let i = 0; i < 5; i++) {
        const refreshRes = await request(app)
          .post('/api/auth/refresh')
          .set('Cookie', cookie);

        // May be 200 or 401 if rotated, but must NEVER be blocked by 429 rate limiter
        expect(refreshRes.status).not.toBe(429);
      }
    });
  });

  describe('4. Reuse of Strong passwordSchema in user.validator.ts', () => {
    it('rejects createUser with weak passwords', () => {
      // 1. Too short (< 10 chars)
      const shortRes = createUserSchema.safeParse({
        email: 'user1@example.com',
        fullName: 'Test User',
        password: 'Pass1!',
        roleName: 'MEMBER',
      });
      expect(shortRes.success).toBe(false);
      expect(shortRes.error?.issues[0]?.message).toContain('at least 10 characters');

      // 2. Missing uppercase
      const noUpperRes = createUserSchema.safeParse({
        email: 'user1@example.com',
        fullName: 'Test User',
        password: 'password123!',
        roleName: 'MEMBER',
      });
      expect(noUpperRes.success).toBe(false);
      expect(noUpperRes.error?.issues[0]?.message).toContain('uppercase letter');

      // 3. Missing symbol
      const noSymbolRes = createUserSchema.safeParse({
        email: 'user1@example.com',
        fullName: 'Test User',
        password: 'Password1234',
        roleName: 'MEMBER',
      });
      expect(noSymbolRes.success).toBe(false);
      expect(noSymbolRes.error?.issues[0]?.message).toContain('special symbol');
    });

    it('accepts createUser with strong password meeting passwordSchema', () => {
      const validRes = createUserSchema.safeParse({
        email: 'user1@example.com',
        fullName: 'Test User',
        password: 'StrongPassword123!',
        roleName: 'MEMBER',
      });
      expect(validRes.success).toBe(true);
    });

    it('rejects resetPassword with weak passwords', () => {
      const weakReset = resetPasswordSchema.safeParse({
        newPassword: 'weak',
      });
      expect(weakReset.success).toBe(false);
      expect(weakReset.error?.issues[0]?.message).toContain('at least 10 characters');
    });

    it('accepts resetPassword with strong password meeting passwordSchema', () => {
      const validReset = resetPasswordSchema.safeParse({
        newPassword: 'NewStrongPassword123!',
      });
      expect(validReset.success).toBe(true);
    });

    it('enforces passwordSchema via POST /api/users endpoint', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${tenantAdminToken}`)
        .send({
          email: `new.weak.${Date.now()}@techcorp.io`,
          fullName: 'Weak Password User',
          password: 'weak',
          roleName: 'MEMBER',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('5. Memory Fallback Periodic Cleanup', () => {
    it('deletes entries whose firstAttemptAt is older than WINDOW_MS and whose lockout has passed', () => {
      const now = Date.now();

      // Case 1: Expired window, no lockout -> SHOULD BE DELETED
      memoryFallbackMap.set('user1#1.1.1.1', {
        count: 2,
        firstAttemptAt: now - WINDOW_MS - 1000,
      });

      // Case 2: Expired window, lockout passed -> SHOULD BE DELETED
      memoryFallbackMap.set('user2#1.1.1.2', {
        count: 5,
        firstAttemptAt: now - WINDOW_MS - 5000,
        lockedUntil: now - 1000,
      });

      // Case 3: Expired window, but lockout still active -> SHOULD BE PRESERVED
      memoryFallbackMap.set('user3#1.1.1.3', {
        count: 5,
        firstAttemptAt: now - WINDOW_MS - 5000,
        lockedUntil: now + 60000,
      });

      // Case 4: Recent attempt within WINDOW_MS -> SHOULD BE PRESERVED
      memoryFallbackMap.set('user4#1.1.1.4', {
        count: 1,
        firstAttemptAt: now - 1000,
      });

      const deletedCount = cleanupMemoryFallback(now);
      expect(deletedCount).toBeGreaterThanOrEqual(2);

      expect(memoryFallbackMap.has('user1#1.1.1.1')).toBe(false);
      expect(memoryFallbackMap.has('user2#1.1.1.2')).toBe(false);
      expect(memoryFallbackMap.has('user3#1.1.1.3')).toBe(true);
      expect(memoryFallbackMap.has('user4#1.1.1.4')).toBe(true);

      // Cleanup
      memoryFallbackMap.delete('user3#1.1.1.3');
      memoryFallbackMap.delete('user4#1.1.1.4');
    });
  });
});
