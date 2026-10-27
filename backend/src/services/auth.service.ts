// ==============================================================================
// AssetVault: Authentication & Session Service
// Course: BCSE307L Database Systems (Fall 2026-27)
// Enforces BCrypt (cost 12), token rotation with reuse detection, and atomic tenant onboarding
// ==============================================================================

import { prisma, prismaForRequest } from '../config/prisma';
import { Prisma } from '@prisma/client';
import { hashPassword, comparePassword, hashToken } from '../utils/hash.util';

const systemPrisma = prismaForRequest({ isSuperAdmin: true });
// Pre-computed BCrypt cost factor 12 hash for constant-time comparison when user or passwordHash is missing
const DUMMY_BCRYPT_HASH = '$2a$12$D021KNk/cBAisMwChHfu/.oyT8l/ILtBOJFzVmoY9Vqi4TaICrXPa';

import {
  generateAccessToken,
  generateRefreshTokenData,
} from '../utils/token.util';
import { checkAccountLockout, recordFailedLogin, resetFailedLogins } from './accountProtection.service';
import {
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  NotFoundError,
  BadRequestError,
} from '../errors/AppError';
import { RoleName, getPermissionsForRole, getMenuItemsForRole, MenuItem } from '../config/permissions';
import { LoginInput, RegisterTenantInput } from '../validators/auth.validator';
import { logger } from '../config/logger';
import { env } from '../config/env';

export interface AuthSuccessResult {
  accessToken: string;
  rawRefreshToken: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    tenantId: string | null;
    role: RoleName;
    isSuperAdmin: boolean;
    permissions: string[];
    tenant?: {
      id: string;
      name: string;
      slug: string;
      status: string;
      plan?: {
        name: string;
        maxUsers: number;
        maxAssets: number;
      } | null;
    } | null;
  };
}

export class AuthService {
  /**
   * 1. Email + Password Login
   * - Strict generic error message (no account enumeration)
   * - Constant-time execution via dummy bcrypt comparison when user is missing
   * - Rejects inactive accounts and suspended tenants
   * - Account lockout per (email + IP) with exponential backoff surviving restarts
   */
  public async login(
    input: LoginInput,
    metadata: { userAgent?: string; ipAddress?: string } = {}
  ): Promise<AuthSuccessResult> {
    const normalizedEmail = input.email.toLowerCase().trim();
    const clientIp = metadata.ipAddress || '127.0.0.1';

    // 1. Check account lockout state for (email + IP)
    await checkAccountLockout(normalizedEmail, clientIp);

    // 2. Query user from database
    const user = await systemPrisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        role: true,
        tenant: {
          include: { plan: true },
        },
      },
    });

    // 3. Generic failure if user not found or no password set (OAuth-only account)
    if (!user || !user.passwordHash) {
      // Always run dummy bcrypt compare so timing is constant regardless of user existence
      await comparePassword(input.password, DUMMY_BCRYPT_HASH);
      await recordFailedLogin(normalizedEmail, clientIp);
      logger.warn({ email: normalizedEmail, ip: clientIp }, 'Authentication failed: User not found or no password hash');
      throw new UnauthorizedError('Invalid email or password');
    }

    // 4. Verify password with BCrypt
    const isPasswordValid = await comparePassword(input.password, user.passwordHash);
    if (!isPasswordValid) {
      await recordFailedLogin(normalizedEmail, clientIp);
      logger.warn({ email: normalizedEmail, ip: clientIp }, 'Authentication failed: Password mismatch');
      throw new UnauthorizedError('Invalid email or password');
    }

    // 5. Account state checks
    if (!user.isActive) {
      logger.warn({ userId: user.id }, 'Authentication rejected: Inactive account');
      throw new UnauthorizedError('Account is inactive. Please contact your organization administrator.');
    }

    if (user.tenant && user.tenant.status === 'SUSPENDED') {
      logger.warn({ tenantId: user.tenant.id }, 'Authentication rejected: Suspended tenant');
      throw new ForbiddenError('Organization account is suspended. Please contact platform support.');
    }

    // 6. Reset failed attempts upon successful login for this (email + IP)
    await resetFailedLogins(normalizedEmail, clientIp);

    // 7. Generate tokens and session records
    const roleName = user.role.name as RoleName;
    const isSuperAdmin = roleName === 'SUPER_ADMIN';

    const accessToken = generateAccessToken({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      tenantId: user.tenantId,
      roleId: user.roleId,
      role: roleName,
      isSuperAdmin,
    });

    const refreshData = generateRefreshTokenData();

    await systemPrisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshData.tokenHash,
        expiresAt: refreshData.expiresAt,
        userAgent: metadata.userAgent,
        ipAddress: metadata.ipAddress,
      },
    });

    await systemPrisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      accessToken,
      rawRefreshToken: refreshData.rawToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        tenantId: user.tenantId,
        role: roleName,
        isSuperAdmin,
        permissions: getPermissionsForRole(roleName),
        tenant: user.tenant,
      },
    };
  }

  /**
   * 2. Tenant Self-Registration (Atomic Transaction)
   * Creates Tenant on Free Plan, its first TENANT_ADMIN user, and Audit record
   */
  public async registerTenant(
    input: RegisterTenantInput,
    metadata: { userAgent?: string; ipAddress?: string } = {}
  ): Promise<AuthSuccessResult> {
    const normalizedEmail = input.adminEmail.toLowerCase().trim();
    const normalizedSlug = input.slug.toLowerCase().trim();

    // 1. Conflict checks
    const existingTenant = await systemPrisma.tenant.findUnique({
      where: { slug: normalizedSlug },
    });
    if (existingTenant) {
      throw new ConflictError('Tenant slug is already taken. Please choose another unique organization handle.');
    }

    const existingUser = await systemPrisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      throw new ConflictError('An account with this email address already exists.');
    }

    // 2. Fetch lookup records
    const freePlan = await systemPrisma.plan.findFirst({
      where: { name: 'Free Trial' },
    });
    if (!freePlan) {
      throw new BadRequestError('Default subscription plan (Free Trial) is not configured.');
    }

    const tenantAdminRole = await systemPrisma.role.findUnique({
      where: { name: 'TENANT_ADMIN' },
    });
    if (!tenantAdminRole) {
      throw new BadRequestError('TENANT_ADMIN role is not configured.');
    }

    // 3. Hash password with BCrypt (cost 12)
    const passwordHash = await hashPassword(input.password);

    // 4. Atomic transaction across Tenant, User, and AuditLog
    const { tenant, user } = await prisma.$transaction(async (tx: any) => {
      // Configure RLS admin override for onboarding transaction
      await tx.$executeRaw((Prisma as any).sql`SELECT set_config('app.is_super_admin', 'true', true);`);

      const createdTenant = await tx.tenant.create({
        data: {
          name: input.tenantName.trim(),
          slug: normalizedSlug,
          contactEmail: input.contactEmail.toLowerCase().trim(),
          planId: freePlan.id,
          status: 'TRIAL',
        },
        include: { plan: true },
      });

      const createdUser = await tx.user.create({
        data: {
          tenantId: createdTenant.id,
          roleId: tenantAdminRole.id,
          email: normalizedEmail,
          fullName: input.adminFullName.trim(),
          passwordHash,
          isActive: true,
          // Registration issues a session immediately, so record the initial login too.
          lastLoginAt: new Date(),
        },
        include: { role: true },
      });

      // Record tenant onboarding event in audit log
      await tx.auditLog.create({
        data: {
          tenantId: createdTenant.id,
          userId: createdUser.id,
          tableName: 'tenants',
          recordId: createdTenant.id,
          action: 'INSERT',
          newData: {
            event: 'TENANT_ONBOARDED',
            tenantName: createdTenant.name,
            slug: createdTenant.slug,
            plan: 'Free Trial',
            adminEmail: createdUser.email,
            ipAddress: metadata.ipAddress || null,
            userAgent: metadata.userAgent || null,
          },
        },
      });

      return { tenant: createdTenant, user: createdUser };
    });

    // 5. Issue session tokens
    const roleName = user.role.name as RoleName;
    const accessToken = generateAccessToken({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      tenantId: user.tenantId,
      roleId: user.roleId,
      role: roleName,
      isSuperAdmin: false,
    });

    const refreshData = generateRefreshTokenData();

    await systemPrisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshData.tokenHash,
        expiresAt: refreshData.expiresAt,
        userAgent: metadata.userAgent,
        ipAddress: metadata.ipAddress,
      },
    });

    return {
      accessToken,
      rawRefreshToken: refreshData.rawToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        tenantId: user.tenantId,
        role: roleName,
        isSuperAdmin: false,
        permissions: getPermissionsForRole(roleName),
        tenant,
      },
    };
  }

  /**
   * 3. Refresh Token Rotation with Reuse Detection
   */
  public async refresh(
    rawRefreshToken: string,
    metadata: { userAgent?: string; ipAddress?: string } = {}
  ): Promise<{ accessToken: string; newRawRefreshToken?: string }> {
    if (!rawRefreshToken) {
      throw new UnauthorizedError('Refresh token must be provided');
    }

    const tokenHash = hashToken(rawRefreshToken);
    const now = new Date();
    const GRACE_PERIOD_MS = env.REFRESH_TOKEN_GRACE_WINDOW_MS;

    const storedToken = await systemPrisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            role: true,
            tenant: { include: { plan: true } },
          },
        },
      },
    });

    if (!storedToken || !storedToken.user) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const user = storedToken.user;
    if (!user.isActive) {
      throw new UnauthorizedError('User account has been deactivated.');
    }

    if (user.tenant && user.tenant.status === 'SUSPENDED') {
      throw new ForbiddenError('Organization account is suspended.');
    }

    // 1. Reuse Detection with Grace Window for the immediately previous token
    if (storedToken.revokedAt !== null && storedToken.revokedAt !== undefined) {
      const revokedAtDate = new Date(storedToken.revokedAt);
      const elapsedSinceRevocation = now.getTime() - revokedAtDate.getTime();

      // Check if this token was recently rotated and replaced by an active successor token
      const successorToken = await systemPrisma.refreshToken.findFirst({
        where: {
          userId: storedToken.userId,
          id: { not: storedToken.id },
          createdAt: { gte: new Date(revokedAtDate.getTime() - 1000) },
          revokedAt: null,
        },
      });

      if (elapsedSinceRevocation <= GRACE_PERIOD_MS && successorToken) {
        logger.info(
          { userId: storedToken.userId, tokenId: storedToken.id, elapsedMs: elapsedSinceRevocation },
          'Benign concurrent refresh token reuse detected within grace window. Returning access token and replacement refresh token.'
        );
        const roleName = user.role.name as RoleName;
        const accessToken = generateAccessToken({
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          tenantId: user.tenantId,
          roleId: user.roleId,
          role: roleName,
          isSuperAdmin: roleName === 'SUPER_ADMIN',
        });
        const graceRefreshData = generateRefreshTokenData();
        await systemPrisma.refreshToken.create({
          data: {
            userId: user.id,
            tokenHash: graceRefreshData.tokenHash,
            expiresAt: graceRefreshData.expiresAt,
            userAgent: metadata.userAgent,
            ipAddress: metadata.ipAddress,
          },
        });
        return {
          accessToken,
          newRawRefreshToken: graceRefreshData.rawToken,
        };
      }

      // Beyond grace window OR no active successor token (e.g. logged out or security cascade):
      // Malicious reuse / replay detected! Invalidate all sessions!
      logger.warn(
        { userId: storedToken.userId, tokenId: storedToken.id, elapsedMs: elapsedSinceRevocation },
        'SECURITY ALERT: Revoked refresh token reuse detected! Invalidating all user sessions.'
      );

      await systemPrisma.refreshToken.updateMany({
        where: { userId: storedToken.userId, revokedAt: null },
        data: { revokedAt: now },
      });

      throw new UnauthorizedError(
        'Compromised refresh token reuse detected. All active sessions have been revoked. Please log in again.'
      );
    }

    // 2. Expiry check
    if (now > new Date(storedToken.expiresAt)) {
      throw new UnauthorizedError('Refresh token has expired. Please log in again.');
    }

    // 3. Atomic Token Rotation: update revokedAt only where currently null and create new token
    const newRefreshData = generateRefreshTokenData();

    const rotationResult = await systemPrisma.$transaction(async (tx: any) => {
      const updateResult = await tx.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: now },
      });

      if (updateResult.count !== 1) {
        return null;
      }

      await tx.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: newRefreshData.tokenHash,
          expiresAt: newRefreshData.expiresAt,
          userAgent: metadata.userAgent,
          ipAddress: metadata.ipAddress,
        },
      });

      return newRefreshData.rawToken;
    });

    const roleName = user.role.name as RoleName;
    const accessToken = generateAccessToken({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      tenantId: user.tenantId,
      roleId: user.roleId,
      role: roleName,
      isSuperAdmin: roleName === 'SUPER_ADMIN',
    });

    if (!rotationResult) {
      logger.info(
        { userId: user.id, tokenId: storedToken.id },
        'Concurrent refresh race resolved: token was already rotated by concurrent thread. Generating replacement refresh token.'
      );
      const raceRefreshData = generateRefreshTokenData();
      await systemPrisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: raceRefreshData.tokenHash,
          expiresAt: raceRefreshData.expiresAt,
          userAgent: metadata.userAgent,
          ipAddress: metadata.ipAddress,
        },
      });
      return {
        accessToken,
        newRawRefreshToken: raceRefreshData.rawToken,
      };
    }

    return {
      accessToken,
      newRawRefreshToken: rotationResult,
    };
  }

  /**
   * 4. Logout: Revokes the current refresh token
   */
  public async logout(rawRefreshToken?: string): Promise<void> {
    if (!rawRefreshToken) return;

    const tokenHash = hashToken(rawRefreshToken);
    await systemPrisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * 5. Logout All: Revokes all refresh tokens for the given user
   */
  public async logoutAll(userId: string): Promise<void> {
    await systemPrisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * 6. Retrieve authenticated user profile with permissions
   */
  public async getMe(userId: string) {
    const user = await systemPrisma.user.findUnique({
      where: { id: userId },
      include: {
        role: true,
        tenant: {
          include: { plan: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('User account not found');
    }

    const roleName = user.role.name as RoleName;

    return {
      id: user.id,
      name: user.fullName,
      fullName: user.fullName,
      email: user.email,
      avatarUrl: user.avatarUrl,
      role: roleName,
      isSuperAdmin: roleName === 'SUPER_ADMIN',
      tenant: user.tenant
        ? {
            id: user.tenant.id,
            name: user.tenant.name,
            slug: user.tenant.slug,
            status: user.tenant.status,
          }
        : null,
      plan: user.tenant?.plan
        ? {
            id: user.tenant.plan.id,
            name: user.tenant.plan.name,
            maxUsers: user.tenant.plan.maxUsers,
            maxAssets: user.tenant.plan.maxAssets,
          }
        : null,
      permissions: getPermissionsForRole(roleName),
    };
  }

  /**
   * 7. Retrieve server-driven UI navigation menu for the given role
   */
  public getMenu(roleName: RoleName): MenuItem[] {
    return getMenuItemsForRole(roleName);
  }
}

export const authService = new AuthService();
