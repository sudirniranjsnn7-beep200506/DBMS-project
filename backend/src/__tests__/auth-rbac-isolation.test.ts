// ==============================================================================
// AssetVault: Comprehensive Authentication, RBAC & Isolation Test Suite
// Course: VIT, BCSE307L Database Systems (Fall 2026-27)
// Covers:
//   1. Successful login (access token + httpOnly cookie)
//   2. Bad password generic 401 & no account enumeration
//   3. Account lockout (5 failed attempts trigger 429)
//   4. Token rotation (POST /api/auth/refresh)
//   5. Token reuse detection (revokes all user sessions)
//   6. Logout revokes token & clears cookie
//   7. Role authorization (MEMBER 403 on GET /api/users; ADMIN 200)
//   8. Tenant isolation (cross-tenant lookup returns 404 Not Found)
//   9. Mass-assignment prevention (Zod strips role_id/tenant_id)
//  10. SQL injection immunity on query params
// ==============================================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import app from '../app';
import { prismaForRequest } from '../config/prisma';
import { hashToken } from '../utils/hash.util';

const systemPrisma = prismaForRequest({ isSuperAdmin: true });

describe('AssetVault Security, RBAC & Multi-Tenant Isolation Suite', () => {
  let techcorpAdminToken: string;
  let techcorpMemberToken: string;
  let techcorpTenantId: string;
  let innovatelabsTenantId: string;
  let techcorpAssetId: string;
  let innovatelabsAssetId: string;

  beforeAll(async () => {
    // Clear failed login attempts before test suite runs
    try {
      await systemPrisma.$executeRaw(Prisma.sql`DELETE FROM failed_login_attempts;`);
    } catch (e) {
      // ignore
    }

    // 1. Retrieve TechCorp and InnovateLabs tenant IDs
    const techcorp = await systemPrisma.tenant.findUnique({
      where: { slug: 'techcorp' },
      include: { assets: { take: 1 } },
    });
    const innovatelabs = await systemPrisma.tenant.findUnique({
      where: { slug: 'innovatelabs' },
      include: { assets: { take: 1 } },
    });

    if (!techcorp || !innovatelabs) {
      throw new Error('Test preconditions not met: seeded tenants missing');
    }

    techcorpTenantId = techcorp.id;
    innovatelabsTenantId = innovatelabs.id;
    techcorpAssetId = techcorp.assets[0]?.id || '';
    innovatelabsAssetId = innovatelabs.assets[0]?.id || '';

    // If assets were not seeded, create test assets
    if (!techcorpAssetId) {
      const tcAdmin = await systemPrisma.user.findFirst({ where: { tenantId: techcorpTenantId } });
      const asset = await systemPrisma.asset.create({
        data: {
          tenantId: techcorpTenantId,
          ownerId: tcAdmin!.id,
          name: 'TechCorp Core Library',
          assetCode: 'TC-CORE-001',
          assetType: 'SOFTWARE',
        },
      });
      techcorpAssetId = asset.id;
    }

    if (!innovatelabsAssetId) {
      const ilAdmin = await systemPrisma.user.findFirst({ where: { tenantId: innovatelabsTenantId } });
      const asset = await systemPrisma.asset.create({
        data: {
          tenantId: innovatelabsTenantId,
          ownerId: ilAdmin!.id,
          name: 'InnovateLabs Dataset Prime',
          assetCode: 'IL-DATA-001',
          assetType: 'DATASET',
        },
      });
      innovatelabsAssetId = asset.id;
    }
  });

  // ----------------------------------------------------------------------------
  // Test 1: Successful login returns access token and sets httpOnly cookie
  // ----------------------------------------------------------------------------
  it('1. Successful login returns access token and sets httpOnly SameSite=Strict cookie', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'techcorp.admin@techcorp.io',
        password: 'Password123!',
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.accessToken).toBeDefined();
    expect(typeof res.body.data.accessToken).toBe('string');
    expect(res.body.data.user.email).toBe('techcorp.admin@techcorp.io');
    expect(res.body.data.user.role).toBe('TENANT_ADMIN');
    expect(res.body.data.user.tenantId).toBe(techcorpTenantId);

    // Verify Set-Cookie header
    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    const cookieStr = Array.isArray(setCookie) ? setCookie.join(';') : (setCookie as string);
    expect(cookieStr).toContain('refreshToken=');
    expect(cookieStr.toLowerCase()).toContain('httponly');
    expect(cookieStr.toLowerCase()).toContain('samesite=strict');

    techcorpAdminToken = res.body.data.accessToken;
  });

  // ----------------------------------------------------------------------------
  // Test 2: Login failure with wrong password returns generic 401 (no enumeration)
  // ----------------------------------------------------------------------------
  it('2. Login failure with wrong password returns generic 401 without account enumeration', async () => {
    // Wrong password for existing user
    const wrongPassRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'techcorp.admin@techcorp.io',
        password: 'WrongPassword999!',
      });

    expect(wrongPassRes.status).toBe(401);
    expect(wrongPassRes.body.error.message).toBe('Invalid email or password');

    // Completely non-existent email
    const unknownEmailRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'ghost.user.404@nowhere.com',
        password: 'WrongPassword999!',
      });

    expect(unknownEmailRes.status).toBe(401);
    expect(unknownEmailRes.body.error.message).toBe('Invalid email or password');
  });

  // ----------------------------------------------------------------------------
  // Test 3: Account lockout (5 failed attempts trigger 429)
  // ----------------------------------------------------------------------------
  it('3. Account lockout triggers HTTP 429 after 5 failed login attempts', async () => {
    const targetEmail = `lockout.victim.${Date.now()}@example.com`;

    // Perform 5 consecutive failed login attempts
    for (let i = 1; i <= 5; i++) {
      const failedRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: targetEmail,
          password: 'BadPassword!',
        });
      expect(failedRes.status).toBe(401);
    }

    // 6th attempt must be locked out with HTTP 429
    const lockedRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: targetEmail,
        password: 'BadPassword!',
      });

    expect(lockedRes.status).toBe(429);
    expect(lockedRes.body.error.code).toBe('TOO_MANY_REQUESTS');
    expect(lockedRes.body.error.message).toContain('Too many failed login attempts');
  });

  // ----------------------------------------------------------------------------
  // Test 4: Token rotation revokes old token and issues new token
  // ----------------------------------------------------------------------------
  it('4. Token rotation (POST /api/auth/refresh) revokes old token and issues new one', async () => {
    // Login to obtain initial session
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'techcorp.mgr1@techcorp.io',
        password: 'Password123!',
      });

    expect(loginRes.status).toBe(200);
    const cookies = loginRes.headers['set-cookie'];
    const initialCookie = Array.isArray(cookies) ? cookies[0] : cookies;
    const initialTokenMatch = initialCookie.match(/refreshToken=([^;]+)/);
    const initialRefreshToken = initialTokenMatch ? initialTokenMatch[1] : '';
    expect(initialRefreshToken).toBeTruthy();

    // Perform refresh with initial token
    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${initialRefreshToken}`]);

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.data.accessToken).toBeDefined();

    const newCookies = refreshRes.headers['set-cookie'];
    const newCookieStr = Array.isArray(newCookies) ? newCookies[0] : newCookies;
    const newTokenMatch = newCookieStr.match(/refreshToken=([^;]+)/);
    const newRefreshToken = newTokenMatch ? newTokenMatch[1] : '';

    expect(newRefreshToken).toBeTruthy();
    expect(newRefreshToken).not.toBe(initialRefreshToken);
  });

  // ----------------------------------------------------------------------------
  // Test 4b: Concurrent refresh requests within grace window
  // ----------------------------------------------------------------------------
  it('4b. Concurrent refresh requests within grace window both succeed and do not nuke sessions', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'techcorp.dev1@techcorp.io',
        password: 'Password123!',
      });

    expect(loginRes.status).toBe(200);
    const cookies = loginRes.headers['set-cookie'];
    const cookie = Array.isArray(cookies) ? cookies[0] : cookies;
    const token = cookie.match(/refreshToken=([^;]+)/)![1];

    // Fire two concurrent refresh requests simultaneously with the same refresh token
    const [res1, res2] = await Promise.all([
      request(app).post('/api/auth/refresh').set('Cookie', [`refreshToken=${token}`]),
      request(app).post('/api/auth/refresh').set('Cookie', [`refreshToken=${token}`]),
    ]);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res1.body.data.accessToken).toBeDefined();
    expect(res2.body.data.accessToken).toBeDefined();

    // Verify session family was NOT nuked: a subsequent request with the newly issued token succeeds
    const newCookies = res1.headers['set-cookie'] || res2.headers['set-cookie'];
    const newCookie = Array.isArray(newCookies) ? newCookies[0] : newCookies;
    const newToken = newCookie.match(/refreshToken=([^;]+)/)![1];

    const subsequentRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${newToken}`]);

    expect(subsequentRes.status).toBe(200);
    expect(subsequentRes.body.data.accessToken).toBeDefined();
  });

  // ----------------------------------------------------------------------------
  // Test 4c: Multiple (5) concurrent refresh requests within grace window
  // ----------------------------------------------------------------------------
  it('4c. Multiple (5) concurrent refresh requests within grace window all succeed', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'techcorp.dev2@techcorp.io',
        password: 'Password123!',
      });

    expect(loginRes.status).toBe(200);
    const cookies = loginRes.headers['set-cookie'];
    const cookie = Array.isArray(cookies) ? cookies[0] : cookies;
    const token = cookie.match(/refreshToken=([^;]+)/)![1];

    // Fire 5 concurrent refresh requests simultaneously
    const responses = await Promise.all([
      request(app).post('/api/auth/refresh').set('Cookie', [`refreshToken=${token}`]),
      request(app).post('/api/auth/refresh').set('Cookie', [`refreshToken=${token}`]),
      request(app).post('/api/auth/refresh').set('Cookie', [`refreshToken=${token}`]),
      request(app).post('/api/auth/refresh').set('Cookie', [`refreshToken=${token}`]),
      request(app).post('/api/auth/refresh').set('Cookie', [`refreshToken=${token}`]),
    ]);

    for (const res of responses) {
      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();
    }
  });

  // ----------------------------------------------------------------------------
  // Test 5: Refresh token reuse detection revokes all user sessions
  // ----------------------------------------------------------------------------
  it('5. Refresh token reuse detection revokes all sessions upon replay of revoked token', async () => {
    // Step 1: Login fresh session
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'techcorp.mgr2@techcorp.io',
        password: 'Password123!',
      });

    const cookies1 = loginRes.headers['set-cookie'];
    const cookie1 = Array.isArray(cookies1) ? cookies1[0] : cookies1;
    const token1 = cookie1.match(/refreshToken=([^;]+)/)![1];

    // Step 2: Rotate token1 -> produces token2
    const rotateRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${token1}`]);

    expect(rotateRes.status).toBe(200);
    const cookies2 = rotateRes.headers['set-cookie'];
    const cookie2 = Array.isArray(cookies2) ? cookies2[0] : cookies2;
    const token2 = cookie2.match(/refreshToken=([^;]+)/)![1];

    // Age token1 past the grace window to simulate a replay attack outside benign concurrency
    await systemPrisma.refreshToken.update({
      where: { tokenHash: hashToken(token1) },
      data: { revokedAt: new Date(Date.now() - 10000) },
    });

    // Step 3: Malicious replay of old token1 (should trigger reuse detection)
    const replayRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${token1}`]);

    expect(replayRes.status).toBe(401);
    expect(replayRes.body.error.message).toContain('Compromised refresh token reuse detected');

    // Step 4: Verify that even token2 is now invalidated
    const cascadeRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${token2}`]);

    expect(cascadeRes.status).toBe(401);
  });

  // ----------------------------------------------------------------------------
  // Test 6: Logout revokes refresh token and clears cookie
  // ----------------------------------------------------------------------------
  it('6. Logout revokes refresh token and clears cookie, preventing future refreshes', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'techcorp.dev3@techcorp.io',
        password: 'Password123!',
      });

    const cookies = loginRes.headers['set-cookie'];
    const cookie = Array.isArray(cookies) ? cookies[0] : cookies;
    const token = cookie.match(/refreshToken=([^;]+)/)![1];

    // Call logout
    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', [`refreshToken=${token}`]);

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.status).toBe('success');

    // Verify cookie was cleared (Expires in past or Max-Age=0)
    const logoutCookies = logoutRes.headers['set-cookie'];
    const logoutCookieStr = Array.isArray(logoutCookies) ? logoutCookies.join(';') : (logoutCookies as string);
    expect(logoutCookieStr).toContain('refreshToken=;');

    // Attempting refresh with that token fails
    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${token}`]);

    expect(refreshRes.status).toBe(401);
  });

  // ----------------------------------------------------------------------------
  // Test 7: Role authorization: MEMBER receives 403 Forbidden on GET /api/users
  // ----------------------------------------------------------------------------
  it('7. Role authorization: MEMBER calling GET /api/users receives 403 Forbidden', async () => {
    // Login as MEMBER
    const memberLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'techcorp.dev1@techcorp.io',
        password: 'Password123!',
      });

    expect(memberLogin.status).toBe(200);
    techcorpMemberToken = memberLogin.body.data.accessToken;

    // Member attempts to list organization users
    const forbiddenRes = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${techcorpMemberToken}`);

    expect(forbiddenRes.status).toBe(403);
    expect(forbiddenRes.body.error.code).toBe('FORBIDDEN');
    expect(forbiddenRes.body.error.message).toContain("Forbidden: Role 'MEMBER' lacks permission 'users:read'");

    // Contrast: Tenant Admin listing organization users succeeds
    const adminRes = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${techcorpAdminToken}`);

    expect(adminRes.status).toBe(200);
    expect(adminRes.body.status).toBe('success');
    expect(Array.isArray(adminRes.body.data)).toBe(true);
  });

  // ----------------------------------------------------------------------------
  // Test 8: Tenant isolation: Cross-tenant resource lookup returns 404 (never 403)
  // ----------------------------------------------------------------------------
  it('8. Tenant isolation: Tenant A user querying Tenant B asset ID receives 404 Not Found', async () => {
    // TechCorp user queries InnovateLabs asset ID
    const crossTenantRes = await request(app)
      .get(`/api/assets/${innovatelabsAssetId}`)
      .set('Authorization', `Bearer ${techcorpAdminToken}`);

    expect(crossTenantRes.status).toBe(404);
    expect(crossTenantRes.body.error.code).toBe('NOT_FOUND');
    expect(crossTenantRes.body.error.message).toBe('Asset not found');

    // Contrast: TechCorp user queries TechCorp asset ID succeeds
    const ownTenantRes = await request(app)
      .get(`/api/assets/${techcorpAssetId}`)
      .set('Authorization', `Bearer ${techcorpAdminToken}`);

    expect(ownTenantRes.status).toBe(200);
    expect(ownTenantRes.body.status).toBe('success');
    expect(ownTenantRes.body.data.id).toBe(techcorpAssetId);
  });

  // ----------------------------------------------------------------------------
  // Test 9: Mass-assignment prevention: Extra fields stripped by Zod
  // ----------------------------------------------------------------------------
  it('9. Mass-assignment prevention: Malicious tenant_id or role_id fields are stripped', async () => {
    const maliciousPayload = {
      name: `Secure Audit Scanner ${Date.now()}`,
      assetCode: `SEC-SCAN-${Math.floor(Math.random() * 90000 + 10000)}`,
      assetType: 'SOFTWARE',
      description: 'Defensive asset to test schema stripping',
      // Injected malicious fields attempting privilege escalation and cross-tenant leakage:
      tenantId: innovatelabsTenantId,
      role_id: 1,
      id: '00000000-0000-0000-0000-000000000000',
    };

    const res = await request(app)
      .post('/api/assets')
      .set('Authorization', `Bearer ${techcorpAdminToken}`)
      .send(maliciousPayload);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.data.name).toBe(maliciousPayload.name);

    // Verify tenantId was forced to the authenticated caller's tenant (TechCorp), NOT injected InnovateLabs
    expect(res.body.data.tenantId).toBe(techcorpTenantId);
    expect(res.body.data.tenantId).not.toBe(innovatelabsTenantId);
  });

  // ----------------------------------------------------------------------------
  // Test 10: SQL injection immunity on query params
  // ----------------------------------------------------------------------------
  it('10. SQL injection immunity: Malicious query param does not crash or execute raw SQL', async () => {
    const sqliPayload = "' OR '1'='1";

    const res = await request(app)
      .get(`/api/assets?query=${encodeURIComponent(sqliPayload)}`)
      .set('Authorization', `Bearer ${techcorpAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    // Result must be safely parameterized; returns 0 or only assets literally matching "' OR '1'='1"
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  // ----------------------------------------------------------------------------
  // Test 11: GET /api/auth/me returns profile containing both fullName and name
  // ----------------------------------------------------------------------------
  it('11. GET /api/auth/me returns profile containing both fullName and name matching domain types', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${techcorpAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.email).toBe('techcorp.admin@techcorp.io');
    expect(res.body.data.name).toBe('TechCorp Dynamics Lead Admin');
    expect(res.body.data.fullName).toBe('TechCorp Dynamics Lead Admin');
    expect(res.body.data.tenant).toBeDefined();
    expect(res.body.data.tenant.slug).toBe('techcorp');
    expect(Array.isArray(res.body.data.permissions)).toBe(true);
  });

  // ----------------------------------------------------------------------------
  // Test 12: Tenant self-registration records the initial authenticated login timestamp
  // ----------------------------------------------------------------------------
  it('12. Tenant self-registration records the initial authenticated login timestamp', async () => {
    const suffix = `1792312784150-${Math.floor(Math.random() * 10000)}`;
    const registrationTestSlug = `last-login-qa-${suffix}`;
    const adminEmail = `last-login-user-${suffix}@example.com`;

    const res = await request(app)
      .post('/api/auth/register-tenant')
      .send({
        tenantName: `Last Login QA ${suffix}`,
        slug: registrationTestSlug,
        contactEmail: `last-login-contact-${suffix}@example.com`,
        adminFullName: 'Last Login QA User',
        adminEmail,
        password: 'Strong-QA-Pass123!',
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.data.user.email).toBe(adminEmail);

    const createdUser = await systemPrisma.user.findUnique({
      where: { email: adminEmail },
      select: { lastLoginAt: true },
    });
    expect(createdUser?.lastLoginAt).toBeInstanceOf(Date);

    const auditRecord = await systemPrisma.auditLog.findFirst({
      where: {
        recordId: res.body.data.user.tenantId,
        tableName: 'tenants',
        userId: res.body.data.user.id,
      },
    });
    expect(auditRecord).toBeDefined();
    expect(auditRecord?.userId).toBe(res.body.data.user.id);
    expect((auditRecord?.newData as any)?.event).toBe('TENANT_ONBOARDED');
  });

  afterAll(async () => {
    const testAssets = await systemPrisma.asset.findMany({
      where: {
        OR: [
          { assetCode: { startsWith: 'SEC-SCAN-' } },
          { assetCode: { startsWith: 'TEST-AST-' } },
        ],
      },
      select: { id: true },
    });
    const testAssetIds = testAssets.map((a) => a.id);

    if (testAssetIds.length > 0) {
      await systemPrisma.assetLicense.deleteMany({
        where: { assetId: { in: testAssetIds } },
      });
      await systemPrisma.assetAccessLog.deleteMany({
        where: { assetId: { in: testAssetIds } },
      });
      await systemPrisma.assetVersion.deleteMany({
        where: { assetId: { in: testAssetIds } },
      });
      await systemPrisma.assetTag.deleteMany({
        where: { assetId: { in: testAssetIds } },
      });
      await systemPrisma.asset.deleteMany({
        where: { id: { in: testAssetIds } },
      });
    }
  });
});
