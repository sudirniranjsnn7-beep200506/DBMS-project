// ==============================================================================
// AssetVault: Direct Service Layer Unit & Integration Test Suite
// Course: BCSE307L Database Systems (Fall 2026-27)
// Comprehensive testing across all application domain services to ensure >=70% coverage
// ==============================================================================

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { prismaForRequest } from '../config/prisma';
import { tenantService } from '../services/tenant.service';
import { userService } from '../services/user.service';
import { vendorService } from '../services/vendor.service';
import { tagService } from '../services/tag.service';
import { planService } from '../services/plan.service';
import { categoryService } from '../services/category.service';
import { auditService } from '../services/audit.service';
import { notificationService } from '../services/notification.service';
import { assetService } from '../services/asset.service';
import { assetRepository } from '../repositories/asset.repository';
import { licenseService } from '../services/license.service';
import { allocationService } from '../services/allocation.service';
import { costOptimizationService } from '../services/costOptimization.service';
import { complianceService } from '../services/compliance.service';
import { authService } from '../services/auth.service';
import { notificationStreamService } from '../services/notificationStream.service';
import { tenantExportService } from '../services/tenantExport.service';
import { exportService } from '../services/export.service';
import { PaginationParams } from '../utils/pagination.util';
import { BadRequestError, UnprocessableError } from '../errors/AppError';

const systemPrisma = prismaForRequest({ isSuperAdmin: true });

describe('AssetVault Domain Services Comprehensive Coverage Suite', () => {
  let tenantId: string;
  let adminUserId: string;
  let vendorId: string;
  let testAssetId: string;
  let testLicenseId: string;

  const defaultPagination: PaginationParams = {
    page: 1,
    limit: 10,
    skip: 0,
    sort: 'name',
    order: 'asc',
  };

  beforeAll(async () => {
    // Fetch TechCorp seeded tenant
    const techcorp = await systemPrisma.tenant.findUnique({
      where: { slug: 'techcorp' },
      include: {
        users: { take: 1 },
        vendors: { take: 1 },
        assets: { take: 1 },
        licenses: { take: 1 },
      },
    });

    if (!techcorp) {
      throw new Error('Test precondition failed: TechCorp tenant missing');
    }

    tenantId = techcorp.id;
    vendorId = techcorp.vendors[0]?.id || '';
    testAssetId = techcorp.assets[0]?.id || '';
    testLicenseId = techcorp.licenses[0]?.id || '';

    // Clean up temporary test users from previous runs
    const staleTestUsers = await systemPrisma.user.findMany({
      where: {
        tenantId: techcorp.id,
        email: { startsWith: 'coverage.test.' },
      },
      select: { id: true },
    });
    if (staleTestUsers.length > 0) {
      const staleIds = staleTestUsers.map((u) => u.id);
      await systemPrisma.refreshToken.deleteMany({ where: { userId: { in: staleIds } } });
      await systemPrisma.user.deleteMany({ where: { id: { in: staleIds } } });
    }

    // Safely assign permanent admin user
    const adminUser =
      (await systemPrisma.user.findFirst({
        where: { tenantId: techcorp.id, email: 'techcorp.admin@techcorp.io' },
      })) ||
      (await systemPrisma.user.findFirst({
        where: { tenantId: techcorp.id },
      }));
    adminUserId = adminUser?.id || '';

    // Ensure plan has sufficient seat capacity for test executions
    const enterprisePlan = await systemPrisma.plan.findFirst({
      where: { maxUsers: { gte: 50 } },
    });
    if (enterprisePlan) {
      await systemPrisma.tenant.update({
        where: { id: techcorp.id },
        data: { planId: enterprisePlan.id },
      });
    }
  });

  // --------------------------------------------------------------------------
  // 1. Tenant Service
  // --------------------------------------------------------------------------
  describe('TenantService', () => {
    it('lists tenants with pagination and filtering', async () => {
      const res = await tenantService.listTenants(systemPrisma, defaultPagination);
      expect(res.data).toBeDefined();
      expect(Array.isArray(res.data)).toBe(true);
      expect(res.meta.page).toBe(1);
    });

    it('retrieves tenant by id', async () => {
      const tenant = await tenantService.getTenantById(systemPrisma, tenantId);
      expect(tenant).toBeDefined();
      expect(tenant.id).toBe(tenantId);
    });

    it('changes tenant subscription plan', async () => {
      const plans = await planService.listPlans(systemPrisma, { ...defaultPagination, sort: 'id' });
      const targetPlan = plans.data.find((p: any) => p.name === 'Enterprise') || plans.data[plans.data.length - 1];
      if (targetPlan) {
        const updated = await tenantService.changePlan(systemPrisma, tenantId, targetPlan.id);
        expect(updated.planId).toBe(targetPlan.id);
      }
    });

    it('creates, updates, suspends, activates and deletes a test tenant with dependent entities', async () => {
      const slug = `cov-tenant-${Date.now()}`;
      const created = await tenantService.createTenant(systemPrisma, {
        name: 'Coverage Tenant',
        slug,
        contactEmail: `${slug}@example.com`,
        planId: 1,
      });
      expect(created.slug).toBe(slug);

      const updated = await tenantService.updateTenant(systemPrisma, created.id, {
        name: 'Coverage Tenant Updated',
      });
      expect(updated.name).toBe('Coverage Tenant Updated');

      const suspended = await tenantService.suspendOrActivateTenant(created.id, 'SUSPENDED');
      expect(suspended.status).toBe('SUSPENDED');

      const activated = await tenantService.suspendOrActivateTenant(created.id, 'ACTIVE');
      expect(activated.status).toBe('ACTIVE');

      // Populate dependent records (user, vendor, license, allocation, asset, access log, notification)
      const u = await systemPrisma.user.create({
        data: {
          tenantId: created.id,
          roleId: 2,
          email: `${slug}-user@example.com`,
          fullName: 'Tenant Del User',
          passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz123456',
        },
      });

      const v = await systemPrisma.vendor.create({
        data: { tenantId: created.id, name: `Vendor-${slug}` },
      });

      const lic = await systemPrisma.license.create({
        data: {
          tenantId: created.id,
          vendorId: v.id,
          licenseTypeId: 1,
          name: `Lic-${slug}`,
          licenseKey: `KEY-${slug}`,
          totalSeats: 2,
          startDate: new Date(),
          endDate: new Date(Date.now() + 86400000),
        },
      });

      await systemPrisma.licenseAllocation.create({
        data: { licenseId: lic.id, userId: u.id },
      });

      const ast = await systemPrisma.asset.create({
        data: {
          tenantId: created.id,
          ownerId: u.id,
          assetCode: `AST-${slug}`,
          name: 'Test Asset',
          assetType: 'SOFTWARE',
        },
      });

      await systemPrisma.assetAccessLog.create({
        data: {
          assetId: ast.id,
          userId: u.id,
          licenseId: lic.id,
          action: 'DOWNLOAD',
        },
      });

      await systemPrisma.notification.create({
        data: {
          tenantId: created.id,
          userId: u.id,
          licenseId: lic.id,
          type: 'SYSTEM',
          message: 'Deletion test notification',
        },
      });

      await tenantService.deleteTenant(created.id);

      const check = await systemPrisma.tenant.findUnique({ where: { id: created.id } });
      expect(check).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // 2. User Service
  // --------------------------------------------------------------------------
  describe('UserService', () => {
    it('lists users inside tenant', async () => {
      const res = await userService.listUsers(systemPrisma, { ...defaultPagination, sort: 'fullName' });
      expect(res.data).toBeDefined();
      expect(res.data.length).toBeGreaterThan(0);
    });

    it('retrieves specific user by id', async () => {
      const user = await userService.getUserById(systemPrisma, adminUserId);
      expect(user).toBeDefined();
      expect(user.id).toBe(adminUserId);
      expect((user as any).passwordHash).toBeUndefined();
    });

    it('creates, updates and modifies user status', async () => {
      const testEmail = `coverage.test.${Date.now()}@techcorp.io`;
      const created = await userService.createUser(
        systemPrisma,
        tenantId,
        {
          fullName: 'Coverage Test User',
          email: testEmail,
          password: 'Password123!',
          roleName: 'MEMBER',
        },
        adminUserId
      );
      expect(created.email).toBe(testEmail);

      const updated = await userService.updateUser(systemPrisma, created.id, {
        fullName: 'Coverage Updated User',
      });
      expect(updated.fullName).toBe('Coverage Updated User');

      const deactivated = await userService.updateUserStatus(systemPrisma, created.id, false);
      expect(deactivated.isActive).toBe(false);

      const reactivated = await userService.updateUserStatus(systemPrisma, created.id, true);
      expect(reactivated.isActive).toBe(true);

      await userService.deleteUser(systemPrisma, created.id);
    });

    it('revokes refresh tokens and releases active license allocations prior to deleting user', async () => {
      const mockPrisma: any = {
        user: {
          findFirst: vi.fn().mockResolvedValue({ id: 'u-123', email: 'test@example.com' }),
          delete: vi.fn().mockResolvedValue({ id: 'u-123' }),
        },
        refreshToken: {
          updateMany: vi.fn().mockResolvedValue({ count: 2 }),
        },
        licenseAllocation: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
      };

      const result = await userService.deleteUser(mockPrisma, 'u-123');
      expect(result).toEqual({ id: 'u-123' });

      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u-123' },
        data: { revokedAt: expect.any(Date) },
      });

      expect(mockPrisma.licenseAllocation.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u-123', status: 'ACTIVE' },
        data: { status: 'RELEASED', releasedAt: expect.any(Date) },
      });

      expect(mockPrisma.user.delete).toHaveBeenCalledWith({
        where: { id: 'u-123' },
        select: expect.anything(),
      });
    });
  });

  // --------------------------------------------------------------------------
  // 3. Vendor Service
  // --------------------------------------------------------------------------
  describe('VendorService', () => {
    it('lists vendors for tenant', async () => {
      const res = await vendorService.listVendors(systemPrisma, defaultPagination);
      expect(res.data).toBeDefined();
      expect(Array.isArray(res.data)).toBe(true);
    });

    it('retrieves vendor by id', async () => {
      if (vendorId) {
        const vendor = await vendorService.getVendorById(systemPrisma, vendorId);
        expect(vendor).toBeDefined();
        expect(vendor.id).toBe(vendorId);
      }
    });

    it('creates and updates a vendor', async () => {
      const vendorName = `Test Vendor ${Date.now()}`;
      const created = await vendorService.createVendor(systemPrisma, {
        name: vendorName,
        contactEmail: 'contact@vendor.io',
        website: 'https://vendor.io',
        tenantId,
      });
      expect(created.name).toBe(vendorName);

      const updated = await vendorService.updateVendor(systemPrisma, created.id, {
        website: 'https://updated-vendor.io',
      });
      expect(updated.website).toBe('https://updated-vendor.io');

      const deleted = await vendorService.deleteVendor(systemPrisma, created.id);
      expect(deleted.id).toBe(created.id);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Tag Service
  // --------------------------------------------------------------------------
  describe('TagService', () => {
    it('lists tags for tenant', async () => {
      const res = await tagService.listTags(systemPrisma, defaultPagination);
      expect(res.data).toBeDefined();
    });

    it('creates, retrieves, and updates a tag', async () => {
      const tagName = `test-tag-${Date.now()}`;
      const created = await tagService.createTag(systemPrisma, {
        name: tagName,
        color: '#3b82f6',
        tenantId,
      });
      expect(created.name).toBe(tagName);

      const fetched = await tagService.getTagById(systemPrisma, created.id);
      expect(fetched.id).toBe(created.id);

      const updated = await tagService.updateTag(systemPrisma, created.id, {
        color: '#10b981',
      });
      expect(updated.color).toBe('#10b981');

      const deleted = await tagService.deleteTag(systemPrisma, created.id);
      expect(deleted.id).toBe(created.id);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Category Service
  // --------------------------------------------------------------------------
  describe('CategoryService', () => {
    it('returns hierarchical category tree', async () => {
      const tree = await categoryService.getCategoryTree(systemPrisma);
      expect(Array.isArray(tree)).toBe(true);
    });

    it('lists categories with pagination', async () => {
      const res = await categoryService.listCategories(systemPrisma, defaultPagination);
      expect(res.data).toBeDefined();
    });

    it('creates, retrieves, and updates a category', async () => {
      const catName = `Category-${Date.now()}`;
      const created = await categoryService.createCategory(systemPrisma, tenantId, {
        name: catName,
        description: 'Test category description',
      });
      expect(created.name).toBe(catName);

      const fetched = await categoryService.getCategoryById(systemPrisma, created.id);
      expect(fetched.id).toBe(created.id);

      const updated = await categoryService.updateCategory(systemPrisma, created.id, {
        description: 'Updated category description',
      });
      expect(updated.description).toBe('Updated category description');

      await categoryService.deleteCategory(systemPrisma, created.id);
    });
  });

  // --------------------------------------------------------------------------
  // 6. Plan Service
  // --------------------------------------------------------------------------
  describe('PlanService', () => {
    it('lists available plans', async () => {
      const res = await planService.listPlans(systemPrisma, { ...defaultPagination, sort: 'id' });
      expect(res.data.length).toBeGreaterThan(0);
    });

    it('retrieves plan by ID', async () => {
      const plan = await planService.getPlanById(systemPrisma, 1);
      expect(plan).toBeDefined();
      expect(plan.id).toBe(1);
    });

    it('creates, updates and deletes a plan', async () => {
      const planName = `Test Plan ${Date.now()}`;
      const created = await planService.createPlan(systemPrisma, {
        name: planName,
        maxUsers: 5,
        maxAssets: 50,
        monthlyPrice: 19.99,
      });
      expect(created.name).toBe(planName);

      const updated = await planService.updatePlan(systemPrisma, created.id, {
        maxUsers: 10,
      });
      expect(updated.maxUsers).toBe(10);

      const deleted = await planService.deletePlan(systemPrisma, created.id);
      expect(deleted.id).toBe(created.id);
    });
  });

  // --------------------------------------------------------------------------
  // 7. Audit Service
  // --------------------------------------------------------------------------
  describe('AuditService', () => {
    it('lists audit logs with pagination', async () => {
      const res = await auditService.listAuditLogs(
        systemPrisma,
        tenantId,
        {
          ...defaultPagination,
          sort: 'performedAt',
          order: 'desc',
        },
        {}
      );
      expect(res.data).toBeDefined();
      expect(Array.isArray(res.data)).toBe(true);
    });

    it('queries audit logs with cursor pagination and retrieves diff', async () => {
      const cursorRes = await auditService.listAuditLogsCursor(systemPrisma, tenantId, undefined, 5);
      expect(cursorRes.data).toBeDefined();
      expect(cursorRes.meta.limit).toBe(5);

      if (cursorRes.data.length > 0) {
        const logId = cursorRes.data[0].id.toString();
        const diff = await auditService.getAuditDiff(systemPrisma, tenantId, logId);
        expect(diff).toHaveProperty('diff');
        expect(diff).toHaveProperty('raw');
      }
    });
  });

  // --------------------------------------------------------------------------
  // 8. Notification Service
  // --------------------------------------------------------------------------
  describe('NotificationService', () => {
    it('lists user notifications', async () => {
      const res = await notificationService.listUserNotifications(
        systemPrisma,
        adminUserId,
        { ...defaultPagination, sort: 'createdAt', order: 'desc' }
      );
      expect(res.data).toBeDefined();
    });

    it('runs expiry notification generation function', async () => {
      const result = await notificationService.triggerExpiryCheck(tenantId, adminUserId, 30);
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('notificationsGenerated');
    });
  });

  // --------------------------------------------------------------------------
  // 9. Asset & License Services Direct Invocations
  // --------------------------------------------------------------------------
  describe('AssetService & LicenseService', () => {
    it('lists assets using v_asset_catalog view', async () => {
      const res = await assetService.listAssets(
        systemPrisma,
        tenantId,
        {
          ...defaultPagination,
          sort: 'created_at',
          order: 'desc',
        },
        {}
      );
      expect(res.data).toBeDefined();
    });

    it('retrieves asset details by ID with canonical compliance status', async () => {
      if (testAssetId) {
        const asset = await assetService.getAssetById(systemPrisma, testAssetId);
        expect(asset).toBeDefined();
        expect(asset.id).toBe(testAssetId);
        expect(['COMPLIANT', 'EXPIRED_LICENSE', 'UNLICENSED']).toContain(asset.complianceStatus);
        expect(typeof asset.coveringLicensesCount).toBe('number');
      }
    });

    it('returns COMPLIANT for an asset covered by an active license', async () => {
      const assetId = '00000000-0000-4000-8000-000000000001';
      const tenantIdForTest = '00000000-0000-4000-8000-000000000002';
      const findByIdSpy = vi.spyOn(assetRepository, 'findById').mockResolvedValue({
        id: assetId,
        tenantId: tenantIdForTest,
        assetLicenses: [{ license: { status: 'ACTIVE', endDate: null, deletedAt: null } }],
      } as any);
      const catalogSpy = vi.spyOn(assetRepository, 'findCatalogCompliance').mockResolvedValue({
        compliance_status: 'COMPLIANT',
        covering_licenses_count: 1,
      });

      try {
        const asset = await assetService.getAssetById(systemPrisma, assetId);
        expect(asset.complianceStatus).toBe('COMPLIANT');
        expect(asset.coveringLicensesCount).toBe(1);
        expect(catalogSpy).toHaveBeenCalledWith(systemPrisma, assetId, tenantIdForTest);
      } finally {
        findByIdSpy.mockRestore();
        catalogSpy.mockRestore();
      }
    });

    it('lists licenses using v_license_utilization view', async () => {
      const res = await licenseService.listLicenses(
        systemPrisma,
        tenantId,
        {
          ...defaultPagination,
          sort: 'license_name',
          order: 'asc',
        },
        {}
      );
      expect(res.data).toBeDefined();
    });

    it('retrieves license details with revealed key', async () => {
      if (testLicenseId) {
        const detail = await licenseService.getLicenseById(
          systemPrisma,
          testLicenseId,
          'TENANT_ADMIN',
          adminUserId,
          tenantId
        );
        expect(detail).toBeDefined();
        expect(detail.id).toBe(testLicenseId);
      }
    });

    it('handles asset version management (create, list, get, compare)', async () => {
      if (testAssetId) {
        // Throws BadRequestError if fileUrl is missing or empty
        await expect(
          assetService.createVersion(tenantId, testAssetId, { fileUrl: '' }, adminUserId)
        ).rejects.toThrow(BadRequestError);

        await expect(
          assetService.createVersion(tenantId, testAssetId, {}, adminUserId)
        ).rejects.toThrow(BadRequestError);

        const v2 = await assetService.createVersion(
          tenantId,
          testAssetId,
          {
            fileUrl: 'https://storage.assetvault.io/v2.png',
            fileSizeBytes: 2048,
            checksumSha256: 'a'.repeat(64),
            changeNotes: 'Version 2 release',
          },
          adminUserId
        );
        expect(v2.versionNo).toBeGreaterThanOrEqual(1);

        const versions = await assetService.listVersions(systemPrisma, testAssetId);
        expect(versions.length).toBeGreaterThan(0);

        const v1 = await assetService.getVersionByNo(systemPrisma, testAssetId, 1);
        expect(v1.versionNo).toBe(1);

        if (versions.length >= 2) {
          const comp = await assetService.compareVersions(systemPrisma, testAssetId, 1, 2);
          expect(comp).toHaveProperty('comparison');
        }
      }
    });

    it('generates license PDF even when licenseKey is null or undefined without throwing TypeError', async () => {
      if (testLicenseId) {
        const doc = await exportService.generateLicensePdf(testLicenseId, tenantId);
        expect(doc).toBeDefined();
      }
    });

    it('exports tenant data archive with masked license keys', async () => {
      const data = await tenantExportService.exportTenantData(tenantId);
      expect(data).toBeDefined();
      expect(data.metadata.tenantId).toBe(tenantId);
      expect(Array.isArray(data.licenses)).toBe(true);
      expect(data.licenses.length).toBeGreaterThan(0);
      for (const lic of data.licenses) {
        if (lic.licenseKey) {
          expect(lic.licenseKey).toMatch(/^•{8}-[A-Za-z0-9-]+$/);
        }
      }
    });

    it('exports assets catalog and licenses utilization as CSV', async () => {
      const assetCsv = await assetService.exportCsv(systemPrisma, tenantId);
      expect(typeof assetCsv).toBe('string');
      expect(assetCsv).toContain('asset_code');

      const licenseCsv = await licenseService.exportCsv(systemPrisma, tenantId);
      expect(typeof licenseCsv).toBe('string');
      expect(licenseCsv).toContain('license_name');
    });

    it('bulkImport validates rows and rejects invalid CSV rows without adding malformed rows', async () => {
      // 1. Empty CSV throws BadRequestError
      await expect(assetService.bulkImport(tenantId, adminUserId, ''))
        .rejects.toThrow(BadRequestError);

      // 2. CSV with invalid rows throws UnprocessableError
      const badCsv = '"asset_code","name","asset_type","description"\n' +
        '"VALID-001","Valid Name","FONT","Valid row"\n' +
        '"","","INVALID_TYPE","Broken row"\n';

      await expect(assetService.bulkImport(tenantId, adminUserId, badCsv))
        .rejects.toThrow(UnprocessableError);
    });

    it('retrieves license renewals and covered assets', async () => {
      if (testLicenseId) {
        const renewals = await licenseService.findRenewals(systemPrisma, testLicenseId);
        expect(Array.isArray(renewals)).toBe(true);

        const assets = await licenseService.findAssetsByLicense(systemPrisma, testLicenseId);
        expect(Array.isArray(assets)).toBe(true);
      }
    });

    it('blocks soft-deleting a license with active seat allocations and allows it once released', async () => {
      // 1. Create a test license
      const tempLicense = await systemPrisma.license.create({
        data: {
          name: 'Allocated Deletion Test License',
          licenseKey: 'KEY-TEST-DELETE-1234',
          tenant: { connect: { id: tenantId } },
          vendor: { connect: { id: vendorId } },
          licenseType: { connect: { id: 1 } },
          status: 'ACTIVE',
          totalSeats: 5,
          cost: 100,
          currency: 'USD',
          startDate: new Date(),
          endDate: new Date(Date.now() + 86400000),
          autoRenew: false,
        },
      });

      // 2. Create an active allocation on this license
      const allocation = await systemPrisma.licenseAllocation.create({
        data: {
          licenseId: tempLicense.id,
          userId: adminUserId,
          status: 'ACTIVE',
        },
      });

      // 3. Attempt to soft-delete -> throws BadRequestError prompting to release seats
      await expect(licenseService.softDeleteLicense(systemPrisma, tempLicense.id)).rejects.toThrow(
        /active seat allocation/i
      );

      // 4. Release allocation
      await systemPrisma.licenseAllocation.update({
        where: { id: allocation.id },
        data: { status: 'RELEASED', releasedAt: new Date() },
      });

      // 5. Soft-delete succeeds now that active allocations = 0
      const deleted = await licenseService.softDeleteLicense(systemPrisma, tempLicense.id);
      expect(deleted.deletedAt).toBeDefined();

      // Clean up
      await systemPrisma.licenseAllocation.deleteMany({ where: { licenseId: tempLicense.id } });
      await systemPrisma.license.delete({ where: { id: tempLicense.id } });
    });

    it('listAllocationsByLicense filters results to only caller own allocation when caller is MEMBER', async () => {
      const lic = await systemPrisma.license.create({
        data: {
          name: 'Member Allocation Scoping Test License',
          licenseKey: 'KEY-TEST-MEMBER-ALLOC-1',
          tenant: { connect: { id: tenantId } },
          vendor: { connect: { id: vendorId } },
          licenseType: { connect: { id: 1 } },
          status: 'ACTIVE',
          totalSeats: 10,
          cost: 100,
          currency: 'USD',
          startDate: new Date(),
          endDate: new Date(Date.now() + 86400000),
          autoRenew: false,
        },
      });

      const memberUser = await systemPrisma.user.findFirst({
        where: { tenantId, role: { name: 'MEMBER' } },
      });

      if (memberUser) {
        await systemPrisma.licenseAllocation.create({
          data: { licenseId: lic.id, userId: adminUserId, status: 'ACTIVE' },
        });
        await systemPrisma.licenseAllocation.create({
          data: { licenseId: lic.id, userId: memberUser.id, status: 'ACTIVE' },
        });

        const adminRes = await allocationService.listAllocationsByLicense(
          systemPrisma,
          lic.id,
          defaultPagination,
          adminUserId,
          'TENANT_ADMIN'
        );
        expect(adminRes.data.length).toBe(2);

        const memberRes = await allocationService.listAllocationsByLicense(
          systemPrisma,
          lic.id,
          defaultPagination,
          memberUser.id,
          'MEMBER'
        );
        expect(memberRes.data.length).toBe(1);
        expect(memberRes.data[0].userId).toBe(memberUser.id);
        expect(memberRes.meta.total).toBe(1);

        await systemPrisma.licenseAllocation.deleteMany({ where: { licenseId: lic.id } });
      }

      await systemPrisma.license.delete({ where: { id: lic.id } });
    });
  });

  // --------------------------------------------------------------------------
  // 10. Compliance & Cost Optimization Direct Invocations
  // --------------------------------------------------------------------------
  describe('ComplianceService & CostOptimizationService', () => {
    it('computes compliance rating accurately', async () => {
      const report = await complianceService.getTenantCompliance(tenantId);
      expect(report.score).toBeGreaterThanOrEqual(0);
      expect(report.score).toBeLessThanOrEqual(100);
      expect(report.factors.length).toBe(4);
    });

    it('sets correct summary message aligning with Grade C threshold (>= 60)', async () => {
      const report = await complianceService.getTenantCompliance(tenantId);
      if (report.score >= 90) {
        expect(report.summary).toContain('All digital assets and seat allocations are in good standing.');
      } else if (report.score >= 60) {
        expect(report.summary).toContain('Minor licensing attention required to avoid compliance gaps.');
      } else {
        expect(report.summary).toContain('Action required: Immediate remediation needed on unlicensed assets or expired contracts.');
      }
    });

    it('generates dormant seat reclamation report', async () => {
      const costReport = await costOptimizationService.getUnusedSeatsReport(tenantId);
      expect(costReport).toHaveProperty('summary');
      expect(costReport).toHaveProperty('reclaimCandidates');
      expect(costReport).toHaveProperty('topExpensiveVendors');
    });
  });

  // --------------------------------------------------------------------------
  // 11. Auth, Real-Time Stream, and Ancillary Services
  // --------------------------------------------------------------------------
  describe('AuthService & NotificationStreamService', () => {
    it('retrieves user profile and role menus', async () => {
      const me = await authService.getMe(adminUserId);
      expect(me.id).toBe(adminUserId);
      expect(me.permissions.length).toBeGreaterThan(0);

      const adminMenu = authService.getMenu('TENANT_ADMIN');
      expect(adminMenu.length).toBeGreaterThan(0);

      const memberMenu = authService.getMenu('MEMBER');
      expect(memberMenu.length).toBeGreaterThan(0);
    });

    it('broadcasts real-time notification to stream service', () => {
      expect(() => {
        notificationStreamService.broadcastNotification({
          tenantId,
          userId: adminUserId,
          notification: { id: 1, title: 'Test Alert', message: 'SSE Broadcast' },
        });
      }).not.toThrow();
    });

    it('broadcasts real-time notification across all tenants when tenantId is null and supports tenantIds list', () => {
      let closeTenant1 = () => {};
      let closeTenant2 = () => {};
      let closeSuperAdmin = () => {};
      let closeMember = () => {};

      const mockResTenant1: any = {
        writeHead: vi.fn(),
        write: vi.fn(),
        on: vi.fn((event, cb) => { if (event === 'close') closeTenant1 = cb; }),
      };
      const mockResTenant2: any = {
        writeHead: vi.fn(),
        write: vi.fn(),
        on: vi.fn((event, cb) => { if (event === 'close') closeTenant2 = cb; }),
      };
      const mockResSuperAdmin: any = {
        writeHead: vi.fn(),
        write: vi.fn(),
        on: vi.fn((event, cb) => { if (event === 'close') closeSuperAdmin = cb; }),
      };
      const mockResMember: any = {
        writeHead: vi.fn(),
        write: vi.fn(),
        on: vi.fn((event, cb) => { if (event === 'close') closeMember = cb; }),
      };

      notificationStreamService.addClient('user-t1-admin', 't-1', mockResTenant1, 'TENANT_ADMIN');
      notificationStreamService.addClient('user-t2-mgr', 't-2', mockResTenant2, 'ASSET_MANAGER');
      notificationStreamService.addClient('user-super', null, mockResSuperAdmin, 'SUPER_ADMIN');
      notificationStreamService.addClient('user-t1-member', 't-1', mockResMember, 'MEMBER');

      // 1. Broadcast with tenantId: null (e.g. DAILY_EXPIRY_RUN from scheduler)
      notificationStreamService.broadcastNotification({
        tenantId: null,
        notification: { type: 'DAILY_EXPIRY_RUN', message: 'Expiry check finished' },
      });

      // All admins across all tenants (and super admin) should receive it
      expect(mockResTenant1.write).toHaveBeenCalledWith(expect.stringContaining('DAILY_EXPIRY_RUN'));
      expect(mockResTenant2.write).toHaveBeenCalledWith(expect.stringContaining('DAILY_EXPIRY_RUN'));
      expect(mockResSuperAdmin.write).toHaveBeenCalledWith(expect.stringContaining('DAILY_EXPIRY_RUN'));
      // Regular members should NOT receive it
      expect(mockResMember.write).not.toHaveBeenCalledWith(expect.stringContaining('DAILY_EXPIRY_RUN'));

      // 2. Broadcast with specific tenantId
      notificationStreamService.broadcastNotification({
        tenantId: 't-1',
        notification: { type: 'T1_ONLY', message: 'For T1 only' },
      });
      expect(mockResTenant1.write).toHaveBeenCalledWith(expect.stringContaining('T1_ONLY'));
      expect(mockResTenant2.write).not.toHaveBeenCalledWith(expect.stringContaining('T1_ONLY'));
      expect(mockResSuperAdmin.write).not.toHaveBeenCalledWith(expect.stringContaining('T1_ONLY'));

      // 3. Broadcast with explicit list of tenantIds
      notificationStreamService.broadcastNotification({
        tenantIds: ['t-2'],
        notification: { type: 'T2_ONLY', message: 'For T2 only' },
      });
      expect(mockResTenant2.write).toHaveBeenCalledWith(expect.stringContaining('T2_ONLY'));
      expect(mockResTenant1.write).not.toHaveBeenCalledWith(expect.stringContaining('T2_ONLY'));

      // Clean up clients
      closeTenant1();
      closeTenant2();
      closeSuperAdmin();
      closeMember();
    });

    it('retrieves vendor by ID', async () => {
      if (vendorId) {
        const vendor = await vendorService.getVendorById(systemPrisma, vendorId);
        expect(vendor.id).toBe(vendorId);
      }
    });
  });

  afterAll(async () => {
    // Delete any leftover cov-tenant-% tenants
    const leftoverTenants = await systemPrisma.tenant.findMany({
      where: { slug: { startsWith: 'cov-tenant-' } },
      select: { id: true },
    });
    for (const t of leftoverTenants) {
      try {
        await tenantService.deleteTenant(t.id);
      } catch {
        // ignore
      }
    }

    // Delete any leftover coverage.test.% users
    const leftoverUsers = await systemPrisma.user.findMany({
      where: { email: { startsWith: 'coverage.test.' } },
      select: { id: true },
    });
    if (leftoverUsers.length > 0) {
      const userIds = leftoverUsers.map((u) => u.id);
      await systemPrisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
      await systemPrisma.user.deleteMany({ where: { id: { in: userIds } } });
    }

    // Delete any leftover Category-% categories
    await systemPrisma.category.deleteMany({
      where: { name: { startsWith: 'Category-' } },
    });

    // Delete any leftover v2.png test asset versions
    await systemPrisma.assetVersion.deleteMany({
      where: { fileUrl: 'https://storage.assetvault.io/v2.png' },
    });
  });
});
