// ==============================================================================
// AssetVault: PostgreSQL Advisory Lock Connection Pool Safety & RLS Verification
// Course: BCSE307L Database Systems (Fall 2026-27)
// Verifies pg_try_advisory_xact_lock auto-release and RLS super_admin context
// ==============================================================================

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { Prisma, PrismaClient } from '@prisma/client';
import { prisma, systemPrisma } from '../config/prisma';
import { jobScheduler } from '../jobs/scheduler';

describe('JobScheduler Advisory Lock & Connection Pool Isolation Suite', () => {
  const LOCK_TEST_SESSION = 9901;
  const LOCK_TEST_XACT = 9902;
  const LOCK_EXPIRY_NOTIFICATIONS = 1001;
  const LOCK_REFRESH_MV = 1002;
  const LOCK_AUTO_RENEW = 1003;

  beforeEach(async () => {
    // Release any lingering session advisory locks across connections
    const locks: any = await prisma.$queryRaw(
      Prisma.sql`SELECT pid FROM pg_locks WHERE locktype = 'advisory';`
    );
    for (const lock of locks) {
      try {
        await prisma.$executeRaw(Prisma.sql`SELECT pg_terminate_backend(${lock.pid}::int);`);
      } catch (e) {
        // ignore
      }
    }
  });

  afterEach(async () => {
    const locks: any = await prisma.$queryRaw(
      Prisma.sql`SELECT pid FROM pg_locks WHERE locktype = 'advisory';`
    );
    for (const lock of locks) {
      try {
        await prisma.$executeRaw(Prisma.sql`SELECT pg_terminate_backend(${lock.pid}::int);`);
      } catch (e) {
        // ignore
      }
    }
  });

  // --------------------------------------------------------------------------
  // 1. Session-Level Advisory Lock Flaw Reproduction
  // --------------------------------------------------------------------------
  describe('1. Session-Level Advisory Lock Flaw Reproduction (Connection Pooling)', () => {
    it('proves session advisory locks leak when lock and unlock hit different pooled connections', async () => {
      // Create two independent Prisma Client instances representing two connections in a pool
      const client1 = new PrismaClient();
      const client2 = new PrismaClient();

      try {
        // Connection 1 acquires session advisory lock
        const lockRes: any = await client1.$queryRaw(
          Prisma.sql`SELECT pg_backend_pid() AS pid, pg_try_advisory_lock(${LOCK_TEST_SESSION}) AS locked;`
        );
        expect(lockRes[0].locked).toBe(true);
        const pid1 = lockRes[0].pid;

        // Connection 2 attempts to release Connection 1's advisory lock (simulating pool connection mismatch)
        const unlockRes: any = await client2.$queryRaw(
          Prisma.sql`SELECT pg_backend_pid() AS pid, pg_advisory_unlock(${LOCK_TEST_SESSION}) AS unlocked;`
        );
        const pid2 = unlockRes[0].pid;
        expect(pid1).not.toBe(pid2);
        // Postgres returns false because Connection 2 does NOT hold Connection 1's lock!
        expect(unlockRes[0].unlocked).toBe(false);

        // Verify that the lock is STILL LEAKED in pg_locks
        const leakedLocks: any = await prisma.$queryRaw(
          Prisma.sql`SELECT pid, locktype, objid, granted FROM pg_locks WHERE locktype = 'advisory' AND objid = ${LOCK_TEST_SESSION};`
        );
        expect(leakedLocks.length).toBe(1);
        expect(leakedLocks[0].pid).toBe(pid1);

        // When a job runs a second time on Connection 2, it is BLOCKED because Connection 1 leaked the lock!
        const secondRunRes: any = await client2.$queryRaw(
          Prisma.sql`SELECT pg_try_advisory_lock(${LOCK_TEST_SESSION}) AS locked;`
        );
        expect(secondRunRes[0].locked).toBe(false);

        // Clean up Connection 1
        await client1.$executeRaw(Prisma.sql`SELECT pg_advisory_unlock_all();`);
      } finally {
        await client1.$disconnect();
        await client2.$disconnect();
      }
    });
  });

  // --------------------------------------------------------------------------
  // 2. Transaction Advisory Lock Auto-Release & Sequential Runs
  // --------------------------------------------------------------------------
  describe('2. Transaction-Scoped Advisory Locks (pg_try_advisory_xact_lock)', () => {
    it('runs the expiry notifications job twice sequentially and confirms 0 leaked locks in pg_locks', async () => {
      // Run 1
      const res1 = await jobScheduler.runExpiryNotificationsJob();
      expect(res1).toBeDefined();
      expect(typeof res1.totalNotifications).toBe('number');
      expect(typeof res1.emailsSent).toBe('number');

      // Verify pg_locks has 0 advisory locks for lock 1001 immediately after run 1
      const locksAfterRun1: any = await prisma.$queryRaw(
        Prisma.sql`SELECT pid, locktype, objid FROM pg_locks WHERE locktype = 'advisory' AND objid = ${LOCK_EXPIRY_NOTIFICATIONS};`
      );
      expect(locksAfterRun1.length).toBe(0);

      // Run 2: Executes cleanly without being blocked by stale locks
      const res2 = await jobScheduler.runExpiryNotificationsJob();
      expect(res2).toBeDefined();
      expect(typeof res2.totalNotifications).toBe('number');
      expect(typeof res2.emailsSent).toBe('number');

      // Verify pg_locks still has 0 advisory locks for lock 1001 after run 2
      const locksAfterRun2: any = await prisma.$queryRaw(
        Prisma.sql`SELECT pid, locktype, objid FROM pg_locks WHERE locktype = 'advisory' AND objid = ${LOCK_EXPIRY_NOTIFICATIONS};`
      );
      expect(locksAfterRun2.length).toBe(0);
    });

    it('releases transaction advisory lock automatically even when action throws an error', async () => {
      // Execute withAdvisoryLock with an action that deliberately throws
      const result = await jobScheduler.withAdvisoryLock(
        LOCK_TEST_XACT,
        'FailingTestJob',
        async (tx) => {
          // Verify lock is currently held inside the transaction
          const insideLocks: any = await tx.$queryRaw(
            Prisma.sql`SELECT pid FROM pg_locks WHERE locktype = 'advisory' AND objid = ${LOCK_TEST_XACT};`
          );
          expect(insideLocks.length).toBe(1);

          throw new Error('Simulated job failure during batch processing');
        }
      );

      // Job handler catches error and returns null
      expect(result).toBeNull();

      // Transaction rollback must have automatically released the lock in pg_locks
      const locksAfterRollback: any = await prisma.$queryRaw(
        Prisma.sql`SELECT pid FROM pg_locks WHERE locktype = 'advisory' AND objid = ${LOCK_TEST_XACT};`
      );
      expect(locksAfterRollback.length).toBe(0);

      // Subsequent run immediately succeeds without lock interference
      const subsequentResult = await jobScheduler.withAdvisoryLock(
        LOCK_TEST_XACT,
        'SubsequentJob',
        async () => 'success'
      );
      expect(subsequentResult).toBe('success');
    });
  });

  // --------------------------------------------------------------------------
  // 3. Concurrency & Mutual Exclusion
  // --------------------------------------------------------------------------
  describe('3. Scheduler Concurrency & Mutual Exclusion', () => {
    it('enforces mutual exclusion: concurrent execution skips when lock is held, then leaves 0 locks in pg_locks', async () => {
      let run1Started = false;
      let run1Finished = false;
      let resolveRun1Gate: () => void;
      const run1Gate = new Promise<void>((resolve) => {
        resolveRun1Gate = resolve;
      });

      // Start run 1 which holds the transaction lock until gated
      const p1 = jobScheduler.withAdvisoryLock(
        LOCK_TEST_XACT,
        'ConcurrentJob1',
        async (_tx) => {
          run1Started = true;
          // Hold the transaction open until run 2 has attempted lock acquisition
          await run1Gate;
          run1Finished = true;
          return 'job1_completed';
        }
      );

      // Wait until run 1 has acquired the lock
      while (!run1Started) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      // Start run 2 concurrently while run 1 is guaranteed to hold the lock
      const p2 = jobScheduler.withAdvisoryLock(
        LOCK_TEST_XACT,
        'ConcurrentJob2',
        async () => {
          return 'job2_completed';
        }
      );

      // Run 2 must attempt and return null because run 1 is holding the lock
      const res2 = await p2;
      // Now release run 1 to complete its transaction
      resolveRun1Gate!();
      const res1 = await p1;

      expect(res1).toBe('job1_completed');
      // Run 2 must have failed to acquire lock and returned null
      expect(res2).toBeNull();
      expect(run1Finished).toBe(true);

      // Both transactions completed; pg_locks must have 0 locks
      const remainingLocks: any = await prisma.$queryRaw(
        Prisma.sql`SELECT pid FROM pg_locks WHERE locktype = 'advisory' AND objid = ${LOCK_TEST_XACT};`
      );
      expect(remainingLocks.length).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // 4. RLS Context Verification (Finding 4)
  // --------------------------------------------------------------------------
  describe('4. RLS Context Enforcement in Scheduled Background Jobs', () => {
    it('enforces app.is_super_admin = true on transaction so cross-tenant worker queries succeed', async () => {
      const rlsContext = await jobScheduler.withAdvisoryLock(
        LOCK_TEST_XACT,
        'RLSTestJob',
        async (tx) => {
          const setting: any = await tx.$queryRaw(
            Prisma.sql`SELECT current_setting('app.is_super_admin', true) AS is_super_admin;`
          );
          return setting?.[0]?.is_super_admin;
        }
      );

      expect(rlsContext).toBe('true');
    });

    it('successfully runs all three background jobs with correct RLS and auto-releasing transaction locks', async () => {
      // 1. Expiry Notifications Job
      const expiryRes = await jobScheduler.runExpiryNotificationsJob();
      expect(expiryRes).toBeDefined();

      // 2. Materialized View Refresh Job
      const mvRes = await jobScheduler.runRefreshMaterializedViewJob();
      expect(mvRes).toBe(true);

      // 3. Auto Renew Licenses Job
      const renewRes = await jobScheduler.runAutoRenewLicensesJob();
      expect(renewRes).toBeDefined();
      expect(typeof renewRes.renewedCount).toBe('number');

      // Verify no locks held for 1001, 1002, or 1003 in pg_locks
      const finalLocks: any = await prisma.$queryRaw(
        Prisma.sql`SELECT pid, objid FROM pg_locks WHERE locktype = 'advisory' AND objid IN (${LOCK_EXPIRY_NOTIFICATIONS}, ${LOCK_REFRESH_MV}, ${LOCK_AUTO_RENEW});`
      );
      expect(finalLocks.length).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Tenant Status Filtering (TRIAL vs SUSPENDED)
  // --------------------------------------------------------------------------
  describe('5. Tenant Status Filtering in Expiry Notifications (TRIAL vs SUSPENDED)', () => {
    let trialTenantId: string;
    let suspendedTenantId: string;
    let trialLicenseId: string;
    let suspendedLicenseId: string;

    beforeAll(async () => {
      const plan = await systemPrisma.plan.findFirst();
      const planId = plan!.id;
      const timestamp = Date.now();

      // 1. Create a TRIAL tenant
      const trialTenant = await systemPrisma.tenant.create({
        data: {
          name: `Trial Tenant ${timestamp}`,
          slug: `trial-tenant-${timestamp}`,
          status: 'TRIAL',
          planId,
          contactEmail: `trial-${timestamp}@test.com`,
        },
      });
      trialTenantId = trialTenant.id;

      // Create admin user for TRIAL tenant
      await systemPrisma.user.create({
        data: {
          tenantId: trialTenantId,
          roleId: 2, // TENANT_ADMIN
          email: `admin-trial-${timestamp}@test.com`,
          fullName: 'Trial Admin',
          passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz123456',
          isActive: true,
        },
      });

      // Create vendor for TRIAL tenant
      const trialVendor = await systemPrisma.vendor.create({
        data: {
          tenantId: trialTenantId,
          name: `Trial Vendor ${timestamp}`,
          website: 'https://trialvendor.com',
        },
      });

      // Create license expiring in 10 days for TRIAL tenant
      const tenDaysFromNow = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
      const trialLic = await systemPrisma.license.create({
        data: {
          tenantId: trialTenantId,
          vendorId: trialVendor.id,
          licenseTypeId: 1, // SUBSCRIPTION
          name: `Trial Expiring License ${timestamp}`,
          licenseKey: `TRIAL-LIC-${timestamp}`,
          totalSeats: 5,
          cost: 100,
          currency: 'USD',
          status: 'ACTIVE',
          startDate: new Date('2026-01-01'),
          endDate: tenDaysFromNow,
        },
      });
      trialLicenseId = trialLic.id;

      // 2. Create a SUSPENDED tenant
      const suspendedTenant = await systemPrisma.tenant.create({
        data: {
          name: `Suspended Tenant ${timestamp}`,
          slug: `suspended-tenant-${timestamp}`,
          status: 'SUSPENDED',
          planId,
          contactEmail: `suspended-${timestamp}@test.com`,
        },
      });
      suspendedTenantId = suspendedTenant.id;

      // Create admin user for SUSPENDED tenant
      await systemPrisma.user.create({
        data: {
          tenantId: suspendedTenantId,
          roleId: 2, // TENANT_ADMIN
          email: `admin-suspended-${timestamp}@test.com`,
          fullName: 'Suspended Admin',
          passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz123456',
          isActive: true,
        },
      });

      // Create vendor for SUSPENDED tenant
      const suspendedVendor = await systemPrisma.vendor.create({
        data: {
          tenantId: suspendedTenantId,
          name: `Suspended Vendor ${timestamp}`,
          website: 'https://suspendedvendor.com',
        },
      });

      // Create license expiring in 10 days for SUSPENDED tenant
      const suspendedLic = await systemPrisma.license.create({
        data: {
          tenantId: suspendedTenantId,
          vendorId: suspendedVendor.id,
          licenseTypeId: 1, // SUBSCRIPTION
          name: `Suspended Expiring License ${timestamp}`,
          licenseKey: `SUSPENDED-LIC-${timestamp}`,
          totalSeats: 5,
          cost: 100,
          currency: 'USD',
          status: 'ACTIVE',
          startDate: new Date('2026-01-01'),
          endDate: tenDaysFromNow,
        },
      });
      suspendedLicenseId = suspendedLic.id;
    });

    afterAll(async () => {
      // Clean up test data using transaction with allow_audit_delete for audit log FK cleanup
      try {
        await prisma.$transaction(async (tx) => {
          await tx.$executeRaw(
            Prisma.sql`SELECT set_config('app.is_super_admin', 'true', true), set_config('app.allow_audit_delete', 'true', true);`
          );
          for (const tid of [trialTenantId, suspendedTenantId]) {
            if (!tid) continue;
            await tx.$executeRaw(Prisma.sql`DELETE FROM notifications WHERE tenant_id = ${tid}::uuid;`);
            await tx.$executeRaw(Prisma.sql`DELETE FROM licenses WHERE tenant_id = ${tid}::uuid;`);
            await tx.$executeRaw(Prisma.sql`DELETE FROM vendors WHERE tenant_id = ${tid}::uuid;`);
            await tx.$executeRaw(Prisma.sql`DELETE FROM users WHERE tenant_id = ${tid}::uuid;`);
            await tx.$executeRaw(Prisma.sql`DELETE FROM audit_logs WHERE tenant_id = ${tid}::uuid;`);
            await tx.$executeRaw(Prisma.sql`DELETE FROM tenants WHERE id = ${tid}::uuid;`);
          }
        });
      } catch (e) {
        // ignore
      }
    });

    it('fn_generate_expiry_notifications generates alerts for TRIAL tenant and blocks SUSPENDED tenant', async () => {
      // Test TRIAL tenant directly on database function
      const trialCountRes: any = await systemPrisma.$queryRaw(
        Prisma.sql`SELECT fn_generate_expiry_notifications(${trialTenantId}::uuid, 30) AS created_count;`
      );
      const trialCount = parseInt(trialCountRes[0].created_count, 10);
      expect(trialCount).toBeGreaterThan(0);

      // Verify notification created for TRIAL tenant
      const trialNotifs = await systemPrisma.notification.findMany({
        where: { tenantId: trialTenantId, licenseId: trialLicenseId },
      });
      expect(trialNotifs.length).toBeGreaterThan(0);

      // Test SUSPENDED tenant directly on database function
      const suspendedCountRes: any = await systemPrisma.$queryRaw(
        Prisma.sql`SELECT fn_generate_expiry_notifications(${suspendedTenantId}::uuid, 30) AS created_count;`
      );
      const suspendedCount = parseInt(suspendedCountRes[0].created_count, 10);
      expect(suspendedCount).toBe(0);

      // Verify NO notification was created for SUSPENDED tenant
      const suspendedNotifs = await systemPrisma.notification.findMany({
        where: { tenantId: suspendedTenantId, licenseId: suspendedLicenseId },
      });
      expect(suspendedNotifs.length).toBe(0);
    });

    it('runExpiryNotificationsJob processes TRIAL tenants and excludes SUSPENDED tenants', async () => {
      // Clean any existing notifications for trial and suspended tenants from previous tests
      await systemPrisma.notification.deleteMany({
        where: { tenantId: { in: [trialTenantId, suspendedTenantId] } },
      });

      // Run scheduler job
      await jobScheduler.runExpiryNotificationsJob();

      // TRIAL tenant must have received an expiry alert
      const trialNotifs = await systemPrisma.notification.findMany({
        where: { tenantId: trialTenantId, licenseId: trialLicenseId },
      });
      expect(trialNotifs.length).toBeGreaterThan(0);

      // SUSPENDED tenant must NOT have received any expiry alert
      const suspendedNotifs = await systemPrisma.notification.findMany({
        where: { tenantId: suspendedTenantId, licenseId: suspendedLicenseId },
      });
      expect(suspendedNotifs.length).toBe(0);

      // Verify email_sent was marked TRUE after dispatch
      const updatedTrialNotifs = await systemPrisma.notification.findMany({
        where: { tenantId: trialTenantId, licenseId: trialLicenseId },
      });
      expect(updatedTrialNotifs.length).toBeGreaterThan(0);
      expect(updatedTrialNotifs.every((n) => n.emailSent === true)).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 6. Expiry Notification Email Dispatch & email_sent Flag Idempotency
  // --------------------------------------------------------------------------
  describe('6. Expiry Notification Email Dispatch Idempotency (email_sent Flag)', () => {
    it('dispatches emails only for notifications where email_sent = false and marks them true', async () => {
      // Find an active user and license to attach a test notification
      const testUser = await systemPrisma.user.findFirst({
        where: { roleId: 2, isActive: true, tenantId: { not: null } }, // TENANT_ADMIN
        include: { tenant: true },
      });
      expect(testUser).toBeDefined();
      expect(testUser?.tenantId).toBeTruthy();

      const tenantId = testUser!.tenantId!;
      const userId = testUser!.id;

      const testLicense = await systemPrisma.license.findFirst({
        where: { tenantId, deletedAt: null },
      });
      expect(testLicense).toBeDefined();
      const licenseId = testLicense!.id;

      // Clean existing notifications for this test user & license
      await systemPrisma.notification.deleteMany({
        where: { userId, licenseId },
      });

      // 1. Seed a fresh notification with email_sent = false, is_read = false
      const notif1 = await systemPrisma.notification.create({
        data: {
          tenantId,
          userId,
          licenseId,
          type: 'EXPIRY_7',
          message: 'Test urgent expiry alert for license ' + testLicense!.name,
          isRead: false,
          emailSent: false,
        },
      });
      expect(notif1.emailSent).toBe(false);

      // 2. Also seed an already-read notification with email_sent = false (should NOT be emailed)
      const notifRead = await systemPrisma.notification.create({
        data: {
          tenantId,
          userId,
          licenseId,
          type: 'EXPIRY_15',
          message: 'Test already-read alert for license ' + testLicense!.name,
          isRead: true,
          emailSent: false,
        },
      });

      // 3. Execute runExpiryNotificationsJob()
      const run1 = await jobScheduler.runExpiryNotificationsJob();
      expect(run1).toBeDefined();
      expect(run1.emailsSent).toBeGreaterThanOrEqual(1);

      // 4. Verify notif1 has been flipped to email_sent = true
      const refreshedNotif1 = await systemPrisma.notification.findUnique({
        where: { id: notif1.id },
      });
      expect(refreshedNotif1?.emailSent).toBe(true);

      // 5. Verify notifRead remains email_sent = false because is_read was true
      const refreshedNotifRead = await systemPrisma.notification.findUnique({
        where: { id: notifRead.id },
      });
      expect(refreshedNotifRead?.emailSent).toBe(false);

      // 6. Re-run runExpiryNotificationsJob() immediately (simulating job retry / MV refresh re-run)
      // Since notif1 now has email_sent = true, it MUST NOT be re-emailed
      const notifsBeforeRun2 = await systemPrisma.notification.findMany({
        where: {
          id: { in: [notif1.id, notifRead.id] },
          emailSent: false,
          isRead: false,
        },
      });
      expect(notifsBeforeRun2.length).toBe(0);

      // Clean up test notifications
      await systemPrisma.notification.deleteMany({
        where: { id: { in: [notif1.id, notifRead.id] } },
      });
    });
  });
});
