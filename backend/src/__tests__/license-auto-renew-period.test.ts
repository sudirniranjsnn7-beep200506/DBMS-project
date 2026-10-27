// ==============================================================================
// AssetVault: License Auto-Renewal Period Stability & Actor Selection Test Suite
// Course: BCSE307L Database Systems (Fall 2026-27)
// Verifies:
//   1. License renewal period does not grow exponentially across successive runs
//      (start 2026-01-01, end 2026-12-31, 3 runs with clock advancement).
//   2. Prints the new end dates after each run.
//   3. Stored procedure sp_renew_license rolls start_date to old end_date.
//   4. Actor is picked explicitly as TENANT_ADMIN by role name, not role_id order.
//   5. Skips with a logged warning if no active TENANT_ADMIN exists.
// ==============================================================================

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma, systemPrisma } from '../config/prisma';
import { jobScheduler } from '../jobs/scheduler';
import logger from '../config/logger';

describe('License Auto-Renewal Period Stability & Actor Selection Suite', () => {
  // Test entities
  const testTenantSlug1 = `test-autorenew-tenant-${Date.now()}`;
  const testTenantSlug2 = `test-no-admin-tenant-${Date.now()}`;
  const testTenantSlug3 = `test-multi-role-tenant-${Date.now()}`;

  let tenant1Id: string;
  let tenant2Id: string;
  let tenant3Id: string;

  let tenantAdminRole: any;
  let memberRole: any;
  let plan: any;
  let licenseType: any;

  let tenant1AdminUser: any;
  let tenant1Vendor: any;
  let testLicense1Id: string;

  let tenant2MemberUser: any;
  let tenant2Vendor: any;
  let testLicense2Id: string;

  let tenant3MemberUser: any;
  let tenant3AdminUser: any;
  let tenant3Vendor: any;
  let testLicense3Id: string;

  beforeAll(async () => {
    // 1. Fetch common lookup records
    tenantAdminRole = await systemPrisma.role.findUnique({ where: { name: 'TENANT_ADMIN' } });
    memberRole = await systemPrisma.role.findUnique({ where: { name: 'MEMBER' } });
    expect(tenantAdminRole).toBeDefined();
    expect(memberRole).toBeDefined();

    plan = await systemPrisma.plan.findFirst();
    expect(plan).toBeDefined();

    licenseType = await systemPrisma.licenseType.findFirst({ where: { isExpirable: true } });
    expect(licenseType).toBeDefined();

    // 2. Setup Tenant 1: Has active TENANT_ADMIN (for 3-run period stability test)
    const t1 = await systemPrisma.tenant.create({
      data: {
        name: 'AutoRenew Period Tenant',
        slug: testTenantSlug1,
        status: 'ACTIVE',
        contactEmail: 'admin@autorenew-test.com',
        planId: plan.id,
      },
    });
    tenant1Id = t1.id;

    tenant1AdminUser = await systemPrisma.user.create({
      data: {
        tenantId: tenant1Id,
        roleId: tenantAdminRole.id,
        email: `admin-${Date.now()}@autorenew-test.com`,
        fullName: 'Tenant 1 Admin',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456789012345678901234567890',
        isActive: true,
      },
    });

    tenant1Vendor = await systemPrisma.vendor.create({
      data: {
        tenantId: tenant1Id,
        name: `Vendor T1-${Date.now()}`,
      },
    });

    const lic1 = await systemPrisma.license.create({
      data: {
        tenantId: tenant1Id,
        vendorId: tenant1Vendor.id,
        licenseTypeId: licenseType.id,
        name: 'Enterprise Cloud Suite 365',
        licenseKey: `KEY-PERIOD-${Date.now()}`,
        totalSeats: 50,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        cost: new Prisma.Decimal('12000.00'),
        currency: 'USD',
        autoRenew: true,
        status: 'ACTIVE',
      },
    });
    testLicense1Id = lic1.id;

    // 3. Setup Tenant 2: Has ONLY a MEMBER (no TENANT_ADMIN) to verify warning & skipping
    const t2 = await systemPrisma.tenant.create({
      data: {
        name: 'No Admin Tenant',
        slug: testTenantSlug2,
        status: 'ACTIVE',
        contactEmail: 'member@noadmin-test.com',
        planId: plan.id,
      },
    });
    tenant2Id = t2.id;

    tenant2MemberUser = await systemPrisma.user.create({
      data: {
        tenantId: tenant2Id,
        roleId: memberRole.id,
        email: `member-${Date.now()}@noadmin-test.com`,
        fullName: 'Tenant 2 Regular Member',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456789012345678901234567890',
        isActive: true,
      },
    });

    tenant2Vendor = await systemPrisma.vendor.create({
      data: {
        tenantId: tenant2Id,
        name: `Vendor T2-${Date.now()}`,
      },
    });

    const lic2 = await systemPrisma.license.create({
      data: {
        tenantId: tenant2Id,
        vendorId: tenant2Vendor.id,
        licenseTypeId: licenseType.id,
        name: 'Unmanaged Software License',
        licenseKey: `KEY-NOADMIN-${Date.now()}`,
        totalSeats: 10,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        cost: new Prisma.Decimal('500.00'),
        currency: 'USD',
        autoRenew: true,
        status: 'ACTIVE',
      },
    });
    testLicense2Id = lic2.id;

    // 4. Setup Tenant 3: Has MEMBER created first AND TENANT_ADMIN created second
    // Proves selection is by role name = 'TENANT_ADMIN', NOT order by role_id or order of creation
    const t3 = await systemPrisma.tenant.create({
      data: {
        name: 'Multi Role Tenant',
        slug: testTenantSlug3,
        status: 'ACTIVE',
        contactEmail: 'admin@multirole-test.com',
        planId: plan.id,
      },
    });
    tenant3Id = t3.id;

    tenant3MemberUser = await systemPrisma.user.create({
      data: {
        tenantId: tenant3Id,
        roleId: memberRole.id,
        email: `member1-${Date.now()}@multirole-test.com`,
        fullName: 'Tenant 3 Earlier Member',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456789012345678901234567890',
        isActive: true,
      },
    });

    tenant3AdminUser = await systemPrisma.user.create({
      data: {
        tenantId: tenant3Id,
        roleId: tenantAdminRole.id,
        email: `admin2-${Date.now()}@multirole-test.com`,
        fullName: 'Tenant 3 Real Admin',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456789012345678901234567890',
        isActive: true,
      },
    });

    tenant3Vendor = await systemPrisma.vendor.create({
      data: {
        tenantId: tenant3Id,
        name: `Vendor T3-${Date.now()}`,
      },
    });

    const lic3 = await systemPrisma.license.create({
      data: {
        tenantId: tenant3Id,
        vendorId: tenant3Vendor.id,
        licenseTypeId: licenseType.id,
        name: 'Multi-Role Auto-Renew License',
        licenseKey: `KEY-MULTIROLE-${Date.now()}`,
        totalSeats: 25,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        cost: new Prisma.Decimal('3000.00'),
        currency: 'USD',
        autoRenew: true,
        status: 'ACTIVE',
      },
    });
    testLicense3Id = lic3.id;
  });

  afterAll(async () => {
    // Clean up test data inside super_admin & allow_audit_delete session
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT 
          set_config('app.is_super_admin', 'true', true),
          set_config('app.allow_audit_delete', 'true', true),
          set_config('app.current_user_id', '', true);`
      );

      const tenantIds = [tenant1Id, tenant2Id, tenant3Id].filter(Boolean);
      if (tenantIds.length === 0) return;

      const licIds = [testLicense1Id, testLicense2Id, testLicense3Id].filter(Boolean);
      if (licIds.length > 0) {
        await tx.$executeRaw(
          Prisma.sql`DELETE FROM license_renewals WHERE license_id IN (${Prisma.join(
            licIds.map((id) => Prisma.sql`${id}::uuid`)
          )});`
        );
      }

      // 2. Delete licenses
      await tx.$executeRaw(
        Prisma.sql`DELETE FROM licenses WHERE tenant_id IN (${Prisma.join(tenantIds.map((id) => Prisma.sql`${id}::uuid`))});`
      );

      // 3. Delete vendors
      await tx.$executeRaw(
        Prisma.sql`DELETE FROM vendors WHERE tenant_id IN (${Prisma.join(tenantIds.map((id) => Prisma.sql`${id}::uuid`))});`
      );

      // 4. Delete audit logs before users to remove FK references
      await tx.$executeRaw(
        Prisma.sql`DELETE FROM audit_logs WHERE tenant_id IN (${Prisma.join(tenantIds.map((id) => Prisma.sql`${id}::uuid`))});`
      );

      // 5. Delete users
      await tx.$executeRaw(
        Prisma.sql`DELETE FROM users WHERE tenant_id IN (${Prisma.join(tenantIds.map((id) => Prisma.sql`${id}::uuid`))});`
      );

      // 6. Delete notifications
      await tx.$executeRaw(
        Prisma.sql`DELETE FROM notifications WHERE tenant_id IN (${Prisma.join(tenantIds.map((id) => Prisma.sql`${id}::uuid`))});`
      );

      // 7. Delete audit logs generated during user/tenant deletion
      await tx.$executeRaw(
        Prisma.sql`DELETE FROM audit_logs WHERE tenant_id IN (${Prisma.join(tenantIds.map((id) => Prisma.sql`${id}::uuid`))});`
      );

      // 8. Delete tenants
      await tx.$executeRaw(
        Prisma.sql`DELETE FROM tenants WHERE id IN (${Prisma.join(tenantIds.map((id) => Prisma.sql`${id}::uuid`))});`
      );
    });
  });

  // --------------------------------------------------------------------------
  // Test 1: 3-Run Period Stability (Seeds 2026-01-01 to 2026-12-31, prints dates)
  // --------------------------------------------------------------------------
  it('seeds license (2026-01-01 to 2026-12-31), runs 3 times advancing clock, prints dates, and proves period does not grow', async () => {
    // Initial verification
    const initialLic = await systemPrisma.license.findUnique({ where: { id: testLicense1Id } });
    expect(initialLic).toBeDefined();
    const initialStart = initialLic!.startDate.toISOString().split('T')[0]!;
    const initialEnd = initialLic!.endDate!.toISOString().split('T')[0]!;
    expect(initialStart).toBe('2026-01-01');
    expect(initialEnd).toBe('2026-12-31');

    console.log('\n--- Initial License State ---');
    console.log(`Start Date: ${initialStart}`);
    console.log(`End Date:   ${initialEnd}`);

    const MS_PER_DAY = 1000 * 60 * 60 * 24;
    const initialDurationDays = Math.round(
      (new Date(initialEnd).getTime() - new Date(initialStart).getTime()) / MS_PER_DAY
    );
    console.log(`Initial Contract Term Duration: ${initialDurationDays} days`);

    // ========================================================================
    // RUN 1: Advance clock to 2026-12-30 (1 day before expiration)
    // ========================================================================
    const clock1 = new Date('2026-12-30T02:30:00Z');
    console.log(`\nAdvancing clock to: ${clock1.toISOString().split('T')[0]!} (Run 1)...`);
    const res1 = await jobScheduler.runAutoRenewLicensesJob(clock1);
    expect(res1.renewedCount).toBeGreaterThanOrEqual(1);

    const licAfterRun1 = await systemPrisma.license.findUnique({ where: { id: testLicense1Id } });
    const run1Start = licAfterRun1!.startDate.toISOString().split('T')[0]!;
    const run1End = licAfterRun1!.endDate!.toISOString().split('T')[0]!;

    console.log(`>>> [Run 1 Result] New End Date: ${run1End} (New Start Date: ${run1Start})`);
    expect(new Date(run1End).getTime()).toBeGreaterThan(new Date(initialEnd).getTime());
    // Verify start_date rolled to previous end_date (2026-12-31)
    expect(run1Start).toBe(initialEnd);

    const period1Days = Math.round(
      (new Date(run1End).getTime() - new Date(initialEnd).getTime()) / MS_PER_DAY
    );
    console.log(`Run 1 Extension Period: ${period1Days} days`);
    // Should be 364 days (matching 2026-01-01 to 2026-12-31)
    expect(period1Days).toBe(365);

    // ========================================================================
    // RUN 2: Advance clock to 1 day before Run 1's end date
    // ========================================================================
    const clock2 = new Date(new Date(run1End).getTime() - MS_PER_DAY);
    console.log(`\nAdvancing clock to: ${clock2.toISOString().split('T')[0]!} (Run 2)...`);
    const res2 = await jobScheduler.runAutoRenewLicensesJob(clock2);
    expect(res2.renewedCount).toBeGreaterThanOrEqual(1);

    const licAfterRun2 = await systemPrisma.license.findUnique({ where: { id: testLicense1Id } });
    const run2Start = licAfterRun2!.startDate.toISOString().split('T')[0]!;
    const run2End = licAfterRun2!.endDate!.toISOString().split('T')[0]!;

    console.log(`>>> [Run 2 Result] New End Date: ${run2End} (New Start Date: ${run2Start})`);
    expect(new Date(run2End).getTime()).toBeGreaterThan(new Date(run1End).getTime());
    // Verify start_date rolled to previous end_date
    expect(run2Start).toBe(run1End);

    const period2Days = Math.round(
      (new Date(run2End).getTime() - new Date(run1End).getTime()) / MS_PER_DAY
    );
    console.log(`Run 2 Extension Period: ${period2Days} days`);
    // Crucial check: period must NOT grow to 2x (728 days)! Must remain equal to period 1!
    expect(period2Days).toBe(period1Days);

    // ========================================================================
    // RUN 3: Advance clock to 1 day before Run 2's end date
    // ========================================================================
    const clock3 = new Date(new Date(run2End).getTime() - MS_PER_DAY);
    console.log(`\nAdvancing clock to: ${clock3.toISOString().split('T')[0]!} (Run 3)...`);
    const res3 = await jobScheduler.runAutoRenewLicensesJob(clock3);
    expect(res3.renewedCount).toBeGreaterThanOrEqual(1);

    const licAfterRun3 = await systemPrisma.license.findUnique({ where: { id: testLicense1Id } });
    const run3Start = licAfterRun3!.startDate.toISOString().split('T')[0]!;
    const run3End = licAfterRun3!.endDate!.toISOString().split('T')[0]!;

    console.log(`>>> [Run 3 Result] New End Date: ${run3End} (New Start Date: ${run3Start})`);
    expect(new Date(run3End).getTime()).toBeGreaterThan(new Date(run2End).getTime());
    // Verify start_date rolled to previous end_date
    expect(run3Start).toBe(run2End);

    const period3Days = Math.round(
      (new Date(run3End).getTime() - new Date(run2End).getTime()) / MS_PER_DAY
    );
    console.log(`Run 3 Extension Period: ${period3Days} days`);
    // Crucial check: period must NOT grow to 4x (1456 days)! Must remain equal!
    expect(period3Days).toBe(period1Days);

    // Verification summary
    console.log('\n--- Summary of New End Dates Across 3 Runs ---');
    console.log(`Run 1: ${run1End} (+${period1Days} days)`);
    console.log(`Run 2: ${run2End} (+${period2Days} days)`);
    console.log(`Run 3: ${run3End} (+${period3Days} days)`);

    expect(period1Days).toBe(period2Days);
    expect(period2Days).toBe(period3Days);

    // Check license_renewals history: must have exactly 3 records
    const renewals = await systemPrisma.licenseRenewal.findMany({
      where: { licenseId: testLicense1Id },
      orderBy: { renewedAt: 'asc' },
    });
    expect(renewals).toHaveLength(3);
    expect(renewals[0]!.renewedBy).toBe(tenant1AdminUser.id);
    expect(renewals[1]!.renewedBy).toBe(tenant1AdminUser.id);
    expect(renewals[2]!.renewedBy).toBe(tenant1AdminUser.id);
  });

  // --------------------------------------------------------------------------
  // Test 2: Actor selection prefers TENANT_ADMIN by role name, not role_id
  // --------------------------------------------------------------------------
  it('explicitly selects actor as TENANT_ADMIN by role name, even when another user exists with earlier creation or different role', async () => {
    // License 3 was due 2026-12-31 and renewed during the 2026-12-30 evaluation run.
    // Verify that the performer chosen was tenant3AdminUser (role = 'TENANT_ADMIN'),
    // NOT tenant3MemberUser (role = 'MEMBER'), despite member being created first.
    const renewals = await systemPrisma.licenseRenewal.findMany({
      where: { licenseId: testLicense3Id },
      orderBy: { renewedAt: 'desc' },
      take: 1,
    });

    expect(renewals).toHaveLength(1);
    expect(renewals[0]!.renewedBy).toBe(tenant3AdminUser.id);
    expect(renewals[0]!.renewedBy).not.toBe(tenant3MemberUser.id);
  });

  // --------------------------------------------------------------------------
  // Test 3: Skips with logged warning when no TENANT_ADMIN exists
  // --------------------------------------------------------------------------
  it('skips auto-renewal with a logged warning if tenant has no active TENANT_ADMIN', async () => {
    const warnSpy = vi.spyOn(logger, 'warn');

    // Run job for date where License 2 is eligible (due 2026-12-31)
    const clock = new Date('2026-12-30T02:30:00Z');
    await jobScheduler.runAutoRenewLicensesJob(clock);

    // Verify warning was logged
    const warningCalls = warnSpy.mock.calls.filter((call) =>
      typeof call[1] === 'string' && call[1].includes('No active TENANT_ADMIN found')
    );
    expect(warningCalls.length).toBeGreaterThanOrEqual(1);
    expect(warningCalls[0]![1]).toBe('Skipping auto-renewal: No active TENANT_ADMIN found for tenant');

    // Verify License 2 was NOT renewed
    const lic2 = await systemPrisma.license.findUnique({ where: { id: testLicense2Id } });
    expect(lic2!.endDate!.toISOString().split('T')[0]!).toBe('2026-12-31');

    // Verify no renewal record created for License 2
    const renewals = await systemPrisma.licenseRenewal.findMany({
      where: { licenseId: testLicense2Id },
    });
    expect(renewals).toHaveLength(0);
    expect(tenant2MemberUser.id).toBeDefined();

    warnSpy.mockRestore();
  });

  // --------------------------------------------------------------------------
  // Test 4: Irregular initial duration uses fixed configurable default
  // --------------------------------------------------------------------------
  it('extends irregular initial contracts (e.g. 45 days) by configurable default (365 days), not original length', async () => {
    // Setup a license with irregular 45-day initial term: 2026-11-16 to 2026-12-31
    const irregularLic = await systemPrisma.license.create({
      data: {
        tenantId: tenant1Id,
        vendorId: tenant1Vendor.id,
        licenseTypeId: licenseType.id,
        name: 'Mid-Period Irregular Duration License',
        licenseKey: `KEY-IRREGULAR-${Date.now()}`,
        totalSeats: 15,
        startDate: new Date('2026-11-16'),
        endDate: new Date('2026-12-31'),
        cost: new Prisma.Decimal('1500.00'),
        currency: 'USD',
        autoRenew: true,
        status: 'ACTIVE',
      },
    });

    const initialDiffDays = Math.round(
      (new Date('2026-12-31').getTime() - new Date('2026-11-16').getTime()) / (1000 * 60 * 60 * 24)
    );
    expect(initialDiffDays).toBe(45);

    // Run auto-renewal job with clock set to 2026-12-30
    const clock = new Date('2026-12-30T02:30:00Z');
    const result = await jobScheduler.runAutoRenewLicensesJob(clock, 365);
    expect(result.renewedCount).toBeGreaterThanOrEqual(1);

    const renewed = await systemPrisma.license.findUnique({
      where: { id: irregularLic.id },
    });
    expect(renewed).toBeDefined();

    const renewedStart = renewed!.startDate.toISOString().split('T')[0]!;
    const renewedEnd = renewed!.endDate!.toISOString().split('T')[0]!;

    // Start date rolls to previous end date (2026-12-31)
    expect(renewedStart).toBe('2026-12-31');

    // End date must extend by 365 days (2027-12-31), NOT 45 days (2027-02-14)
    const extendedDays = Math.round(
      (new Date(renewedEnd).getTime() - new Date(renewedStart).getTime()) / (1000 * 60 * 60 * 24)
    );
    expect(extendedDays).toBe(365);
    expect(renewedEnd).toBe('2027-12-31');

    // Clean up
    await systemPrisma.licenseRenewal.deleteMany({ where: { licenseId: irregularLic.id } });
    await systemPrisma.license.delete({ where: { id: irregularLic.id } });
  });
});
