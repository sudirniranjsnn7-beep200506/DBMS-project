// ==============================================================================
// AssetVault: Query Parameter Validation, Dynamic Sorting & 400 vs 422 Reconciliation Tests
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { prisma as systemPrisma } from '../config/prisma';
import { Prisma } from '@prisma/client';

describe('Query Parameter Validation, Dynamic Sorting & Error Reconciliation Suite', () => {
  let adminToken: string;
  let tenantId: string;
  let adminUserId: string;
  let testAssetId: string;
  let createdNotificationIds: string[] = [];
  let createdLogIds: bigint[] = [];

  beforeAll(async () => {
    // 1. Authenticate Tenant Admin
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'techcorp.admin@techcorp.io', password: 'Password123!' });
    expect(loginRes.status).toBe(200);
    adminToken = loginRes.body.data.accessToken;
    tenantId = loginRes.body.data.user.tenantId;
    adminUserId = loginRes.body.data.user.id;

    // 2. Create test asset via REST API to ensure proper tenant context
    const assetRes = await request(app)
      .post('/api/assets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Query Validation Test Asset',
        assetCode: `QV-TEST-${Date.now()}`,
        assetType: 'DOCUMENT',
      });
    expect(assetRes.status).toBe(201);
    testAssetId = assetRes.body.data.id;

    // 3. Seed access logs and notifications inside tenant-scoped transaction
    const now = Date.now();
    await systemPrisma.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT 
          set_config('app.current_tenant_id', ${tenantId}, true),
          set_config('app.current_user_id', ${adminUserId}, true),
          set_config('app.is_super_admin', 'true', true);`
      );

      const log1 = await tx.assetAccessLog.create({
        data: {
          assetId: testAssetId,
          userId: adminUserId,
          action: 'VIEW',
          accessedAt: new Date(now - 10000),
        },
      });
      const log2 = await tx.assetAccessLog.create({
        data: {
          assetId: testAssetId,
          userId: adminUserId,
          action: 'DOWNLOAD',
          accessedAt: new Date(now - 5000),
        },
      });
      const log3 = await tx.assetAccessLog.create({
        data: {
          assetId: testAssetId,
          userId: adminUserId,
          action: 'CHECKOUT',
          accessedAt: new Date(now),
        },
      });
      createdLogIds.push(log1.id, log2.id, log3.id);

      const notif1 = await tx.notification.create({
        data: {
          tenantId,
          userId: adminUserId,
          type: 'SYSTEM',
          message: 'System Alert Alpha',
          isRead: false,
          createdAt: new Date(now - 60000),
        },
      });
      const notif2 = await tx.notification.create({
        data: {
          tenantId,
          userId: adminUserId,
          type: 'EXPIRY_30',
          message: 'License Expiry Warning Beta',
          isRead: true,
          createdAt: new Date(now - 30000),
        },
      });
      const notif3 = await tx.notification.create({
        data: {
          tenantId,
          userId: adminUserId,
          type: 'OVER_ALLOCATION',
          message: 'Over Allocation Alert Gamma',
          isRead: false,
          createdAt: new Date(now),
        },
      });
      createdNotificationIds.push(notif1.id, notif2.id, notif3.id);
    });
  });

  afterAll(async () => {
    await systemPrisma.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT 
          set_config('app.current_tenant_id', ${tenantId}, true),
          set_config('app.current_user_id', ${adminUserId}, true),
          set_config('app.is_super_admin', 'true', true);`
      );

      // Clean up created access logs
      if (createdLogIds.length > 0) {
        await tx.assetAccessLog.deleteMany({
          where: { id: { in: createdLogIds } },
        });
      }
      // Clean up created notifications
      if (createdNotificationIds.length > 0) {
        await tx.notification.deleteMany({
          where: { id: { in: createdNotificationIds } },
        });
      }
      // Clean up created asset
      if (testAssetId) {
        await tx.asset.delete({
          where: { id: testAssetId },
        });
      }
    });
  });

  // ============================================================================
  // 1. GET /api/assets/:id/access-logs Query Validation & Never 500
  // ============================================================================
  describe('1. GET /api/assets/:id/access-logs Query Validation', () => {
    it('rejects non-numeric cursor with 400 VALIDATION_ERROR (prevents 500 BigInt conversion)', async () => {
      const res = await request(app)
        .get(`/api/assets/${testAssetId}/access-logs?cursor=not-a-number`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.status).toBe('error');
    });

    it('rejects limit out of bounds (limit=0 and limit=101) with 400 VALIDATION_ERROR', async () => {
      const resLow = await request(app)
        .get(`/api/assets/${testAssetId}/access-logs?limit=0`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resLow.status).toBe(400);
      expect(resLow.body.error.code).toBe('VALIDATION_ERROR');

      const resHigh = await request(app)
        .get(`/api/assets/${testAssetId}/access-logs?limit=101`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resHigh.status).toBe(400);
      expect(resHigh.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects non-numeric limit with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .get(`/api/assets/${testAssetId}/access-logs?limit=twenty`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects invalid dateFrom and dateTo strings with 400 VALIDATION_ERROR (prevents 500 DB timestamp error)', async () => {
      const resBadDate = await request(app)
        .get(`/api/assets/${testAssetId}/access-logs?dateFrom=not-an-iso-date`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resBadDate.status).toBe(400);
      expect(resBadDate.body.error.code).toBe('VALIDATION_ERROR');

      const resBadDate2 = await request(app)
        .get(`/api/assets/${testAssetId}/access-logs?dateTo=2026-99-99`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resBadDate2.status).toBe(400);
      expect(resBadDate2.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects invalid action enum with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .get(`/api/assets/${testAssetId}/access-logs?action=INVALID_ACTION`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects invalid sort field and invalid order with 400 VALIDATION_ERROR', async () => {
      const resSort = await request(app)
        .get(`/api/assets/${testAssetId}/access-logs?sort=unsupportedField`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resSort.status).toBe(400);
      expect(resSort.body.error.code).toBe('VALIDATION_ERROR');

      const resOrder = await request(app)
        .get(`/api/assets/${testAssetId}/access-logs?order=random`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resOrder.status).toBe(400);
      expect(resOrder.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('accepts valid query parameters and returns 200 with standard pagination shape', async () => {
      const res = await request(app)
        .get(`/api/assets/${testAssetId}/access-logs?page=1&limit=10&action=VIEW&sort=accessedAt&order=desc`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toHaveProperty('page', 1);
      expect(res.body.meta).toHaveProperty('limit', 10);
    });

    it('applies params.sort and params.order correctly on access logs', async () => {
      // 1. Sort accessedAt ascending
      const resAsc = await request(app)
        .get(`/api/assets/${testAssetId}/access-logs?sort=accessedAt&order=asc&limit=10`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resAsc.status).toBe(200);
      const dataAsc = resAsc.body.data;
      expect(dataAsc.length).toBeGreaterThanOrEqual(2);
      for (let i = 0; i < dataAsc.length - 1; i++) {
        const t1 = new Date(dataAsc[i].accessedAt).getTime();
        const t2 = new Date(dataAsc[i + 1].accessedAt).getTime();
        expect(t1).toBeLessThanOrEqual(t2);
      }

      // 2. Sort accessedAt descending
      const resDesc = await request(app)
        .get(`/api/assets/${testAssetId}/access-logs?sort=accessedAt&order=desc&limit=10`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resDesc.status).toBe(200);
      const dataDesc = resDesc.body.data;
      expect(dataDesc.length).toBeGreaterThanOrEqual(2);
      for (let i = 0; i < dataDesc.length - 1; i++) {
        const t1 = new Date(dataDesc[i].accessedAt).getTime();
        const t2 = new Date(dataDesc[i + 1].accessedAt).getTime();
        expect(t1).toBeGreaterThanOrEqual(t2);
      }
    });

    it('accepts valid numeric cursor pagination and returns nextCursor without 500 error', async () => {
      const cursorVal = createdLogIds[2] ? createdLogIds[2].toString() : '1';
      const res = await request(app)
        .get(`/api/assets/${testAssetId}/access-logs?cursor=${cursorVal}&limit=2`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.meta).toHaveProperty('limit', 2);
      expect(res.body.meta).toHaveProperty('hasMore');
    });
  });

  // ============================================================================
  // 2. GET /api/notifications Query Validation & Never 500
  // ============================================================================
  describe('2. GET /api/notifications Query Validation', () => {
    it('rejects non-numeric cursor with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .get('/api/notifications?cursor=invalid-cursor')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects limit out of bounds (limit=0 and limit=101) with 400 VALIDATION_ERROR', async () => {
      const resZero = await request(app)
        .get('/api/notifications?limit=0')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resZero.status).toBe(400);
      expect(resZero.body.error.code).toBe('VALIDATION_ERROR');

      const resTooBig = await request(app)
        .get('/api/notifications?limit=101')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resTooBig.status).toBe(400);
      expect(resTooBig.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects invalid dateFrom and dateTo strings with 400 VALIDATION_ERROR', async () => {
      const resBadDate = await request(app)
        .get('/api/notifications?dateFrom=random-text')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resBadDate.status).toBe(400);
      expect(resBadDate.body.error.code).toBe('VALIDATION_ERROR');

      const resBadDate2 = await request(app)
        .get('/api/notifications?dateTo=2026-02-31')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resBadDate2.status).toBe(400);
      expect(resBadDate2.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects invalid isRead and notification type with 400 VALIDATION_ERROR', async () => {
      const resIsRead = await request(app)
        .get('/api/notifications?isRead=yes')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resIsRead.status).toBe(400);
      expect(resIsRead.body.error.code).toBe('VALIDATION_ERROR');

      const resType = await request(app)
        .get('/api/notifications?type=NOT_A_VALID_TYPE')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resType.status).toBe(400);
      expect(resType.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects invalid sort field and order with 400 VALIDATION_ERROR', async () => {
      const resSort = await request(app)
        .get('/api/notifications?sort=invalid_column')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resSort.status).toBe(400);
      expect(resSort.body.error.code).toBe('VALIDATION_ERROR');

      const resOrder = await request(app)
        .get('/api/notifications?order=sideways')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resOrder.status).toBe(400);
      expect(resOrder.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('accepts valid query parameters and returns 200 with standard pagination shape', async () => {
      const res = await request(app)
        .get('/api/notifications?page=1&limit=10&isRead=false&sort=createdAt&order=desc')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toHaveProperty('page', 1);
      expect(res.body.meta).toHaveProperty('limit', 10);
    });

    it('applies params.sort and params.order correctly on notifications', async () => {
      // 1. Sort createdAt ascending
      const resAsc = await request(app)
        .get('/api/notifications?sort=createdAt&order=asc&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resAsc.status).toBe(200);
      const dataAsc = resAsc.body.data;
      expect(dataAsc.length).toBeGreaterThanOrEqual(2);
      for (let i = 0; i < dataAsc.length - 1; i++) {
        const t1 = new Date(dataAsc[i].createdAt).getTime();
        const t2 = new Date(dataAsc[i + 1].createdAt).getTime();
        expect(t1).toBeLessThanOrEqual(t2);
      }

      // 2. Sort createdAt descending
      const resDesc = await request(app)
        .get('/api/notifications?sort=createdAt&order=desc&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resDesc.status).toBe(200);
      const dataDesc = resDesc.body.data;
      expect(dataDesc.length).toBeGreaterThanOrEqual(2);
      for (let i = 0; i < dataDesc.length - 1; i++) {
        const t1 = new Date(dataDesc[i].createdAt).getTime();
        const t2 = new Date(dataDesc[i + 1].createdAt).getTime();
        expect(t1).toBeGreaterThanOrEqual(t2);
      }
    });

    it('filters notifications by date range with valid ISO date strings', async () => {
      const now = new Date();
      const past = new Date(now.getTime() - 120000).toISOString();
      const future = new Date(now.getTime() + 120000).toISOString();

      const res = await request(app)
        .get(`/api/notifications?dateFrom=${encodeURIComponent(past)}&dateTo=${encodeURIComponent(future)}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ============================================================================
  // 3. Status Code Reconciliation: 400 VALIDATION_ERROR vs 422 UNPROCESSABLE_ENTITY
  // ============================================================================
  describe('3. HTTP 400 vs 422 Reconciliation', () => {
    it('returns 400 with VALIDATION_ERROR for syntax/schema input validation failures', async () => {
      const res = await request(app)
        .post('/api/licenses')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Bad Schema License',
          totalSeats: -10, // Invalid seat count
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 422 with UNPROCESSABLE_ENTITY for domain business rule rejections (CSV bulk import invalid rows)', async () => {
      const badCsv = `"asset_code","name","asset_type","description"\n` +
        `"VALID_CODE_${Date.now()}","Valid Name","NON_EXISTENT_TYPE","Bad row"\n`;

      const res = await request(app)
        .post('/api/assets/bulk-import')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Content-Type', 'text/csv')
        .send(badCsv);

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });
  });
});
