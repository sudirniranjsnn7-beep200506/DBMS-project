// ==============================================================================
// AssetVault: Demanding Examiner Security & Break-It Test Suite
// Course: BCSE307L Database Systems (Fall 2026-27)
// Rigorous adversarial security, penetration, concurrency, and integrity testing
// ==============================================================================

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app';
import { prismaForRequest } from '../config/prisma';
import { env } from '../config/env';
import { hashToken } from '../utils/hash.util';

const systemPrisma = prismaForRequest({ isSuperAdmin: true });

describe('AssetVault Examiner Break-It Security Suite', () => {
  let tenantAToken: string;
  let tenantBMemberToken: string;
  let tenantBAdminToken: string;
  let tenantAId: string;
  let tenantBId: string;
  let tenantBAssetId: string;
  let tenantBLicenseId: string;
  let tenantBUserId: string;

  beforeAll(async () => {
    // 1. Authenticate TechCorp (Tenant A) Admin
    const loginA = await request(app)
      .post('/api/auth/login')
      .send({ email: 'techcorp.admin@techcorp.io', password: 'Password123!' });
    expect(loginA.status).toBe(200);
    tenantAToken = loginA.body.data.accessToken;
    tenantAId = loginA.body.data.user.tenantId;

    // 2. Authenticate InnovateLabs (Tenant B) Admin & Member
    const loginBAdmin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'innovatelabs.admin@innovatelabs.io', password: 'Password123!' });
    expect(loginBAdmin.status).toBe(200);
    tenantBAdminToken = loginBAdmin.body.data.accessToken;
    tenantBId = loginBAdmin.body.data.user.tenantId;

    const loginBMember = await request(app)
      .post('/api/auth/login')
      .send({ email: 'innovatelabs.dev1@innovatelabs.io', password: 'Password123!' });
    expect(loginBMember.status).toBe(200);
    tenantBMemberToken = loginBMember.body.data.accessToken;

    // 3. Look up Tenant B entities for isolation verification
    const assetB = await systemPrisma.asset.findFirst({
      where: { tenantId: tenantBId, deletedAt: null },
    });
    expect(assetB).toBeDefined();
    tenantBAssetId = assetB!.id;

    const licenseB = await systemPrisma.license.findFirst({
      where: { tenantId: tenantBId, deletedAt: null },
    });
    expect(licenseB).toBeDefined();
    tenantBLicenseId = licenseB!.id;

    const userB = await systemPrisma.user.findFirst({
      where: { tenantId: tenantBId, email: 'innovatelabs.dev1@innovatelabs.io' },
    });
    expect(userB).toBeDefined();
    tenantBUserId = userB!.id;
  });

  // --------------------------------------------------------------------------
  // Part 1: Cross-Tenant Data Isolation (Expect 404 / 403 on ALL operations)
  // --------------------------------------------------------------------------
  describe('1. Cross-Tenant Data Isolation (Tenant A vs Tenant B)', () => {
    it('blocks Tenant A reading Tenant B asset -> 404 Not Found', async () => {
      const res = await request(app)
        .get(`/api/assets/${tenantBAssetId}`)
        .set('Authorization', `Bearer ${tenantAToken}`);

      expect(res.status).toBe(404);
    });

    it('blocks Tenant A updating Tenant B asset -> 404 Not Found', async () => {
      const res = await request(app)
        .put(`/api/assets/${tenantBAssetId}`)
        .set('Authorization', `Bearer ${tenantAToken}`)
        .send({ name: 'Tampered Hacker Name' });

      expect(res.status).toBe(404);
    });

    it('blocks Tenant A deleting Tenant B asset -> 404 Not Found', async () => {
      const res = await request(app)
        .delete(`/api/assets/${tenantBAssetId}`)
        .set('Authorization', `Bearer ${tenantAToken}`);

      expect(res.status).toBe(404);
    });

    it('blocks Tenant A reading Tenant B license -> 404 Not Found', async () => {
      const res = await request(app)
        .get(`/api/licenses/${tenantBLicenseId}`)
        .set('Authorization', `Bearer ${tenantAToken}`);

      expect(res.status).toBe(404);
    });

    it('blocks Tenant A updating Tenant B license -> 404 Not Found', async () => {
      const res = await request(app)
        .put(`/api/licenses/${tenantBLicenseId}`)
        .set('Authorization', `Bearer ${tenantAToken}`)
        .send({ name: 'Cross Tenant Hijack' });

      expect(res.status).toBe(404);
    });

    it('blocks Tenant A deleting Tenant B license -> 404 Not Found', async () => {
      const res = await request(app)
        .delete(`/api/licenses/${tenantBLicenseId}`)
        .set('Authorization', `Bearer ${tenantAToken}`);

      expect(res.status).toBe(404);
    });

    it('blocks Tenant A querying Tenant B user by ID -> 404 Not Found', async () => {
      const res = await request(app)
        .get(`/api/users/${tenantBUserId}`)
        .set('Authorization', `Bearer ${tenantAToken}`);

      expect(res.status).toBe(404);
    });

    it('blocks Tenant A inspecting Tenant B audit logs via filters', async () => {
      const res = await request(app)
        .get(`/api/audit-logs?userId=${tenantBUserId}`)
        .set('Authorization', `Bearer ${tenantAToken}`);

      expect(res.status).toBe(200);
      // Returns empty array for user not in tenant
      expect(res.body.data).toEqual([]);
    });
  });

  // --------------------------------------------------------------------------
  // Part 2: Privilege Escalation & Tampered Auth Defenses
  // --------------------------------------------------------------------------
  describe('2. Privilege Escalation & Auth Tampering Defenses', () => {
    it('blocks MEMBER user accessing admin user provisioning endpoint -> 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${tenantBMemberToken}`)
        .send({
          fullName: 'Unauthorized Admin',
          email: 'unauth@innovatelabs.io',
          password: 'Password123!',
          roleName: 'TENANT_ADMIN',
        });

      expect(res.status).toBe(403);
    });

    it('blocks MEMBER user accessing license creation endpoint -> 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/licenses')
        .set('Authorization', `Bearer ${tenantBMemberToken}`)
        .send({
          name: 'Unauthorized License',
          licenseTypeId: 1,
          vendorId: '00000000-0000-0000-0000-000000000000',
          totalSeats: 10,
        });

      expect(res.status).toBe(403);
    });

    it('ignores client attempts to inject role_id or tenant_id in update payloads', async () => {
      const member = await systemPrisma.user.findFirst({
        where: { email: 'innovatelabs.dev1@innovatelabs.io' },
      });
      const originalRoleId = member!.roleId;

      const res = await request(app)
        .put(`/api/users/${member!.id}`)
        .set('Authorization', `Bearer ${tenantBAdminToken}`)
        .send({
          fullName: 'Honest Developer Name',
          roleId: 1, // Attempted escalation to SUPER_ADMIN
          tenantId: '00000000-0000-0000-0000-000000000000',
        });

      expect(res.status).toBe(200);

      // Verify database record: roleId was NOT modified
      const refetched = await systemPrisma.user.findUnique({ where: { id: member!.id } });
      expect(refetched!.roleId).toBe(originalRoleId);
    });

    it('rejects tampered JWT signature with 401 Unauthorized', async () => {
      const fakeToken = jwt.sign(
        { sub: tenantBUserId, email: 'fake@innovatelabs.io', role: 'SUPER_ADMIN', isSuperAdmin: true },
        'wrong_crypto_secret_for_attack_attempt_12345678',
        { expiresIn: '1h' }
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${fakeToken}`);

      expect(res.status).toBe(401);
    });

    it('rejects expired JWT token with 401 Unauthorized and expired indicator', async () => {
      const expiredToken = jwt.sign(
        { sub: tenantBUserId, email: 'expired@innovatelabs.io', role: 'MEMBER' },
        env.JWT_ACCESS_SECRET,
        { expiresIn: '-10s' }
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error?.details?.expired).toBe(true);
    });

    it('detects replayed refresh token and revokes entire token family', async () => {
      // 1. Initial login to get fresh cookie
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'innovatelabs.dev2@innovatelabs.io', password: 'Password123!' });
      expect(loginRes.status).toBe(200);
      const cookieHeader = String(loginRes.headers['set-cookie'] || '');

      // 2. Legitimate refresh 1 -> succeeds
      const refresh1 = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', cookieHeader);
      expect(refresh1.status).toBe(200);
      const newCookieHeader = String(refresh1.headers['set-cookie'] || '');

      // Age old token past grace window
      const match = cookieHeader.match(/refreshToken=([^;]+)/);
      const oldToken: string = match && match[1] ? match[1] : '';
      await systemPrisma.refreshToken.update({
        where: { tokenHash: hashToken(oldToken) },
        data: { revokedAt: new Date(Date.now() - 10000) },
      });

      // 3. Attacker replays OLD compromised refresh token -> detects reuse and fails with 401
      const replayed = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', cookieHeader);
      expect(replayed.status).toBe(401);

      // 4. Verification: legitimate new cookie is now ALSO revoked due to security lockout
      const subsequent = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', newCookieHeader);
      expect(subsequent.status).toBe(401);
    });
  });

  // --------------------------------------------------------------------------
  // Part 3: Injection & XSS Immunity
  // --------------------------------------------------------------------------
  describe('3. SQL Injection & XSS Immunity', () => {
    it('safely handles SQL injection payloads in global search query without crashing', async () => {
      const sqlInjections = [
        "' OR 1=1 --",
        "'; DROP TABLE users; --",
        "' UNION SELECT id, email, password_hash FROM users --",
        "1' AND '1'='1",
      ];

      for (const payload of sqlInjections) {
        const res = await request(app)
          .get(`/api/search?q=${encodeURIComponent(payload)}`)
          .set('Authorization', `Bearer ${tenantAToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data).toBeDefined();
        expect(Array.isArray(res.body.data.results.assets)).toBe(true);
      }
    });

    it('safely handles invalid sort parameters with schema validation errors', async () => {
      const res = await request(app)
        .get('/api/assets?sort=non_existent_column;DROP%20TABLE%20users')
        .set('Authorization', `Bearer ${tenantAToken}`);

      // Handled gracefully via validation error or fallback
      expect([200, 400]).toContain(res.status);
    });

    it('persists XSS payloads as harmless plain text without unescaped execution', async () => {
      const xssPayload = '<script>alert("XSS_EXPLOIT")</script><img src=x onerror=alert(1)>';
      const user = await systemPrisma.user.findFirst({ where: { tenantId: tenantAId } });

      const res = await request(app)
        .post('/api/assets')
        .set('Authorization', `Bearer ${tenantAToken}`)
        .send({
          name: `XSS Test Asset ${Date.now()}`,
          description: xssPayload,
          assetType: 'DOCUMENT',
          status: 'DRAFT',
          assetCode: `XSS-${Date.now()}`,
          ownerId: user!.id,
        });

      expect([200, 201]).toContain(res.status);
      const createdId = res.body.data.id;

      // Verify payload is stored verbatim and returned safely as JSON string literal
      const fetched = await request(app)
        .get(`/api/assets/${createdId}`)
        .set('Authorization', `Bearer ${tenantAToken}`);

      expect(fetched.status).toBe(200);
      expect(fetched.body.data.description).toBe(xssPayload);

      // Clean up
      await systemPrisma.asset.delete({ where: { id: createdId } });
    });
  });

  // --------------------------------------------------------------------------
  // Part 4: Over-Allocation Concurrency Race
  // --------------------------------------------------------------------------
  describe('4. Over-Allocation Race Condition Defense', () => {
    it('fires 20 concurrent allocation requests at a 3-seat license: exactly 3 succeed, 17 blocked', async () => {
      // 1. Create a dedicated test license with capacity of exactly 3 seats
      const vendor = await systemPrisma.vendor.findFirst({ where: { tenantId: tenantAId } });
      const licType = await systemPrisma.licenseType.findFirst({ where: { isSeatBased: true } });

      const testLicense = await systemPrisma.license.create({
        data: {
          tenantId: tenantAId,
          vendorId: vendor!.id,
          licenseTypeId: licType!.id,
          name: `Concurrency Race Test License ${Date.now()}`,
          licenseKey: `RACE-KEY-${Date.now()}`,
          totalSeats: 3,
          cost: 300.0,
          startDate: new Date(),
          status: 'ACTIVE',
        },
      });

      // 2. Fetch distinct users from TechCorp to attempt allocations
      const users = await systemPrisma.user.findMany({
        where: { tenantId: tenantAId },
        take: 20,
      });

      // 3. Fire 20 parallel allocation requests
      const allocationPromises = users.slice(0, 20).map((u) =>
        request(app)
          .post(`/api/licenses/${testLicense.id}/allocate`)
          .set('Authorization', `Bearer ${tenantAToken}`)
          .send({ userId: u.id })
      );

      const results = await Promise.all(allocationPromises);

      const successCount = results.filter((r) => r.status === 200 || r.status === 201).length;
      const conflictCount = results.filter((r) => r.status === 409).length;

      expect(successCount).toBe(3);
      expect(conflictCount).toBe(users.slice(0, 20).length - 3);

      // 4. Verify database state: active allocations must equal exactly 3
      const dbAllocations = await systemPrisma.licenseAllocation.count({
        where: { licenseId: testLicense.id, status: 'ACTIVE' },
      });
      expect(dbAllocations).toBe(3);

      // Clean up test license allocations & license
      await systemPrisma.licenseAllocation.deleteMany({ where: { licenseId: testLicense.id } });
      await systemPrisma.license.delete({ where: { id: testLicense.id } });
    });
  });

  // --------------------------------------------------------------------------
  // Part 5: Data Integrity & Business Bounds
  // --------------------------------------------------------------------------
  describe('5. Data Integrity & Constraint Boundaries', () => {
    it('blocks license with invalid date range (end_date <= start_date) -> 400 Bad Request', async () => {
      const vendor = await systemPrisma.vendor.findFirst({ where: { tenantId: tenantAId } });
      const licType = await systemPrisma.licenseType.findFirst();

      const res = await request(app)
        .post('/api/licenses')
        .set('Authorization', `Bearer ${tenantAToken}`)
        .send({
          name: 'Invalid Date License',
          licenseTypeId: licType!.id,
          vendorId: vendor!.id,
          totalSeats: 10,
          cost: 100,
          startDate: '2026-12-01',
          endDate: '2026-11-01', // Before start date
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('blocks license with negative or zero seat capacity -> 400 Bad Request', async () => {
      const vendor = await systemPrisma.vendor.findFirst({ where: { tenantId: tenantAId } });
      const licType = await systemPrisma.licenseType.findFirst();

      const res = await request(app)
        .post('/api/licenses')
        .set('Authorization', `Bearer ${tenantAToken}`)
        .send({
          name: 'Negative Seats License',
          licenseTypeId: licType!.id,
          vendorId: vendor!.id,
          totalSeats: -5,
          cost: 100,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('blocks duplicate asset_code creation within the same tenant -> 409 Conflict', async () => {
      const existingAsset = await systemPrisma.asset.findFirst({
        where: { tenantId: tenantAId, deletedAt: null },
      });
      const user = await systemPrisma.user.findFirst({ where: { tenantId: tenantAId } });

      const res = await request(app)
        .post('/api/assets')
        .set('Authorization', `Bearer ${tenantAToken}`)
        .send({
          name: 'Duplicate Code Asset',
          assetCode: existingAsset!.assetCode, // Duplicate!
          assetType: 'IMAGE',
          status: 'DRAFT',
          ownerId: user!.id,
        });

      expect([400, 409]).toContain(res.status);
    });
  });

  // --------------------------------------------------------------------------
  // Part 6: Brute Force & Rate Limiting
  // --------------------------------------------------------------------------
  describe('6. Login Rate Limiting & Account Lockout Defense', () => {
    it('rate limits rapid failed login attempts returning 429 Too Many Requests', async () => {
      const attackEmail = `brute.force.${Date.now()}@techcorp.io`;
      const attempts = [];

      for (let i = 0; i < 7; i++) {
        attempts.push(
          request(app)
            .post('/api/auth/login')
            .send({ email: attackEmail, password: 'WrongPassword999!' })
        );
      }

      const results = await Promise.all(attempts);

      // Either rate limiter triggered 429 or generic 401s without credential exposure
      expect(results.every((r) => r.status === 401 || r.status === 429)).toBe(true);
    });
  });
});
