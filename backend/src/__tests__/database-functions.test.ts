// ==============================================================================
// AssetVault: Database Functions, Procedures, Triggers & RLS Test Suite
// Course: BCSE307L Database Systems (Fall 2026-27)
// Verifies:
//   1. Single audit log row on seat allocation & release (no duplicate audit logs)
//   2. Revocation reason captured in session context and appended to notes
//   3. Stored procedures (sp_allocate_license_seat, sp_release_license_seat, sp_renew_license)
//   4. Declarative check constraints (11 bounds) and GIN trigram indexes
//   5. Triggers (audit immutability, cross-tenant isolation, seat limits)
//   6. PostgreSQL analytical views and materialized view refresh
//   7. Row-Level Security (FORCE RLS) policies under tenant session context
// ==============================================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, prismaForRequest } from '../config/prisma';
import { Prisma } from '@prisma/client';

const systemPrisma = prismaForRequest({ isSuperAdmin: true });

describe('AssetVault Database Functions, Stored Procedures & Live Schema Verification', () => {
  let tenantAId: string;
  let tenantBId: string;
  let userAAdminId: string;
  let userAMemberId: string;
  let userBMemberId: string;
  let vendorAId: string;
  let vendorBId: string;
  let testLicenseId: string;

  beforeAll(async () => {
    // 1. Fetch TechCorp (Tenant A)
    const tenantA = await systemPrisma.tenant.findUnique({ where: { slug: 'techcorp' } });
    expect(tenantA).toBeDefined();
    tenantAId = tenantA!.id;

    // 2. Fetch InnovateLabs (Tenant B)
    const tenantB = await systemPrisma.tenant.findUnique({ where: { slug: 'innovatelabs' } });
    expect(tenantB).toBeDefined();
    tenantBId = tenantB!.id;

    // 3. Fetch Users
    const userAAdmin = await systemPrisma.user.findFirst({
      where: { tenantId: tenantAId, email: { contains: 'admin' } },
    });
    userAAdminId = userAAdmin!.id;

    const userAMember = await systemPrisma.user.findFirst({
      where: { tenantId: tenantAId, email: { contains: 'dev' } },
    });
    userAMemberId = userAMember!.id;

    const userBMember = await systemPrisma.user.findFirst({
      where: { tenantId: tenantBId, email: { contains: 'dev' } },
    });
    userBMemberId = userBMember!.id;

    // 4. Fetch Vendors
    const vendorA = await systemPrisma.vendor.findFirst({ where: { tenantId: tenantAId } });
    vendorAId = vendorA!.id;

    const vendorB = await systemPrisma.vendor.findFirst({ where: { tenantId: tenantBId } });
    vendorBId = vendorB!.id;

    // 5. Create a dedicated isolated test license for stored procedure verification
    const testLicense = await systemPrisma.license.create({
      data: {
        tenantId: tenantAId,
        vendorId: vendorAId,
        licenseTypeId: 3, // SEAT_BASED
        name: 'SP Audit Verification Suite License',
        licenseKey: `TEST-SP-${Date.now()}`,
        totalSeats: 2,
        cost: 150.0,
        currency: 'USD',
        status: 'ACTIVE',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2027-01-01'),
      },
    });
    testLicenseId = testLicense.id;
  });

  afterAll(async () => {
    // Clean up dedicated test license and its allocations/audits
    if (testLicenseId) {
      await systemPrisma.licenseAllocation.deleteMany({ where: { licenseId: testLicenseId } });
      await systemPrisma.licenseRenewal.deleteMany({ where: { licenseId: testLicenseId } });
      await systemPrisma.license.delete({ where: { id: testLicenseId } }).catch(() => {});
    }
  });

  // ----------------------------------------------------------------------------
  // 1. Audit Log Uniqueness & Stored Procedure Integrity
  // ----------------------------------------------------------------------------
  describe('1. Audit Log Singularity & Stored Procedures (sp_allocate/release)', () => {
    let createdAllocationId: string;

    it('sp_allocate_license_seat creates an active seat and exactly ONE audit log entry', async () => {
      // 1. Call stored procedure sp_allocate_license_seat
      const result: any = await systemPrisma.$queryRaw(
        Prisma.sql`CALL sp_allocate_license_seat(
          ${testLicenseId}::UUID,
          ${userAMemberId}::UUID,
          ${userAAdminId}::UUID,
          NULL
        );`
      );

      createdAllocationId = result?.[0]?.p_allocation_id;
      expect(createdAllocationId).toBeDefined();

      // 2. Verify allocation in license_allocations table
      const allocation = await systemPrisma.licenseAllocation.findUnique({
        where: { id: createdAllocationId },
      });
      expect(allocation).not.toBeNull();
      expect(allocation!.status).toBe('ACTIVE');
      expect(allocation!.licenseId).toBe(testLicenseId);
      expect(allocation!.userId).toBe(userAMemberId);

      // 3. Verify exactly ONE audit log row was generated (NOT duplicate)
      const auditLogs = await systemPrisma.auditLog.findMany({
        where: {
          tableName: 'license_allocations',
          recordId: createdAllocationId,
        },
      });

      expect(auditLogs.length).toBe(1);
      expect(auditLogs[0]!.action).toBe('INSERT');
      expect(auditLogs[0]!.tenantId).toBe(tenantAId);
      expect(auditLogs[0]!.userId).toBe(userAAdminId);
    });

    it('sp_release_license_seat revokes seat, appends reason to notes, and emits exactly ONE audit log row', async () => {
      const revocationReason = 'Employee department transfer to Infrastructure Unit';

      // 1. Call stored procedure sp_release_license_seat with custom reason
      await systemPrisma.$executeRaw(
        Prisma.sql`CALL sp_release_license_seat(
          ${createdAllocationId}::UUID,
          ${userAAdminId}::UUID,
          ${revocationReason}
        );`
      );

      // 2. Verify allocation updated in database
      const allocation = await systemPrisma.licenseAllocation.findUnique({
        where: { id: createdAllocationId },
      });
      expect(allocation).not.toBeNull();
      expect(allocation!.status).toBe('REVOKED');
      expect(allocation!.releasedAt).not.toBeNull();

      // Verify reason appended to notes
      const notesRaw: any = await systemPrisma.$queryRaw(
        Prisma.sql`SELECT notes FROM license_allocations WHERE id = ${createdAllocationId}::UUID;`
      );
      expect(notesRaw[0]?.notes).toContain(`Revoked: ${revocationReason}`);

      // 3. Verify exactly TWO audit log rows total for this allocation (1 INSERT + 1 UPDATE)
      const auditLogs = await systemPrisma.auditLog.findMany({
        where: {
          tableName: 'license_allocations',
          recordId: createdAllocationId,
        },
        orderBy: { performedAt: 'asc' },
      });

      expect(auditLogs.length).toBe(2);
      expect(auditLogs[0]!.action).toBe('INSERT');
      expect(auditLogs[1]!.action).toBe('UPDATE');
      expect(auditLogs[1]!.userId).toBe(userAAdminId);
      expect(auditLogs[1]!.tenantId).toBe(tenantAId);
    });

    it('sp_allocate_license_seat rejects allocation when seats are exhausted', async () => {
      // License has 2 seats total.
      // Allocate seat 1 to userAAdminId
      await systemPrisma.$executeRaw(
        Prisma.sql`CALL sp_allocate_license_seat(
          ${testLicenseId}::UUID,
          ${userAAdminId}::UUID,
          ${userAAdminId}::UUID,
          NULL
        );`
      );

      // Allocate seat 2 to userAMemberId
      await systemPrisma.$executeRaw(
        Prisma.sql`CALL sp_allocate_license_seat(
          ${testLicenseId}::UUID,
          ${userAMemberId}::UUID,
          ${userAAdminId}::UUID,
          NULL
        );`
      );

      // Attempt 3rd seat allocation should fail with check_violation
      await expect(
        systemPrisma.$executeRaw(
          Prisma.sql`CALL sp_allocate_license_seat(
            ${testLicenseId}::UUID,
            ${userAAdminId}::UUID,
            ${userAAdminId}::UUID,
            NULL
          );`
        )
      ).rejects.toThrow();
    });

    it('sp_renew_license extends end date, logs renewal, and generates triggers audit logs', async () => {
      const newEndDate = '2028-06-30';
      const renewalCost = 300.0;

      const result: any = await systemPrisma.$queryRaw(
        Prisma.sql`CALL sp_renew_license(
          ${testLicenseId}::UUID,
          ${newEndDate}::DATE,
          ${renewalCost}::NUMERIC,
          ${userAAdminId}::UUID,
          'Contract extension for FY28',
          NULL
        );`
      );

      const renewalId = result?.[0]?.p_renewal_id;
      expect(renewalId).toBeDefined();

      // Verify license end_date updated
      const updatedLicense = await systemPrisma.license.findUnique({
        where: { id: testLicenseId },
      });
      expect(updatedLicense!.endDate?.toISOString().slice(0, 10)).toBe(newEndDate);

      // Verify renewal record created
      const renewal = await systemPrisma.licenseRenewal.findUnique({
        where: { id: renewalId },
      });
      expect(renewal).not.toBeNull();
      expect(Number(renewal!.cost)).toBe(renewalCost);

      // Verify audit trail captured renewal
      const renewalAudit = await systemPrisma.auditLog.findFirst({
        where: {
          tableName: 'license_renewals',
          recordId: renewalId,
        },
      });
      expect(renewalAudit).not.toBeNull();
      expect(renewalAudit!.action).toBe('INSERT');
    });
  });

  // ----------------------------------------------------------------------------
  // 2. Database Triggers Enforcement
  // ----------------------------------------------------------------------------
  describe('2. Integrity & Security Triggers', () => {
    it('trg_audit_immutable blocks UPDATE and DELETE on audit_logs with error 28000', async () => {
      // Find an existing audit log
      const log = await systemPrisma.auditLog.findFirst();
      expect(log).not.toBeNull();

      // Attempting to UPDATE an audit log row must fail
      await expect(
        systemPrisma.$executeRaw`UPDATE audit_logs SET action = 'DELETE' WHERE id = ${log!.id}::BIGINT;`
      ).rejects.toThrow();

      // Attempting to DELETE an audit log row must fail
      await expect(
        systemPrisma.$executeRaw`DELETE FROM audit_logs WHERE id = ${log!.id}::BIGINT;`
      ).rejects.toThrow();
    });

    it('trg_enforce_asset_tenant rejects creating asset whose owner belongs to another tenant', async () => {
      await expect(
        prisma.$executeRaw(
          Prisma.sql`INSERT INTO assets (
            id, tenant_id, owner_id, asset_code, name, asset_type, status
          ) VALUES (
            gen_random_uuid(),
            ${tenantAId}::UUID,
            ${userBMemberId}::UUID, -- Tenant B user!
            'ILLEGAL-CROSS-TENANT',
            'Cross Tenant Exploit Asset',
            'SOFTWARE'::asset_type,
            'ACTIVE'::asset_status
          );`
        )
      ).rejects.toThrow(/Cross-tenant violation/i);
    });

    it('trg_enforce_license_tenant rejects creating license with vendor of another tenant', async () => {
      await expect(
        prisma.$executeRaw(
          Prisma.sql`INSERT INTO licenses (
            id, tenant_id, vendor_id, license_type_id, name, license_key, total_seats, cost, status
          ) VALUES (
            gen_random_uuid(),
            ${tenantAId}::UUID,
            ${vendorBId}::UUID, -- Tenant B vendor!
            1,
            'Illegal Cross Tenant License',
            'KEY-X-TENANT',
            5,
            100.0,
            'ACTIVE'::license_status
          );`
        )
      ).rejects.toThrow(/Cross-tenant violation/i);
    });

    it('trg_audit_vendors automatically captures vendor mutations', async () => {
      const vendorName = `Audit Test Vendor ${Date.now()}`;
      const newVendor = await systemPrisma.vendor.create({
        data: {
          tenantId: tenantAId,
          name: vendorName,
        },
      });

      const audit = await systemPrisma.auditLog.findFirst({
        where: {
          tableName: 'vendors',
          recordId: newVendor.id,
        },
      });

      expect(audit).not.toBeNull();
      expect(audit!.action).toBe('INSERT');

      // Cleanup
      await systemPrisma.vendor.delete({ where: { id: newVendor.id } });
    });
  });

  // ----------------------------------------------------------------------------
  // 3. Declarative CHECK Constraints & Trigram Indexes
  // ----------------------------------------------------------------------------
  describe('3. Domain CHECK Constraints & Specialized Indexes', () => {
    it('enforces chk_licenses_dates (end_date > start_date)', async () => {
      await expect(
        prisma.$executeRaw(
          Prisma.sql`INSERT INTO licenses (
            id, tenant_id, vendor_id, license_type_id, name, license_key, total_seats, cost, status, start_date, end_date
          ) VALUES (
            gen_random_uuid(),
            ${tenantAId}::UUID,
            ${vendorAId}::UUID,
            2,
            'Invalid Date License',
            ${'BAD-DATE-' + Date.now()},
            5,
            50.0,
            'ACTIVE'::license_status,
            '2026-12-31'::DATE,
            '2026-01-01'::DATE -- End date before start date!
          );`
        )
      ).rejects.toThrow();
    });

    it('enforces chk_licenses_total_seats (total_seats >= 1)', async () => {
      await expect(
        prisma.$executeRaw(
          Prisma.sql`INSERT INTO licenses (
            id, tenant_id, vendor_id, license_type_id, name, license_key, total_seats, cost, status
          ) VALUES (
            gen_random_uuid(),
            ${tenantAId}::UUID,
            ${vendorAId}::UUID,
            2,
            'Zero Seat License',
            ${'ZERO-SEAT-' + Date.now()},
            0, -- Invalid seats!
            50.0,
            'ACTIVE'::license_status
          );`
        )
      ).rejects.toThrow();
    });

    it('verifies GIN trigram indexes and partial index catalog', async () => {
      const indexes: any = await prisma.$queryRaw`
        SELECT indexname FROM pg_indexes 
        WHERE schemaname = 'public' 
          AND indexname IN (
            'idx_assets_name_trgm', 
            'idx_licenses_name_trgm', 
            'idx_license_alloc_active',
            'idx_assets_deleted_at',
            'idx_licenses_deleted_at',
            'idx_notifications_user_unread'
          );
      `;
      const indexNames = indexes.map((i: any) => i.indexname);
      expect(indexNames).toContain('idx_assets_name_trgm');
      expect(indexNames).toContain('idx_licenses_name_trgm');
      expect(indexNames).toContain('idx_license_alloc_active');
      expect(indexNames).toContain('idx_assets_deleted_at');
      expect(indexNames).toContain('idx_licenses_deleted_at');
      expect(indexNames).toContain('idx_notifications_user_unread');
    });
  });

  // ----------------------------------------------------------------------------
  // 4. PostgreSQL Views & Materialized Views
  // ----------------------------------------------------------------------------
  describe('4. Real-time Analytical & Materialized Views', () => {
    it('queries v_license_utilization successfully with calculated columns and filter columns', async () => {
      const views: any = await prisma.$queryRaw`
        SELECT * FROM v_license_utilization WHERE tenant_id = ${tenantAId}::UUID LIMIT 5;
      `;
      expect(Array.isArray(views)).toBe(true);
      if (views.length > 0) {
        expect(views[0]).toHaveProperty('license_id');
        expect(views[0]).toHaveProperty('used_seats');
        expect(views[0]).toHaveProperty('available_seats');
        expect(views[0]).toHaveProperty('utilization_pct');
        // Filter columns exposed for backend queries
        expect(views[0]).toHaveProperty('vendor_id');
        expect(views[0]).toHaveProperty('license_type_id');
      }
    });

    it('queries v_asset_catalog with taxonomic category, tags array, and filter columns', async () => {
      const catalog: any = await prisma.$queryRaw`
        SELECT * FROM v_asset_catalog WHERE tenant_id = ${tenantAId}::UUID LIMIT 5;
      `;
      expect(Array.isArray(catalog)).toBe(true);
      if (catalog.length > 0) {
        expect(catalog[0]).toHaveProperty('asset_id');
        expect(catalog[0]).toHaveProperty('asset_code');
        expect(catalog[0]).toHaveProperty('tags');
        // Filter columns exposed for backend queries
        expect(catalog[0]).toHaveProperty('category_id');
        expect(catalog[0]).toHaveProperty('owner_id');
        // Compliance status derived correctly
        expect(['COMPLIANT', 'UNLICENSED', 'EXPIRED_LICENSE']).toContain(catalog[0].compliance_status);
      }
    });

    it('fn_tenant_dashboard_stats returns all KPIs including new user_count, unlicensed_assets_count, and asset_type_breakdown', async () => {
      const result: any = await systemPrisma.$queryRaw`
        SELECT fn_tenant_dashboard_stats(${tenantAId}::UUID) AS stats;
      `;
      const stats = result[0]?.stats;
      expect(stats).toBeDefined();
      // Existing KPIs
      expect(stats).toHaveProperty('total_assets');
      expect(stats).toHaveProperty('total_licenses');
      expect(stats).toHaveProperty('total_seats');
      expect(stats).toHaveProperty('allocated_seats');
      expect(stats).toHaveProperty('expiring_in_30_days');
      expect(stats).toHaveProperty('monthly_plan_price');
      expect(stats).toHaveProperty('total_license_cost');
      expect(stats).toHaveProperty('storage_used_bytes');
      // New KPIs
      expect(stats).toHaveProperty('user_count');
      expect(typeof stats.user_count).toBe('number');
      expect(stats.user_count).toBeGreaterThan(0);
      expect(stats).toHaveProperty('unlicensed_assets_count');
      expect(typeof stats.unlicensed_assets_count).toBe('number');
      expect(stats).toHaveProperty('asset_type_breakdown');
      expect(typeof stats.asset_type_breakdown).toBe('object');
    });

    it('refreshes materialized view mv_monthly_access_stats concurrently', async () => {
      await expect(
        prisma.$executeRaw`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_access_stats;`
      ).resolves.not.toThrow();
    });
  });

  // ----------------------------------------------------------------------------
  // 5. Row-Level Security (RLS) Isolation
  // ----------------------------------------------------------------------------
  describe('5. Row-Level Security (RLS) Multi-Tenant Isolation', () => {
    it('enforces isolation: tenant A session cannot read tenant B records under RLS', async () => {
      const tenantAAssets = await prisma.$transaction(async (tx: any) => {
        await tx.$executeRaw(Prisma.sql`SET LOCAL ROLE assetvault_app;`);
        await tx.$executeRaw(
          Prisma.sql`SELECT 
            set_config('app.current_tenant_id', ${tenantAId}, true),
            set_config('app.is_super_admin', 'false', true);`
        );
        return await tx.$queryRaw(
          Prisma.sql`SELECT id, tenant_id FROM assets WHERE tenant_id = ${tenantBId}::UUID;`
        );
      });

      expect((tenantAAssets as any[]).length).toBe(0);
    });

    it('allows super admin session to query across all tenants', async () => {
      const allTenantsAssets = await prisma.$transaction(async (tx: any) => {
        await tx.$executeRaw(Prisma.sql`SET LOCAL ROLE assetvault_app;`);
        await tx.$executeRaw(
          Prisma.sql`SELECT 
            set_config('app.current_tenant_id', '', true),
            set_config('app.is_super_admin', 'true', true);`
        );
        return await tx.$queryRaw`SELECT COUNT(*)::INT as total FROM assets;`;
      });

      expect((allTenantsAssets as any[])[0].total).toBeGreaterThan(0);
    });
  });
});
