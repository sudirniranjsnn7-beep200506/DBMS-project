// ==============================================================================
// AssetVault: Reporting & Analytics Repository
// Course: BCSE307L Database Systems (Fall 2026-27)
// Uses PostgreSQL Views, Window Functions, and Analytics Stored Functions
// ==============================================================================

import { Prisma, PrismaClient } from '@prisma/client';

export class ReportRepository {
  /**
   * 1. Tenant Dashboard KPIs (fn_tenant_dashboard_stats)
   */
  public async getDashboardStats(prismaClient: PrismaClient, tenantId: string) {
    const result = await prismaClient.$queryRaw<Array<{ fn_tenant_dashboard_stats: any }>>(
      Prisma.sql`SELECT fn_tenant_dashboard_stats(${tenantId}::uuid);`
    );
    return result[0]?.fn_tenant_dashboard_stats || {};
  }

  /**
   * 2. License Utilization Report (v_license_utilization)
   */
  public async getLicenseUtilization(prismaClient: PrismaClient, tenantId: string) {
    return prismaClient.$queryRaw<any[]>(
      Prisma.sql`
        SELECT 
          license_id,
          tenant_id,
          license_name,
          vendor_name,
          license_type,
          total_seats,
          used_seats,
          available_seats,
          utilization_pct,
          days_to_expiry,
          status,
          start_date,
          end_date,
          cost,
          currency
        FROM v_license_utilization
        WHERE tenant_id = ${tenantId}::uuid
        ORDER BY utilization_pct DESC, license_name ASC;
      `
    );
  }

  /**
   * 3. Expiring Licenses Report (v_expiring_licenses)
   */
  public async getExpiringLicenses(prismaClient: PrismaClient, tenantId: string) {
    return prismaClient.$queryRaw<any[]>(
      Prisma.sql`
        SELECT 
          license_id,
          tenant_id,
          license_name,
          vendor_name,
          total_seats,
          active_allocations,
          start_date,
          end_date,
          days_left,
          urgency_bucket,
          cost,
          currency,
          auto_renew
        FROM v_expiring_licenses
        WHERE tenant_id = ${tenantId}::uuid
        ORDER BY days_left ASC;
      `
    );
  }

  /**
   * 4. Vendor Spend Report (v_vendor_spend)
   */
  public async getVendorSpend(prismaClient: PrismaClient, tenantId: string) {
    return prismaClient.$queryRaw<any[]>(
      Prisma.sql`
        SELECT 
          vendor_id,
          vendor_name,
          contact_email,
          license_count,
          total_initial_cost,
          total_renewal_cost,
          grand_total_spend,
          total_seats_contracted,
          avg_cost_per_seat
        FROM v_vendor_spend
        WHERE tenant_id = ${tenantId}::uuid
        ORDER BY grand_total_spend DESC;
      `
    );
  }

  /**
   * 5. Spend by Month with Running Total (Window Function SUM(...) OVER (...))
   */
  public async getSpendByMonth(prismaClient: PrismaClient, tenantId: string) {
    return prismaClient.$queryRaw<any[]>(
      Prisma.sql`
        WITH monthly_costs AS (
          SELECT 
            TO_CHAR(COALESCE(l.start_date, l.created_at), 'YYYY-MM') AS month_year,
            SUM(l.cost) AS monthly_spend
          FROM licenses l
          WHERE l.tenant_id = ${tenantId}::uuid 
            AND l.deleted_at IS NULL
          GROUP BY TO_CHAR(COALESCE(l.start_date, l.created_at), 'YYYY-MM')
        )
        SELECT 
          month_year,
          COALESCE(monthly_spend, 0)::NUMERIC(12,2) AS monthly_spend,
          SUM(COALESCE(monthly_spend, 0)) OVER (
            ORDER BY month_year ASC
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
          )::NUMERIC(12,2) AS running_total_spend
        FROM monthly_costs
        ORDER BY month_year ASC;
      `
    );
  }

  /**
   * 6. Top 10 Most Downloaded Assets (Window Function RANK() OVER (...))
   */
  public async getTopAssets(prismaClient: PrismaClient, tenantId: string) {
    return prismaClient.$queryRaw<any[]>(
      Prisma.sql`
        WITH asset_downloads AS (
          SELECT 
            a.id AS asset_id,
            a.name AS asset_name,
            a.asset_code,
            COUNT(aal.id) AS download_count
          FROM assets a
          LEFT JOIN asset_access_logs aal 
            ON aal.asset_id = a.id 
            AND aal.action = 'DOWNLOAD'
          WHERE a.tenant_id = ${tenantId}::uuid 
            AND a.deleted_at IS NULL
          GROUP BY a.id, a.name, a.asset_code
        )
        SELECT 
          asset_id,
          asset_name,
          asset_code,
          download_count,
          RANK() OVER (ORDER BY download_count DESC) AS rank
        FROM asset_downloads
        ORDER BY rank ASC, asset_name ASC
        LIMIT 10;
      `
    );
  }

  /**
   * 7. Unlicensed & Expired Assets Report (v_asset_catalog)
   */
  public async getUnlicensedAssets(prismaClient: PrismaClient, tenantId: string) {
    return prismaClient.$queryRaw<any[]>(
      Prisma.sql`
        SELECT 
          asset_id,
          asset_code,
          asset_name,
          asset_type,
          asset_status,
          category_name,
          owner_name,
          owner_email,
          covering_licenses_count,
          compliance_status
        FROM v_asset_catalog
        WHERE tenant_id = ${tenantId}::uuid
          AND compliance_status IN ('UNLICENSED', 'EXPIRED_LICENSE')
        ORDER BY compliance_status ASC, asset_name ASC;
      `
    );
  }

  /**
   * 8. Monthly Access Trends (mv_monthly_access_stats)
   */
  public async getAccessTrend(prismaClient: PrismaClient, tenantId: string) {
    return prismaClient.$queryRaw<any[]>(
      Prisma.sql`
        SELECT 
          month_year,
          download_count,
          checkout_count,
          view_count,
          checkin_count,
          total_access_events,
          active_accessing_users,
          distinct_assets_accessed
        FROM mv_monthly_access_stats
        WHERE tenant_id = ${tenantId}::uuid
        ORDER BY month_year ASC;
      `
    );
  }

  /**
   * 9. Super Admin Platform Overview (v_tenant_summary)
   */
  public async getPlatformOverview(prismaClient: PrismaClient) {
    return prismaClient.$queryRaw<any[]>(
      Prisma.sql`SELECT * FROM v_tenant_summary ORDER BY onboarded_at DESC;`
    );
  }
}

export const reportRepository = new ReportRepository();
