// ==============================================================================
// AssetVault: Background Scheduled Job Runner
// Course: BCSE307L Database Systems (Fall 2026-27)
// Enforces PostgreSQL advisory locks (pg_try_advisory_lock) for safe concurrency
// ==============================================================================

import cron from 'node-cron';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { logger } from '../config/logger';
import { emailService } from '../services/email.service';
import { notificationStreamService } from '../services/notificationStream.service';

// Advisory lock keys (32-bit unique integers)
const LOCK_EXPIRY_NOTIFICATIONS = 1001;
const LOCK_REFRESH_MV = 1002;
const LOCK_AUTO_RENEW = 1003;

// Configurable default renewal period in days (defaults to 365 days)
export const DEFAULT_AUTO_RENEW_PERIOD_DAYS = parseInt(
  process.env.DEFAULT_AUTO_RENEW_PERIOD_DAYS || process.env.AUTO_RENEW_DEFAULT_DAYS || '365',
  10
);

export class JobScheduler {
  private cronTasks: any[] = [];

  /**
   * Safe wrapper that executes a routine only if PostgreSQL advisory transaction lock is granted.
   * Runs the entire routine within an interactive prisma.$transaction with extended timeout,
   * acquiring a transaction-level lock (pg_try_advisory_xact_lock) and setting super_admin RLS context.
   * Lock automatically releases at commit or rollback, preventing connection pool leaks.
   */
  public async withAdvisoryLock<T>(
    lockId: number,
    jobName: string,
    action: (tx: Prisma.TransactionClient) => Promise<T>
  ): Promise<T | null> {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const lockResult: any = await tx.$queryRaw(
            Prisma.sql`SELECT pg_try_advisory_xact_lock(${lockId}) AS locked;`
          );
          const isLocked = Boolean(lockResult?.[0]?.locked);

          if (!isLocked) {
            logger.info({ jobName, lockId }, 'Advisory lock held by another worker instance. Skipping execution.');
            return null;
          }

          logger.info({ jobName, lockId }, `Acquired transaction advisory lock ${lockId}. Executing job...`);

          // Enforce super_admin RLS context for cross-tenant background worker jobs
          await tx.$executeRaw(
            Prisma.sql`SELECT set_config('app.is_super_admin', 'true', true);`
          );

          return await action(tx);
        },
        {
          maxWait: 10000,
          timeout: 60000,
        }
      );
    } catch (err: any) {
      logger.error({ err, jobName, lockId }, `Error in job execution with advisory lock ${lockId}`);
      return null;
    }
  }

  /**
   * Job 1: Daily at 02:00
   * Calls fn_generate_expiry_notifications() across all active tenants, logs count,
   * and dispatches email alerts to TENANT_ADMIN / ASSET_MANAGER recipients.
   */
  public async runExpiryNotificationsJob(): Promise<{ totalNotifications: number; emailsSent: number }> {
    return (
      (await this.withAdvisoryLock(LOCK_EXPIRY_NOTIFICATIONS, 'ExpiryNotifications', async (tx) => {
        logger.info('Starting scheduled license expiry notification routine...');

        // 1. Get all active and trial tenants (excluding SUSPENDED/CANCELLED per TenantStatus enum)
        const tenants: any = await tx.$queryRaw(
          Prisma.sql`SELECT id, name FROM tenants WHERE status IN ('ACTIVE', 'TRIAL');`
        );

        let totalNotifications = 0;

        for (const tenant of tenants) {
          try {
            const res: any = await tx.$queryRaw(
              Prisma.sql`SELECT fn_generate_expiry_notifications(${tenant.id}::uuid, 30) AS created_count;`
            );
            const count = parseInt(res?.[0]?.created_count || '0', 10);
            totalNotifications += count;
            if (count > 0) {
              logger.info({ tenantId: tenant.id, tenantName: tenant.name, count }, 'Generated expiry alerts for tenant');
            }
          } catch (tenantErr: any) {
            logger.error({ tenantErr, tenantId: tenant.id }, 'Failed to run expiry notification check for tenant');
          }
        }

        // 2. Fetch pending notifications (email_sent = false, is_read = false) to dispatch emails
        let emailsSent = 0;
        try {
          const freshAlerts: any = await tx.$queryRaw(Prisma.sql`
            SELECT 
              n.id, n.type, n.message, n.created_at,
              u.email, u.full_name,
              t.name AS tenant_name,
              l.name AS license_name,
              l.end_date
            FROM notifications n
            JOIN users u ON u.id = n.user_id
            JOIN tenants t ON t.id = n.tenant_id
            JOIN licenses l ON l.id = n.license_id
            WHERE n.email_sent = FALSE
              AND n.is_read = FALSE;
          `);

          for (const alert of freshAlerts) {
            const daysLeft = alert.end_date
              ? Math.max(0, Math.ceil((new Date(alert.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
              : 0;

            const sent = await emailService.sendExpiryAlert({
              to: alert.email || '',
              recipientName: alert.full_name || 'Administrator',
              tenantName: alert.tenant_name || 'Organization',
              licenseName: alert.license_name || 'Software License',
              daysLeft,
              expiryDate: alert.end_date ? (new Date(alert.end_date).toISOString().split('T')[0] || 'N/A') : 'N/A',
              type: alert.type as any,
            });

            if (sent) {
              emailsSent++;
              await tx.$executeRaw(
                Prisma.sql`UPDATE notifications SET email_sent = TRUE WHERE id = ${alert.id}::uuid;`
              );
            }
          }
        } catch (emailErr: any) {
          logger.error({ emailErr }, 'Error querying or dispatching expiry emails');
        }

        if (totalNotifications > 0) {
          notificationStreamService.broadcastNotification({
            tenantId: null,
            notification: {
              type: 'DAILY_EXPIRY_RUN',
              message: `Daily expiry audit created ${totalNotifications} alerts across tenants`,
              count: totalNotifications,
              timestamp: new Date().toISOString(),
            },
          });
        }

        logger.info({ totalNotifications, emailsSent }, 'Completed daily license expiry notification run');
        return { totalNotifications, emailsSent };
      })) || { totalNotifications: 0, emailsSent: 0 }
    );
  }

  /**
   * Job 2: Hourly
   * Executes REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_access_stats
   */
  public async runRefreshMaterializedViewJob(): Promise<boolean> {
    const result = await this.withAdvisoryLock(LOCK_REFRESH_MV, 'RefreshMaterializedView', async (tx) => {
      logger.info('Refreshing materialized view mv_monthly_access_stats...');
      await tx.$executeRaw(Prisma.sql`SELECT fn_refresh_monthly_access_stats();`);
      logger.info('Successfully refreshed materialized view mv_monthly_access_stats');
      return true;
    });
    return Boolean(result);
  }

  /**
   * Job 3: Daily
   * Auto-renews licenses where auto_renew = true and end_date is within 3 days,
   * extending by previous period length via sp_renew_license.
   */
  public async runAutoRenewLicensesJob(
    referenceDate?: Date,
    defaultRenewalDays: number = DEFAULT_AUTO_RENEW_PERIOD_DAYS
  ): Promise<{ renewedCount: number }> {
    return (
      (await this.withAdvisoryLock(LOCK_AUTO_RENEW, 'AutoRenewLicenses', async (tx) => {
        logger.info('Checking licenses eligible for automated contract renewal...');

        const currentDate = referenceDate ?? new Date();
        const refDateStr = currentDate.toISOString().split('T')[0];

        // Find active un-deleted licenses due for renewal within 3 days
        const eligibleLicenses: any = await tx.$queryRaw(Prisma.sql`
          SELECT 
            l.id, l.tenant_id, l.name, l.start_date, l.end_date, l.cost,
            u.id AS admin_user_id,
            lr.old_end_date AS last_old_end_date,
            lr.new_end_date AS last_new_end_date
          FROM licenses l
          LEFT JOIN LATERAL (
            SELECT u.id FROM users u
            JOIN roles r ON r.id = u.role_id
            WHERE u.tenant_id = l.tenant_id 
              AND u.is_active = TRUE
              AND r.name = 'TENANT_ADMIN'
            ORDER BY u.created_at ASC
            LIMIT 1
          ) u ON true
          LEFT JOIN LATERAL (
            SELECT old_end_date, new_end_date
            FROM license_renewals
            WHERE license_id = l.id
            ORDER BY renewed_at DESC, id DESC
            LIMIT 1
          ) lr ON true
          WHERE l.auto_renew = TRUE
            AND l.status = 'ACTIVE'
            AND l.deleted_at IS NULL
            AND l.end_date IS NOT NULL
            AND l.end_date >= ${refDateStr}::date
            AND l.end_date <= (${refDateStr}::date + INTERVAL '3 days');
        `);

        let renewedCount = 0;

        for (const lic of eligibleLicenses) {
          if (!lic.admin_user_id) {
            logger.warn(
              { licenseId: lic.id, name: lic.name, tenantId: lic.tenant_id },
              'Skipping auto-renewal: No active TENANT_ADMIN found for tenant'
            );
            continue;
          }

          try {

            const endDate = new Date(lic.end_date);
            let diffDays: number;

            if (lic.last_old_end_date && lic.last_new_end_date) {
              const lastOld = new Date(lic.last_old_end_date);
              const lastNew = new Date(lic.last_new_end_date);
              diffDays = Math.round((lastNew.getTime() - lastOld.getTime()) / (1000 * 60 * 60 * 24));
            } else {
              // Fixed period extension for first-time renewals (e.g. 365 days / billing cycle)
              diffDays = defaultRenewalDays;
            }

            if (diffDays <= 0) diffDays = 365;

            const newEndDate = new Date(endDate.getTime() + diffDays * (1000 * 60 * 60 * 24));
            const formattedNewEndDate = newEndDate.toISOString().split('T')[0];

            logger.info(
              { licenseId: lic.id, name: lic.name, currentEnd: lic.end_date, newEnd: formattedNewEndDate },
              'Calling sp_renew_license for auto-renewal'
            );

            const renewalNote = `Automated period renewal (+${diffDays} days) by AssetVault Background Worker`;

            await tx.$executeRaw(
              Prisma.sql`CALL sp_renew_license(${lic.id}::uuid, ${formattedNewEndDate}::date, ${lic.cost}::numeric, ${lic.admin_user_id}::uuid, ${renewalNote}::text, null);`
            );

            renewedCount++;

            notificationStreamService.broadcastNotification({
              tenantId: lic.tenant_id,
              notification: {
                type: 'AUTO_RENEW_SUCCESS',
                message: `License "${lic.name}" auto-renewed through ${formattedNewEndDate}.`,
                licenseId: lic.id,
                timestamp: new Date().toISOString(),
              },
            });
          } catch (renewErr: any) {
            logger.error({ renewErr, licenseId: lic.id, name: lic.name }, 'Failed to auto-renew license');
          }
        }

        logger.info({ renewedCount }, 'Completed automated license renewal run');
        return { renewedCount };
      })) || { renewedCount: 0 }
    );
  }

  /**
   * Starts all recurring cron jobs
   */
  public startScheduler(): void {
    logger.info('Initializing AssetVault cron schedulers...');

    // 1. Daily at 02:00: Expiry Notifications & Email alerts
    const expiryTask = cron.schedule('0 2 * * *', async () => {
      logger.info('Cron triggered: Daily license expiry notification audit (02:00)');
      await this.runExpiryNotificationsJob();
    });
    this.cronTasks.push(expiryTask);

    // 2. Hourly: Materialized view refresh
    const mvTask = cron.schedule('0 * * * *', async () => {
      logger.info('Cron triggered: Hourly materialized view refresh (mv_monthly_access_stats)');
      await this.runRefreshMaterializedViewJob();
    });
    this.cronTasks.push(mvTask);

    // 3. Daily at 03:00: Auto-renewal of expiring contracts
    const autoRenewTask = cron.schedule('0 3 * * *', async () => {
      logger.info('Cron triggered: Daily automated license renewal audit (03:00)');
      await this.runAutoRenewLicensesJob();
    });
    this.cronTasks.push(autoRenewTask);

    logger.info('✅ AssetVault Background Schedulers active [Daily 02:00 Notifications, Hourly MV Refresh, Daily 03:00 Auto-Renew]');
  }

  /**
   * Stops all running scheduled cron tasks
   */
  public stopScheduler(): void {
    for (const task of this.cronTasks) {
      task.stop();
    }
    this.cronTasks = [];
    logger.info('AssetVault Background Schedulers stopped.');
  }
}

export const jobScheduler = new JobScheduler();
