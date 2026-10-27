import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { prisma, prismaForRequest, systemPrisma } from '../config/prisma';
import { NotFoundError } from '../errors/AppError';

describe('Cross-Tenant Defense in Depth Security Suite', () => {
  let tenantAMemberToken: string;
  let tenantAId: string;
  let tenantAAssetId: string;
  let tenantBId: string;
  let tenantBUserId: string;
  let tenantBAssetId: string;

  beforeAll(async () => {
    // 1. Authenticate Tenant A Member (TechCorp)
    const loginMemberA = await request(app)
      .post('/api/auth/login')
      .send({ email: 'techcorp.dev1@techcorp.io', password: 'Password123!' });
    expect(loginMemberA.status).toBe(200);
    tenantAMemberToken = loginMemberA.body.data.accessToken;
    tenantAId = loginMemberA.body.data.user.tenantId;

    // 2. Fetch Tenant A asset for positive isolation comparison
    const assetA = await systemPrisma.asset.findFirst({
      where: { tenantId: tenantAId, deletedAt: null },
    });
    expect(assetA).toBeDefined();
    tenantAAssetId = assetA!.id;

    // 3. Fetch Tenant B (InnovateLabs) details using systemPrisma
    const tenantB = await systemPrisma.tenant.findUnique({
      where: { slug: 'innovatelabs' },
      include: {
        users: { take: 1 },
        assets: { take: 1 },
      },
    });

    expect(tenantB).toBeDefined();
    tenantBId = tenantB!.id;
    expect(tenantB!.users.length).toBeGreaterThan(0);
    expect(tenantB!.assets.length).toBeGreaterThan(0);
    tenantBUserId = tenantB!.users[0]!.id;
    tenantBAssetId = tenantB!.assets[0]!.id;
  });

  // ----------------------------------------------------------------------------
  // Part 1: HTTP API Cross-Tenant Endpoint Probes as MEMBER of Tenant A
  // ----------------------------------------------------------------------------
  describe('1. HTTP API Cross-Tenant Endpoint Probes as Tenant A Member', () => {
    it('blocks GET /api/tenants/<tenant B id> -> 404 Not Found (no cross-tenant leakage)', async () => {
      const res = await request(app)
        .get(`/api/tenants/${tenantBId}`)
        .set('Authorization', `Bearer ${tenantAMemberToken}`);

      // Before fix: returned 200 under superuser role; now strictly 404
      expect(res.status).toBe(404);
      expect(res.body.error?.message).toMatch(/not found/i);
    });

    it('allows GET /api/tenants/<tenant A id> -> 200 OK (own tenant data)', async () => {
      const res = await request(app)
        .get(`/api/tenants/${tenantAId}`)
        .set('Authorization', `Bearer ${tenantAMemberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(tenantAId);
      expect(res.body.data.slug).toBe('techcorp');
    });

    it('allows GET /api/tenants/current -> 200 OK (own tenant alias)', async () => {
      const res = await request(app)
        .get('/api/tenants/current')
        .set('Authorization', `Bearer ${tenantAMemberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(tenantAId);
    });

    it('blocks GET /api/users/<user in B> -> 403 Forbidden (RBAC blocks MEMBER users:read)', async () => {
      const res = await request(app)
        .get(`/api/users/${tenantBUserId}`)
        .set('Authorization', `Bearer ${tenantAMemberToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('FORBIDDEN');
    });

    it('blocks GET /api/assets/<asset in B> -> 404 Not Found (tenant asset isolation)', async () => {
      const res = await request(app)
        .get(`/api/assets/${tenantBAssetId}`)
        .set('Authorization', `Bearer ${tenantAMemberToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error?.message).toMatch(/not found/i);
    });

    it('allows GET /api/assets/<asset in A> -> 200 OK (own tenant asset readable by MEMBER)', async () => {
      const res = await request(app)
        .get(`/api/assets/${tenantAAssetId}`)
        .set('Authorization', `Bearer ${tenantAMemberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(tenantAAssetId);
    });

    it('blocks PATCH /api/tenants/<tenant B id> -> 403 Forbidden (RBAC: tenants:manage_platform)', async () => {
      const res = await request(app)
        .patch(`/api/tenants/${tenantBId}`)
        .set('Authorization', `Bearer ${tenantAMemberToken}`)
        .send({ name: 'Tampered Name' });

      expect(res.status).toBe(403);
    });

    it('blocks DELETE /api/tenants/<tenant B id> -> 403 Forbidden (RBAC: tenants:manage_platform)', async () => {
      const res = await request(app)
        .delete(`/api/tenants/${tenantBId}`)
        .set('Authorization', `Bearer ${tenantAMemberToken}`);

      expect(res.status).toBe(403);
    });

    it('blocks PATCH /api/users/<user in B> -> 403 Forbidden (RBAC: users:manage)', async () => {
      const res = await request(app)
        .patch(`/api/users/${tenantBUserId}`)
        .set('Authorization', `Bearer ${tenantAMemberToken}`)
        .send({ fullName: 'Tampered Name' });

      expect(res.status).toBe(403);
    });

    it('blocks DELETE /api/users/<user in B> -> 403 Forbidden (RBAC: users:manage)', async () => {
      const res = await request(app)
        .delete(`/api/users/${tenantBUserId}`)
        .set('Authorization', `Bearer ${tenantAMemberToken}`);

      expect(res.status).toBe(403);
    });

    it('blocks PATCH /api/assets/<asset in B> -> 403 Forbidden (RBAC: assets:update)', async () => {
      const res = await request(app)
        .patch(`/api/assets/${tenantBAssetId}`)
        .set('Authorization', `Bearer ${tenantAMemberToken}`)
        .send({ name: 'Tampered Name' });

      expect(res.status).toBe(403);
    });

    it('blocks DELETE /api/assets/<asset in B> -> 403 Forbidden (RBAC: assets:delete)', async () => {
      const res = await request(app)
        .delete(`/api/assets/${tenantBAssetId}`)
        .set('Authorization', `Bearer ${tenantAMemberToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ----------------------------------------------------------------------------
  // Part 2: prismaForRequest Layer 2 Scoping (findUnique / update / delete)
  // ----------------------------------------------------------------------------
  describe('2. prismaForRequest Layer 2 Scoping & Defense in Depth', () => {
    it('scopes findUnique on tenant model: returns null for foreign tenant ID', async () => {
      const scopedPrisma = prismaForRequest({
        tenantId: tenantAId,
        isSuperAdmin: false,
      });

      const foreignTenant = await scopedPrisma.tenant.findUnique({
        where: { id: tenantBId },
      });
      expect(foreignTenant).toBeNull();

      const ownTenant = await scopedPrisma.tenant.findUnique({
        where: { id: tenantAId },
      });
      expect(ownTenant).not.toBeNull();
      expect(ownTenant!.id).toBe(tenantAId);
    });

    it('scopes findUnique on asset model: returns null for foreign asset ID', async () => {
      const scopedPrisma = prismaForRequest({
        tenantId: tenantAId,
        isSuperAdmin: false,
      });

      const foreignAsset = await scopedPrisma.asset.findUnique({
        where: { id: tenantBAssetId },
      });
      expect(foreignAsset).toBeNull();

      const ownAsset = await scopedPrisma.asset.findUnique({
        where: { id: tenantAAssetId },
      });
      expect(ownAsset).not.toBeNull();
      expect(ownAsset!.id).toBe(tenantAAssetId);
    });

    it('scopes findUnique on user model: returns null for foreign user ID', async () => {
      const scopedPrisma = prismaForRequest({
        tenantId: tenantAId,
        isSuperAdmin: false,
      });

      const foreignUser = await scopedPrisma.user.findUnique({
        where: { id: tenantBUserId },
      });
      expect(foreignUser).toBeNull();
    });

    it('scopes update on asset model: throws NotFoundError on cross-tenant update attempt', async () => {
      const scopedPrisma = prismaForRequest({
        tenantId: tenantAId,
        isSuperAdmin: false,
      });

      await expect(
        scopedPrisma.asset.update({
          where: { id: tenantBAssetId },
          data: { name: 'Attempted Cross-Tenant Tamper' },
        })
      ).rejects.toThrow(NotFoundError);
    });

    it('scopes delete on asset model: throws NotFoundError on cross-tenant delete attempt', async () => {
      const scopedPrisma = prismaForRequest({
        tenantId: tenantAId,
        isSuperAdmin: false,
      });

      await expect(
        scopedPrisma.asset.delete({
          where: { id: tenantBAssetId },
        })
      ).rejects.toThrow(NotFoundError);
    });

    it('scopes update on tenant model: throws NotFoundError on cross-tenant tenant update attempt', async () => {
      const scopedPrisma = prismaForRequest({
        tenantId: tenantAId,
        isSuperAdmin: false,
      });

      await expect(
        scopedPrisma.tenant.update({
          where: { id: tenantBId },
          data: { name: 'Attempted Cross-Tenant Tamper' },
        })
      ).rejects.toThrow(NotFoundError);
    });

    it('scopes delete on tenant model: throws NotFoundError on cross-tenant tenant delete attempt', async () => {
      const scopedPrisma = prismaForRequest({
        tenantId: tenantAId,
        isSuperAdmin: false,
      });

      await expect(
        scopedPrisma.tenant.delete({
          where: { id: tenantBId },
        })
      ).rejects.toThrow(NotFoundError);
    });
  });

  // ----------------------------------------------------------------------------
  // Part 3: Raw Prisma Export vs Scoped / System Prisma under Non-Superuser RLS (Finding 4)
  // ----------------------------------------------------------------------------
  describe('3. Raw Prisma Export vs Scoped / System Prisma under Non-Superuser RLS (Finding 4)', () => {
    it('raw prisma returns 0 rows on tenant tables because RLS is forced and session context is unset', async () => {
      // Under assetvault_app (non-superuser, rolbypassrls = false), querying tenant tables
      // via raw prisma export without app.current_tenant_id or app.is_super_admin yields 0 rows
      const rawAssets = await prisma.asset.findMany();
      expect(rawAssets.length).toBe(0);

      const rawLicenses = await prisma.license.findMany();
      expect(rawLicenses.length).toBe(0);

      const rawUsers = await prisma.user.findMany();
      expect(rawUsers.length).toBe(0);
    });

    it('systemPrisma (isSuperAdmin: true) successfully reads rows across all tenants', async () => {
      const systemAssets = await systemPrisma.asset.findMany();
      expect(systemAssets.length).toBeGreaterThan(0);

      const systemLicenses = await systemPrisma.license.findMany();
      expect(systemLicenses.length).toBeGreaterThan(0);

      const systemUsers = await systemPrisma.user.findMany();
      expect(systemUsers.length).toBeGreaterThan(0);
    });

    it('prismaForRequest({ tenantId }) successfully reads only rows belonging to that tenant', async () => {
      const tenantAPrisma = prismaForRequest({ tenantId: tenantAId });
      const tenantAAssets = await tenantAPrisma.asset.findMany();

      expect(tenantAAssets.length).toBeGreaterThan(0);
      expect(tenantAAssets.every((a) => a.tenantId === tenantAId)).toBe(true);

      // Foreign tenant rows are filtered out by RLS / where injection
      const foreignInA = tenantAAssets.filter((a) => a.tenantId === tenantBId);
      expect(foreignInA.length).toBe(0);
    });
  });
});
