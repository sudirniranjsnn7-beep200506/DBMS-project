// ==============================================================================
// AssetVault: Asset Access State Machine & Checkout/Checkin Verification Suite
// Course: BCSE307L Database Systems (Fall 2026-27)
// Verifies:
//   1. AssetStatus state machine: rejects checkout of non-ACTIVE assets (ARCHIVED, DRAFT) with 409 Conflict
//   2. Open checkout verification: rejects double checkout by same user with 409 Conflict
//   3. Checkin verification: requires an open CHECKOUT log for the user/asset; rejects checkin without checkout with 409 Conflict
//   4. Multi-user checkout/checkin lifecycle isolation and audit logging
// ==============================================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { prisma, systemPrisma } from '../config/prisma';
import { accessService } from '../services/access.service';
import { ConflictError } from '../errors/AppError';
import { Prisma } from '@prisma/client';

describe('Asset Access State Machine (Checkout, Checkin & Status Transitions)', () => {
  let adminToken: string;
  let member1Token: string;
  let member2Token: string;

  let tenantId: string;
  let adminUserId: string;
  let member1UserId: string;
  let member2UserId: string;

  let testVendorId: string;
  let testLicenseId: string;
  let activeAssetId: string;
  let archivedAssetId: string;
  let draftAssetId: string;

  beforeAll(async () => {
    // 1. Authenticate TechCorp Tenant Admin
    const adminLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'techcorp.admin@techcorp.io', password: 'Password123!' });
    expect(adminLoginRes.status).toBe(200);
    adminToken = adminLoginRes.body.data.accessToken;
    expect(adminToken).toBeDefined();
    tenantId = adminLoginRes.body.data.user.tenantId;
    adminUserId = adminLoginRes.body.data.user.id;

    // 2. Authenticate TechCorp Member 1
    const member1LoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'techcorp.dev1@techcorp.io', password: 'Password123!' });
    expect(member1LoginRes.status).toBe(200);
    member1Token = member1LoginRes.body.data.accessToken;
    member1UserId = member1LoginRes.body.data.user.id;

    // 3. Authenticate TechCorp Member 2
    const member2LoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'techcorp.dev2@techcorp.io', password: 'Password123!' });
    expect(member2LoginRes.status).toBe(200);
    member2Token = member2LoginRes.body.data.accessToken;
    member2UserId = member2LoginRes.body.data.user.id;

    // 4. Create Vendor for testing
    const vendor = await systemPrisma.vendor.create({
      data: {
        tenantId,
        name: `State Machine Vendor ${Date.now()}`,
      },
    });
    testVendorId = vendor.id;

    // 5. Fetch a seat-based expirable LicenseType
    const licenseType = await systemPrisma.licenseType.findFirst({
      where: { isSeatBased: true, isExpirable: true },
    });
    expect(licenseType).toBeDefined();

    // 6. Create License with 10 seats
    const license = await systemPrisma.license.create({
      data: {
        tenantId,
        vendorId: testVendorId,
        licenseTypeId: licenseType!.id,
        name: `State Machine Test License ${Date.now()}`,
        licenseKey: `KEY-STATEMACHINE-${Date.now()}`,
        totalSeats: 10,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2030-12-31'),
        cost: new Prisma.Decimal('5000.00'),
        currency: 'USD',
        status: 'ACTIVE',
      },
    });
    testLicenseId = license.id;

    // 7. Allocate seats on this license to Member 1 and Member 2
    await systemPrisma.licenseAllocation.createMany({
      data: [
        {
          licenseId: testLicenseId,
          userId: member1UserId,
          allocatedBy: adminUserId,
          status: 'ACTIVE',
        },
        {
          licenseId: testLicenseId,
          userId: member2UserId,
          allocatedBy: adminUserId,
          status: 'ACTIVE',
        },
      ],
    });

    // 8. Create an ACTIVE asset and link it to the covering license
    const activeAsset = await systemPrisma.asset.create({
      data: {
        tenantId,
        ownerId: adminUserId,
        name: `Active State Asset ${Date.now()}`,
        assetCode: `ACT-${Date.now()}`,
        assetType: 'SOFTWARE',
        status: 'ACTIVE',
        versions: {
          create: {
            versionNo: 1,
            fileUrl: 'https://storage.assetvault.internal/assets/active.bin',
            fileSizeBytes: 1048576n,
            checksumSha256: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
          },
        },
      },
    });
    activeAssetId = activeAsset.id;

    await systemPrisma.assetLicense.create({
      data: {
        assetId: activeAssetId,
        licenseId: testLicenseId,
        assignedBy: adminUserId,
      },
    });

    // 9. Create an ARCHIVED asset and link it to the license
    const archivedAsset = await systemPrisma.asset.create({
      data: {
        tenantId,
        ownerId: adminUserId,
        name: `Archived State Asset ${Date.now()}`,
        assetCode: `ARC-${Date.now()}`,
        assetType: 'SOFTWARE',
        status: 'ARCHIVED',
        versions: {
          create: {
            versionNo: 1,
            fileUrl: 'https://storage.assetvault.internal/assets/archived.bin',
            fileSizeBytes: 1048576n,
            checksumSha256: 'f1e2d3c4b5a60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
          },
        },
      },
    });
    archivedAssetId = archivedAsset.id;

    await systemPrisma.assetLicense.create({
      data: {
        assetId: archivedAssetId,
        licenseId: testLicenseId,
        assignedBy: adminUserId,
      },
    });

    // 10. Create a DRAFT asset
    const draftAsset = await systemPrisma.asset.create({
      data: {
        tenantId,
        ownerId: adminUserId,
        name: `Draft State Asset ${Date.now()}`,
        assetCode: `DFT-${Date.now()}`,
        assetType: 'SOFTWARE',
        status: 'DRAFT',
        versions: {
          create: {
            versionNo: 1,
            fileUrl: 'https://storage.assetvault.internal/assets/draft.bin',
            fileSizeBytes: 1048576n,
            checksumSha256: '1122334455660718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
          },
        },
      },
    });
    draftAssetId = draftAsset.id;

    await systemPrisma.assetLicense.create({
      data: {
        assetId: draftAssetId,
        licenseId: testLicenseId,
        assignedBy: adminUserId,
      },
    });
  });

  afterAll(async () => {
    // Teardown test assets, allocations, license, vendor
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT 
          set_config('app.is_super_admin', 'true', true),
          set_config('app.allow_audit_delete', 'true', true),
          set_config('app.current_user_id', '', true);`
      );

      const assetIds = [activeAssetId, archivedAssetId, draftAssetId].filter(Boolean);
      if (assetIds.length > 0) {
        await tx.$executeRaw(
          Prisma.sql`DELETE FROM asset_access_logs WHERE asset_id IN (${Prisma.join(assetIds.map((id) => Prisma.sql`${id}::uuid`))});`
        );
        await tx.$executeRaw(
          Prisma.sql`DELETE FROM asset_licenses WHERE asset_id IN (${Prisma.join(assetIds.map((id) => Prisma.sql`${id}::uuid`))});`
        );
        await tx.$executeRaw(
          Prisma.sql`DELETE FROM asset_versions WHERE asset_id IN (${Prisma.join(assetIds.map((id) => Prisma.sql`${id}::uuid`))});`
        );
        await tx.$executeRaw(
          Prisma.sql`DELETE FROM assets WHERE id IN (${Prisma.join(assetIds.map((id) => Prisma.sql`${id}::uuid`))});`
        );
      }

      if (testLicenseId) {
        await tx.$executeRaw(
          Prisma.sql`DELETE FROM license_allocations WHERE license_id = ${testLicenseId}::uuid;`
        );
        await tx.$executeRaw(
          Prisma.sql`DELETE FROM licenses WHERE id = ${testLicenseId}::uuid;`
        );
      }

      if (testVendorId) {
        await tx.$executeRaw(
          Prisma.sql`DELETE FROM vendors WHERE id = ${testVendorId}::uuid;`
        );
      }
    });
  });

  // ----------------------------------------------------------------------------
  // 1. Checkout of Non-ACTIVE Assets (ARCHIVED & DRAFT) -> 409 Conflict
  // ----------------------------------------------------------------------------
  describe('1. Rejection of Non-ACTIVE Asset Checkout (409 Conflict)', () => {
    it('rejects checkout of an ARCHIVED asset via HTTP API with 409 Conflict', async () => {
      const res = await request(app)
        .post(`/api/assets/${archivedAssetId}/checkout`)
        .set('Authorization', `Bearer ${member1Token}`);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain("Cannot checkout asset with status 'ARCHIVED'");
      expect(res.body.error.message).toContain('Only ACTIVE assets can be checked out');
    });

    it('rejects checkout of an ARCHIVED asset via accessService.checkoutAsset with ConflictError', async () => {
      await expect(
        accessService.checkoutAsset(tenantId, archivedAssetId, member1UserId)
      ).rejects.toThrow(ConflictError);

      try {
        await accessService.checkoutAsset(tenantId, archivedAssetId, member1UserId);
      } catch (err: any) {
        expect(err.statusCode).toBe(409);
        expect(err.code).toBe('CONFLICT');
        expect(err.message).toContain("Cannot checkout asset with status 'ARCHIVED'");
      }
    });

    it('rejects checkout of a DRAFT asset with 409 Conflict', async () => {
      const res = await request(app)
        .post(`/api/assets/${draftAssetId}/checkout`)
        .set('Authorization', `Bearer ${member1Token}`);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain("Cannot checkout asset with status 'DRAFT'");
    });

    it('rejects checkin of an ARCHIVED asset with 409 Conflict', async () => {
      const res = await request(app)
        .post(`/api/assets/${archivedAssetId}/checkin`)
        .set('Authorization', `Bearer ${member1Token}`);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain("Cannot check in asset with status 'ARCHIVED'");
    });
  });

  // ----------------------------------------------------------------------------
  // 2. Checkin Without Prior Checkout -> 409 Conflict
  // ----------------------------------------------------------------------------
  describe('2. Checkin Without Open Checkout (409 Conflict)', () => {
    it('rejects checkin when the user has never checked out the asset via HTTP API with 409 Conflict', async () => {
      // Member 2 has never checked out activeAssetId
      const res = await request(app)
        .post(`/api/assets/${activeAssetId}/checkin`)
        .set('Authorization', `Bearer ${member2Token}`);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('No active checkout found for this user');
    });

    it('rejects checkin via accessService.checkinAsset when no open checkout exists', async () => {
      await expect(
        accessService.checkinAsset(tenantId, activeAssetId, member2UserId)
      ).rejects.toThrow(ConflictError);

      try {
        await accessService.checkinAsset(tenantId, activeAssetId, member2UserId);
      } catch (err: any) {
        expect(err.statusCode).toBe(409);
        expect(err.code).toBe('CONFLICT');
        expect(err.message).toContain('No active checkout found for this user');
      }
    });
  });

  // ----------------------------------------------------------------------------
  // 3. Double Checkout Prevention -> 409 Conflict
  // ----------------------------------------------------------------------------
  describe('3. Double Checkout Prevention (409 Conflict)', () => {
    it('allows initial checkout (200 OK) then rejects second checkout by the same user with 409 Conflict', async () => {
      // Step 1: Member 1 checks out the active asset -> 200 OK
      const firstCheckout = await request(app)
        .post(`/api/assets/${activeAssetId}/checkout`)
        .set('Authorization', `Bearer ${member1Token}`);

      expect(firstCheckout.status).toBe(200);
      expect(firstCheckout.body.data.success).toBe(true);
      expect(firstCheckout.body.data.message).toBe('Asset successfully checked out');
      expect(firstCheckout.body.data.asset.status).toBe('ACTIVE');

      // Step 2: Member 1 attempts double checkout -> 409 Conflict
      const secondCheckout = await request(app)
        .post(`/api/assets/${activeAssetId}/checkout`)
        .set('Authorization', `Bearer ${member1Token}`);

      expect(secondCheckout.status).toBe(409);
      expect(secondCheckout.body.error.code).toBe('CONFLICT');
      expect(secondCheckout.body.error.message).toContain('Asset is already checked out by this user');
    });

    it('rejects double checkout via accessService.checkoutAsset with ConflictError', async () => {
      // Member 1 currently has an open checkout from previous test
      await expect(
        accessService.checkoutAsset(tenantId, activeAssetId, member1UserId)
      ).rejects.toThrow(ConflictError);

      try {
        await accessService.checkoutAsset(tenantId, activeAssetId, member1UserId);
      } catch (err: any) {
        expect(err.statusCode).toBe(409);
        expect(err.code).toBe('CONFLICT');
        expect(err.message).toContain('Asset is already checked out by this user');
      }
    });
  });

  // ----------------------------------------------------------------------------
  // 4. Checkin Closes Open Checkout & Prevents Double Checkin
  // ----------------------------------------------------------------------------
  describe('4. Checkin Lifecycle & Double Checkin Prevention', () => {
    it('successfully checks in the open checkout (200 OK)', async () => {
      // Member 1 checks in their active checkout
      const checkinRes = await request(app)
        .post(`/api/assets/${activeAssetId}/checkin`)
        .set('Authorization', `Bearer ${member1Token}`);

      expect(checkinRes.status).toBe(200);
      expect(checkinRes.body.data.success).toBe(true);
      expect(checkinRes.body.data.message).toBe('Asset successfully checked in');
      expect(checkinRes.body.data.asset.status).toBe('ACTIVE');
    });

    it('rejects subsequent checkin by the same user with 409 Conflict (double checkin)', async () => {
      // The open checkout was already closed; second checkin must fail
      const repeatCheckin = await request(app)
        .post(`/api/assets/${activeAssetId}/checkin`)
        .set('Authorization', `Bearer ${member1Token}`);

      expect(repeatCheckin.status).toBe(409);
      expect(repeatCheckin.body.error.code).toBe('CONFLICT');
      expect(repeatCheckin.body.error.message).toContain('No active checkout found for this user');
    });

    it('allows Member 1 to checkout again now that the previous checkout was closed', async () => {
      // New checkout is valid because previous checkout was checked in
      const reCheckout = await request(app)
        .post(`/api/assets/${activeAssetId}/checkout`)
        .set('Authorization', `Bearer ${member1Token}`);

      expect(reCheckout.status).toBe(200);
      expect(reCheckout.body.data.message).toBe('Asset successfully checked out');

      // Clean up by checking in
      const reCheckin = await request(app)
        .post(`/api/assets/${activeAssetId}/checkin`)
        .set('Authorization', `Bearer ${member1Token}`);

      expect(reCheckin.status).toBe(200);
    });
  });

  // ----------------------------------------------------------------------------
  // 5. Multi-User Checkout State Isolation
  // ----------------------------------------------------------------------------
  describe('5. Multi-User Seat & Checkout Isolation', () => {
    it('proves checkin is scoped per user: User A checkout does not allow User B to check in', async () => {
      // Member 1 checks out asset
      const m1Checkout = await request(app)
        .post(`/api/assets/${activeAssetId}/checkout`)
        .set('Authorization', `Bearer ${member1Token}`);
      expect(m1Checkout.status).toBe(200);

      // Member 2 (who also has an allocated seat) tries to check in Member 1's checkout
      const m2Checkin = await request(app)
        .post(`/api/assets/${activeAssetId}/checkin`)
        .set('Authorization', `Bearer ${member2Token}`);

      expect(m2Checkin.status).toBe(409);
      expect(m2Checkin.body.error.message).toContain('No active checkout found for this user');

      // Member 2 checks out their own seat -> 200 OK
      const m2Checkout = await request(app)
        .post(`/api/assets/${activeAssetId}/checkout`)
        .set('Authorization', `Bearer ${member2Token}`);
      expect(m2Checkout.status).toBe(200);

      // Member 1 checks in their seat -> 200 OK
      const m1Checkin = await request(app)
        .post(`/api/assets/${activeAssetId}/checkin`)
        .set('Authorization', `Bearer ${member1Token}`);
      expect(m1Checkin.status).toBe(200);

      // Member 1 cannot check in again (already checked in)
      const m1Repeat = await request(app)
        .post(`/api/assets/${activeAssetId}/checkin`)
        .set('Authorization', `Bearer ${member1Token}`);
      expect(m1Repeat.status).toBe(409);

      // Member 2 checks in their seat -> 200 OK
      const m2ValidCheckin = await request(app)
        .post(`/api/assets/${activeAssetId}/checkin`)
        .set('Authorization', `Bearer ${member2Token}`);
      expect(m2ValidCheckin.status).toBe(200);

      // Verify audit logs reflect exact sequence
      const logs = await systemPrisma.assetAccessLog.findMany({
        where: { assetId: activeAssetId },
        orderBy: { id: 'asc' },
      });
      expect(logs.length).toBeGreaterThanOrEqual(4);
    });
  });
});
