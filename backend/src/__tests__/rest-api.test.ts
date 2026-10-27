// ==============================================================================
// AssetVault: Comprehensive REST API Integration Test Suite
// Course: VIT, BCSE307L Database Systems (Fall 2026-27)
// Covers:
//   1. Standard pagination metadata (page, limit, total, totalPages, hasNext, hasPrev)
//   2. Multi-field filtering (assets and licenses)
//   3. Soft delete and restore lifecycle (assets and licenses)
//   4. Category hierarchy cycle prevention (409) and child-guard deletion (409)
//   5. License seat capacity allocation and 409 conflict over-allocation
//   6. Seat-gated asset checkout and download (403 forbidden when seat is missing)
//   7. License key masking in list vs unmasking in detail with audit trail
//   8. All-or-nothing CSV bulk upload rollback on invalid row
//   9. Error code mapping (Prisma P2002 unique, P2025 not found -> 409/404)
//  10. Real-time PostgreSQL reporting views and window functions
// ==============================================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { prismaForRequest } from '../config/prisma';

const systemPrisma = prismaForRequest({ isSuperAdmin: true });

describe('AssetVault REST API & Advanced Database Business Logic Suite', () => {
  let adminToken: string;
  let memberToken: string;
  let superAdminToken: string;
  let tenantId: string;
  let adminUserId: string;
  let memberUserId: string;
  let vendorId: string;
  let testAssetId: string;
  let testLicenseId: string;
  let testLicenseKey: string;

  beforeAll(async () => {
    // 1. Authenticate TechCorp Tenant Admin
    const adminLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'techcorp.admin@techcorp.io', password: 'Password123!' });
    expect(adminLoginRes.status).toBe(200);
    adminToken = adminLoginRes.body.data.accessToken;
    tenantId = adminLoginRes.body.data.user.tenantId;
    adminUserId = adminLoginRes.body.data.user.id;

    // 2. Authenticate TechCorp Member
    const memberLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'techcorp.dev1@techcorp.io', password: 'Password123!' });
    expect(memberLoginRes.status).toBe(200);
    memberToken = memberLoginRes.body.data.accessToken;
    memberUserId = memberLoginRes.body.data.user.id;

    // 3. Authenticate Platform Super Admin
    const superAdminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'superadmin@assetvault.io', password: 'Password123!' });
    expect(superAdminRes.status).toBe(200);
    superAdminToken = superAdminRes.body.data.accessToken;

    // 4. Retrieve or create a test vendor for TechCorp
    let vendor = await systemPrisma.vendor.findFirst({ where: { tenantId } });
    if (!vendor) {
      vendor = await systemPrisma.vendor.create({
        data: {
          tenantId,
          name: 'JetBrains Test Systems',
          contactEmail: 'sales@jetbrains.internal',
        },
      });
    }
    vendorId = vendor.id;

    // 5. Create a dedicated test asset
    const asset = await systemPrisma.asset.create({
      data: {
        tenantId,
        ownerId: adminUserId,
        name: 'Design System Master Tokens',
        assetCode: `TEST-AST-${Date.now()}`,
        assetType: 'DOCUMENT',
        status: 'ACTIVE',
        versions: {
          create: {
            versionNo: 1,
            fileUrl: 'https://cdn.assetvault.internal/files/tokens-v1.json',
            fileSizeBytes: 10240n,
            checksumSha256: 'a1b2c3d4e5f600112233445566778899aabbccddeeff00112233445566778899',
            changeNotes: 'Initial commit of tokens',
            uploadedBy: adminUserId,
          },
        },
      },
    });
    testAssetId = asset.id;

    // 6. Create a dedicated 1-seat test license
    testLicenseKey = `INTELLI-KEY-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const license = await systemPrisma.license.create({
      data: {
        tenantId,
        vendorId,
        licenseTypeId: 1,
        name: `IntelliJ IDEA Unit License ${Date.now()}`,
        licenseKey: testLicenseKey,
        totalSeats: 1,
        cost: 299.0,
        currency: 'USD',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        status: 'ACTIVE',
      },
    });
    testLicenseId = license.id;
  });

  // ----------------------------------------------------------------------------
  // 1. Pagination & Metadata
  // ----------------------------------------------------------------------------
  describe('1. Shared Pagination & Metadata Contract', () => {
    it('returns standardized pagination metadata (page, limit, total, totalPages, hasNext, hasPrev)', async () => {
      const res = await request(app)
        .get('/api/assets?page=1&limit=2&sort=name&order=asc')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toBeDefined();

      const { meta } = res.body;
      expect(meta.page).toBe(1);
      expect(meta.limit).toBe(2);
      expect(typeof meta.total).toBe('number');
      expect(typeof meta.totalPages).toBe('number');
      expect(typeof meta.hasNext).toBe('boolean');
      expect(typeof meta.hasPrev).toBe('boolean');
      expect(meta.hasPrev).toBe(false);
    });
  });

  // ----------------------------------------------------------------------------
  // 2. Multi-Field Resource Filtering
  // ----------------------------------------------------------------------------
  describe('2. Multi-Field Filtering', () => {
    it('filters assets by search keyword and assetType correctly', async () => {
      const res = await request(app)
        .get('/api/assets?q=Design&assetType=DOCUMENT')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      const match = res.body.data.find((a: any) => a.asset_id === testAssetId || a.id === testAssetId);
      expect(match).toBeDefined();
    });

    it('filters licenses by status and cost bounds', async () => {
      const res = await request(app)
        .get('/api/licenses?status=ACTIVE&minCost=100&maxCost=1000')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  // ----------------------------------------------------------------------------
  // 3. Soft Delete & Restore Lifecycle
  // ----------------------------------------------------------------------------
  describe('3. Soft Delete & Restore Lifecycle', () => {
    it('soft deletes asset and restores it successfully', async () => {
      // 1. Soft delete
      const deleteRes = await request(app)
        .delete(`/api/assets/${testAssetId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.data.message).toContain('trash');

      // 2. Fetch deleted asset -> returns 404
      const fetchDeleted = await request(app)
        .get(`/api/assets/${testAssetId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(fetchDeleted.status).toBe(404);

      // 3. Restore asset
      const restoreRes = await request(app)
        .post(`/api/assets/${testAssetId}/restore`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(restoreRes.status).toBe(200);
      expect(restoreRes.body.data.deletedAt).toBeNull();

      // 4. Fetch restored asset -> returns 200
      const fetchRestored = await request(app)
        .get(`/api/assets/${testAssetId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(fetchRestored.status).toBe(200);
      expect(fetchRestored.body.data.id).toBe(testAssetId);
    });
  });

  // ----------------------------------------------------------------------------
  // 4. Category Cycle Prevention & Child Deletion Guard
  // ----------------------------------------------------------------------------
  describe('4. Category Hierarchy: Cycle Prevention & Referential Guards', () => {
    it('blocks category cyclic dependencies and rejects deletion of parent category with children', async () => {
      // 1. Create parent category A
      const catARes = await request(app)
        .post('/api/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: `Parent Cat ${Date.now()}` });
      expect(catARes.status).toBe(201);
      const catAId = catARes.body.data.id;

      // 2. Create child category B under A
      const catBRes = await request(app)
        .post('/api/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: `Child Cat ${Date.now()}`, parentId: catAId });
      expect(catBRes.status).toBe(201);
      const catBId = catBRes.body.data.id;

      // 3. Attempt to set A's parent to B (Cycle A -> B -> A!)
      const cycleRes = await request(app)
        .patch(`/api/categories/${catAId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ parentId: catBId });
      expect(cycleRes.status).toBe(409);
      expect(cycleRes.body.error.message).toContain('Cyclic category dependency detected');

      // 4. Attempt to delete category A while it still has child B
      const deleteParentRes = await request(app)
        .delete(`/api/categories/${catAId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(deleteParentRes.status).toBe(409);
      expect(deleteParentRes.body.error.message).toContain('Cannot delete category with child subcategories');

      // 5. Clean up child first, then parent
      await request(app).delete(`/api/categories/${catBId}`).set('Authorization', `Bearer ${adminToken}`);
      const cleanParentRes = await request(app)
        .delete(`/api/categories/${catAId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(cleanParentRes.status).toBe(200);
    });
  });

  // ----------------------------------------------------------------------------
  // 5. License Seat Allocation & Over-Allocation Conflict
  // ----------------------------------------------------------------------------
  describe('5. License Seat Allocation & sp_allocate_license_seat', () => {
    let allocationId: string;

    it('allocates seat up to limit, blocks over-allocation with 409, and frees seat on release', async () => {
      // 1. Allocate seat 1/1 to admin
      const alloc1Res = await request(app)
        .post(`/api/licenses/${testLicenseId}/allocate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: adminUserId });
      expect(alloc1Res.status).toBe(201);
      expect(alloc1Res.body.data.success).toBe(true);
      allocationId = alloc1Res.body.data.allocationId;

      // 2. Attempt second allocation on 1-seat license -> 409 Conflict
      const alloc2Res = await request(app)
        .post(`/api/licenses/${testLicenseId}/allocate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: memberUserId });
      expect(alloc2Res.status).toBe(409);
      expect(alloc2Res.body.error.message).toMatch(/(No seats available|License seats exhausted|BUSINESS_RULE_VIOLATION)/i);

      // 3. Release the allocated seat
      const releaseRes = await request(app)
        .post(`/api/licenses/${testLicenseId}/release`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ allocationId, reason: 'Completed test run' });
      expect(releaseRes.status).toBe(200);
      expect(releaseRes.body.data.success).toBe(true);

      // 4. Now allocation for member succeeds
      const allocMemberRes = await request(app)
        .post(`/api/licenses/${testLicenseId}/allocate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: memberUserId });
      expect(allocMemberRes.status).toBe(201);
    });
  });

  // ----------------------------------------------------------------------------
  // 6. Seat-Gated Asset Checkout & Download
  // ----------------------------------------------------------------------------
  describe('6. Seat-Gated Asset Checkout & Download', () => {
    it('enforces seat requirement: 403 when uncovered, 200 after seat allocation', async () => {
      // 1. Create a standalone asset with no covering license
      const unlinkedAsset = await systemPrisma.asset.create({
        data: {
          tenantId,
          ownerId: adminUserId,
          name: 'Proprietary Shader Plugin',
          assetCode: `SHD-${Date.now()}`,
          assetType: 'SOFTWARE',
          status: 'ACTIVE',
          versions: {
            create: {
              versionNo: 1,
              fileUrl: 'https://storage.assetvault.internal/plugins/shader.bin',
              fileSizeBytes: 5000000n,
              checksumSha256: 'b1c2d3e4f500112233445566778899aabbccddeeff00112233445566778899aa',
            },
          },
        },
      });

      // 2. Attempt checkout without license link -> 403 Forbidden
      const unlinkedCheckout = await request(app)
        .post(`/api/assets/${unlinkedAsset.id}/checkout`)
        .set('Authorization', `Bearer ${memberToken}`);
      expect(unlinkedCheckout.status).toBe(403);
      expect(unlinkedCheckout.body.error.message).toContain('active seat allocation');

      // 3. Attempt download without seat -> 403 Forbidden
      const unlinkedDownload = await request(app)
        .get(`/api/assets/${unlinkedAsset.id}/download`)
        .set('Authorization', `Bearer ${memberToken}`);
      expect(unlinkedDownload.status).toBe(403);

      // 4. Link asset to testLicenseId (where member holds an allocated seat!)
      await request(app)
        .post(`/api/licenses/${testLicenseId}/link-asset/${unlinkedAsset.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      // 5. Member checks out asset -> 200 OK
      const checkoutRes = await request(app)
        .post(`/api/assets/${unlinkedAsset.id}/checkout`)
        .set('Authorization', `Bearer ${memberToken}`);
      expect(checkoutRes.status).toBe(200);
      expect(checkoutRes.body.data.message).toBe('Asset successfully checked out');

      // 6. Member downloads asset -> 200 OK
      const downloadRes = await request(app)
        .get(`/api/assets/${unlinkedAsset.id}/download`)
        .set('Authorization', `Bearer ${memberToken}`);
      expect(downloadRes.status).toBe(200);
      expect(downloadRes.body.data.fileUrl).toBe('https://storage.assetvault.internal/plugins/shader.bin');

      // 7. Member checks in asset
      const checkinRes = await request(app)
        .post(`/api/assets/${unlinkedAsset.id}/checkin`)
        .set('Authorization', `Bearer ${memberToken}`);
      expect(checkinRes.status).toBe(200);

      // 8. Access logs recorded for this asset
      const logsRes = await request(app)
        .get(`/api/assets/${unlinkedAsset.id}/access-logs`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(logsRes.status).toBe(200);
      expect(logsRes.body.data.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ----------------------------------------------------------------------------
  // 7. License Key Masking vs Reveal with Audit Trail
  // ----------------------------------------------------------------------------
  describe('7. License Key Masking vs Audited Reveal', () => {
    it('masks license keys in list and reveals key in detail only to Admin while writing audit log', async () => {
      // 1. List endpoint: verify key is masked with ••••••••-XXXX
      const listRes = await request(app)
        .get('/api/licenses')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(listRes.status).toBe(200);
      const found = listRes.body.data.find((l: any) => l.license_id === testLicenseId);
      if (found) {
        expect(found.license_key).toMatch(/^•{8}-[A-Za-z0-9-]+$/);
      }

      // 2. Member detail lookup: key is masked
      const memberDetailRes = await request(app)
        .get(`/api/licenses/${testLicenseId}`)
        .set('Authorization', `Bearer ${memberToken}`);
      expect(memberDetailRes.status).toBe(200);
      expect(memberDetailRes.body.data.licenseKey).toMatch(/^•{8}-[A-Za-z0-9-]+$/);

      // 3. Admin detail lookup: reveals actual unmasked key
      const adminDetailRes = await request(app)
        .get(`/api/licenses/${testLicenseId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(adminDetailRes.status).toBe(200);
      expect(adminDetailRes.body.data.licenseKey).toBe(testLicenseKey);

      // 4. Verify that key reveal wrote an audit log entry
      const auditRes = await request(app)
        .get(`/api/audit-logs?tableName=licenses&action=UPDATE`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(auditRes.status).toBe(200);
      expect(auditRes.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ----------------------------------------------------------------------------
  // 8. All-or-Nothing CSV Bulk Import Rollback
  // ----------------------------------------------------------------------------
  describe('8. All-or-Nothing CSV Bulk Import Atomicity', () => {
    it('rolls back all records if any row in the CSV fails validation', async () => {
      const codeValid = `VALID-CSV-${Date.now()}`;
      const codeInvalid = `INVALID-CSV-${Date.now()}`;

      // CSV with Row 1 valid, Row 2 having an invalid asset_type
      const csvBad = `"asset_code","name","asset_type","description"\n` +
        `"${codeValid}","Valid Model Asset","SOFTWARE","Good row"\n` +
        `"${codeInvalid}","Broken Row","NON_EXISTENT_TYPE","Bad row"\n`;

      const importRes = await request(app)
        .post('/api/assets/bulk-import')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Content-Type', 'text/csv')
        .send(csvBad);

      expect(importRes.status).toBe(422);
      expect(importRes.body.error.message).toMatch(/(Import failed|Bulk import validation failed)/i);

      // Verify Row 1 was rolled back and does not exist in DB
      const checkRow1 = await systemPrisma.asset.findFirst({
        where: { tenantId, assetCode: codeValid },
      });
      expect(checkRow1).toBeNull();
    });

    it('successfully imports valid CSV rows with HTTP 201 and sets status to ACTIVE', async () => {
      const code1 = `CSV-OK-1-${Date.now()}`;
      const code2 = `CSV-OK-2-${Date.now()}`;

      const csvGood = `"asset_code","name","asset_type","description"\n` +
        `"${code1}","Bulk Font Asset","FONT","Font file description"\n` +
        `"${code2}","Bulk Image Asset","IMAGE","Image file description"\n`;

      const importRes = await request(app)
        .post('/api/assets/bulk-import')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Content-Type', 'text/csv')
        .send(csvGood);

      expect(importRes.status).toBe(201);
      expect(importRes.body.data.importedCount).toBe(2);

      const asset1 = await systemPrisma.asset.findFirst({
        where: { tenantId, assetCode: code1 },
      });
      const asset2 = await systemPrisma.asset.findFirst({
        where: { tenantId, assetCode: code2 },
      });

      expect(asset1).not.toBeNull();
      expect(asset1?.status).toBe('ACTIVE');
      expect(asset1?.assetType).toBe('FONT');

      expect(asset2).not.toBeNull();
      expect(asset2?.status).toBe('ACTIVE');
      expect(asset2?.assetType).toBe('IMAGE');
    });
  });

  // ----------------------------------------------------------------------------
  // 9. Error Code Mappings (Prisma Unique P2002 & Not Found P2025)
  // ----------------------------------------------------------------------------
  describe('9. Error Code Mappings to HTTP Status Codes', () => {
    it('maps unique constraint violation (P2002) to 409 Conflict', async () => {
      const duplicateCode = `DUP-CODE-${Date.now()}`;
      const duplicateRes = await request(app)
        .post('/api/assets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Duplicated Asset Test',
          assetCode: duplicateCode,
          assetType: 'IMAGE',
        });
      expect(duplicateRes.status).toBe(201);

      // Try to insert again with same code
      const dup2 = await request(app)
        .post('/api/assets')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Duplicated Asset Test 2',
          assetCode: duplicateCode,
          assetType: 'IMAGE',
        });
      expect(dup2.status).toBe(409);
      expect(dup2.body.error.code).toMatch(/(CONFLICT|RESOURCE_CONFLICT)/);
    });

    it('maps missing resource to 404 Not Found', async () => {
      const missingRes = await request(app)
        .get('/api/assets/00000000-0000-0000-0000-000000009999')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(missingRes.status).toBe(404);
      expect(missingRes.body.error.code).toBe('NOT_FOUND');
    });
  });

  // ----------------------------------------------------------------------------
  // 10. Analytical Reporting & PostgreSQL Views
  // ----------------------------------------------------------------------------
  describe('10. Reporting Views & Window Functions', () => {
    it('executes fn_tenant_dashboard_stats and returns consolidated KPIs', async () => {
      const res = await request(app)
        .get('/api/reports/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.tenant).toBeDefined();
      expect(res.body.data.stats).toBeDefined();
    });

    it('reads v_license_utilization with calculated seats and percentages', async () => {
      const res = await request(app)
        .get('/api/reports/license-utilization')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('reads v_expiring_licenses with urgency buckets', async () => {
      const res = await request(app)
        .get('/api/reports/expiring-licenses')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('reads v_vendor_spend with financial aggregation per vendor', async () => {
      const res = await request(app)
        .get('/api/reports/vendor-spend')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('calculates monthly running spend using PostgreSQL window function SUM OVER', async () => {
      const res = await request(app)
        .get('/api/reports/spend-by-month')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      if (res.body.data.length > 0) {
        expect(res.body.data[0].month_year).toBeDefined();
        expect(res.body.data[0].running_total_spend).toBeDefined();
      }
    });

    it('ranks top downloaded assets using window function RANK() OVER', async () => {
      const res = await request(app)
        .get('/api/reports/top-assets')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('Super Admin retrieves cross-tenant summary from v_tenant_summary', async () => {
      const res = await request(app)
        .get('/api/platform/overview')
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ----------------------------------------------------------------------------
  // 11. Asset Versioning & Comparison API
  // ----------------------------------------------------------------------------
  describe('11. Asset Versioning & Comparison Payloads', () => {
    it('creates version using backend schema (fileSize, checksum, changelog)', async () => {
      const res = await request(app)
        .post(`/api/assets/${testAssetId}/versions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          fileUrl: 'https://cdn.assetvault.internal/files/tokens-v2.json',
          fileSize: 20480,
          checksum: 'b1b2c3d4e5f600112233445566778899aabbccddeeff00112233445566778899',
          changelog: 'Second release using legacy keys',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.versionNo).toBe(2);
    });

    it('creates version using frontend schema (fileSizeBytes, checksumSha256, changeNotes)', async () => {
      const res = await request(app)
        .post(`/api/assets/${testAssetId}/versions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          fileUrl: 'https://cdn.assetvault.internal/files/tokens-v3.json',
          fileSizeBytes: 30720,
          checksumSha256: 'c1b2c3d4e5f600112233445566778899aabbccddeeff00112233445566778899',
          changeNotes: 'Third release using frontend keys',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.versionNo).toBe(3);
    });

    it('compares versions using ?from=&to= query parameters', async () => {
      const res = await request(app)
        .get(`/api/assets/${testAssetId}/versions/compare?from=1&to=2`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.comparison).toBeDefined();
      expect(res.body.data.comparison.versionDelta).toBe(1);
    });

    it('compares versions using ?v1=&v2= frontend query parameters', async () => {
      const res = await request(app)
        .get(`/api/assets/${testAssetId}/versions/compare?v1=1&v2=3`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.comparison).toBeDefined();
      expect(res.body.data.comparison.versionDelta).toBe(2);
    });
  });

  // ----------------------------------------------------------------------------
  // 12. Notification Automated Expiry Check
  // ----------------------------------------------------------------------------
  describe('12. Notification Automated Expiry Check', () => {
    it('accepts frontend payload with daysAhead and executes check', async () => {
      const res = await request(app)
        .post('/api/notifications/run-expiry-check')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ daysAhead: 30 });

      expect(res.status).toBe(200);
      expect(res.body.data.success).toBe(true);
      expect(res.body.data).toHaveProperty('notificationsGenerated');
    });

    it('GET /api/notifications/stream rejects unauthenticated requests with 401 and accepts Bearer token with 200 text/event-stream', async () => {
      // 1. Unauthenticated request must return 401 Unauthorized
      const unauthRes = await request(app).get('/api/notifications/stream');
      expect(unauthRes.status).toBe(401);

      // 2. Authenticated request with Bearer token must establish text/event-stream connection
      await new Promise<void>((resolve, reject) => {
        request(app)
          .get('/api/notifications/stream')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200)
          .expect('Content-Type', /^text\/event-stream/)
          .buffer(false)
          .parse((res, callback) => {
            res.on('data', (chunk: Buffer) => {
              const text = chunk.toString();
              if (text.includes('event: connected')) {
                (res as any).destroy();
                callback(null, text);
                resolve();
              }
            });
            res.on('error', () => {
              resolve();
            });
          })
          .end((err) => {
            if (err && !err.message?.includes('socket') && !err.message?.includes('aborted')) {
              reject(err);
            } else {
              resolve();
            }
          });
      });
    });
  });

  afterAll(async () => {
    // 1. Clean up test licenses and related records
    const testLicenses = await systemPrisma.license.findMany({
      where: {
        licenseKey: { startsWith: 'INTELLI-KEY-' },
      },
      select: { id: true },
    });
    const testLicenseIds = testLicenses.map((l) => l.id);

    if (testLicenseIds.length > 0) {
      await systemPrisma.assetLicense.deleteMany({
        where: { licenseId: { in: testLicenseIds } },
      });
      await systemPrisma.licenseAllocation.deleteMany({
        where: { licenseId: { in: testLicenseIds } },
      });
      await systemPrisma.licenseRenewal.deleteMany({
        where: { licenseId: { in: testLicenseIds } },
      });
      await systemPrisma.assetAccessLog.deleteMany({
        where: { licenseId: { in: testLicenseIds } },
      });
      await systemPrisma.notification.deleteMany({
        where: { licenseId: { in: testLicenseIds } },
      });
      await systemPrisma.license.deleteMany({
        where: { id: { in: testLicenseIds } },
      });
    }

    // 2. Clean up test assets and related records
    const testAssets = await systemPrisma.asset.findMany({
      where: {
        OR: [
          { assetCode: { startsWith: 'TEST-AST-' } },
          { assetCode: { startsWith: 'SHD-' } },
          { assetCode: { startsWith: 'DUP-CODE-' } },
          { assetCode: { startsWith: 'SEC-SCAN-' } },
          { assetCode: { startsWith: 'CSV-OK-' } },
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
