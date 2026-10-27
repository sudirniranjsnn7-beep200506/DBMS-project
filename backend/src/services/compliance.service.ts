// ==============================================================================
// AssetVault: Enterprise Compliance Engine
// Course: BCSE307L Database Systems (Fall 2026-27)
// Calculates 0-100 Compliance Score using v_asset_catalog, v_license_utilization & v_expiring_licenses
// ==============================================================================

import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

export interface ComplianceFactor {
  name: string;
  weight: number;
  earned: number;
  status: 'OPTIMAL' | 'WARNING' | 'CRITICAL';
  details: string;
}

export interface RemediationItem {
  id: string;
  type: 'UNLICENSED_ASSET' | 'EXPIRED_LICENSE_LINK' | 'SEATS_EXHAUSTED' | 'EXPIRING_SOON';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  actionUrl: string;
  entityId: string;
  entityName: string;
}

export interface ComplianceReport {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D';
  summary: string;
  factors: ComplianceFactor[];
  stats: {
    totalAssets: number;
    compliantAssets: number;
    unlicensedAssets: number;
    expiredLicenseAssets: number;
    totalLicenses: number;
    exhaustedLicenses: number;
    expiringLicenses30d: number;
  };
  remediationItems: RemediationItem[];
}

export class ComplianceService {
  public async getTenantCompliance(tenantId: string): Promise<ComplianceReport> {
    return prisma.$transaction(async (tx: any) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT 
          set_config('app.current_tenant_id', ${tenantId}, true),
          set_config('app.is_super_admin', 'false', true);`
      );

      // 1. Query asset catalog compliance distribution
      const assetStatsResult: any = await tx.$queryRaw(Prisma.sql`
        SELECT 
          COUNT(*)::INT AS total_assets,
          COUNT(*) FILTER (WHERE compliance_status = 'COMPLIANT')::INT AS compliant_assets,
          COUNT(*) FILTER (WHERE compliance_status = 'EXPIRED_LICENSE')::INT AS expired_license_assets,
          COUNT(*) FILTER (WHERE compliance_status = 'UNLICENSED')::INT AS unlicensed_assets
        FROM v_asset_catalog
        WHERE tenant_id = ${tenantId}::uuid;
      `);

      const assetStats = assetStatsResult[0] || {
        total_assets: 0,
        compliant_assets: 0,
        expired_license_assets: 0,
        unlicensed_assets: 0,
      };

      // 2. Query license capacity and seat health
      const licenseStatsResult: any = await tx.$queryRaw(Prisma.sql`
        SELECT 
          COUNT(*)::INT AS total_licenses,
          COUNT(*) FILTER (WHERE available_seats <= 0)::INT AS exhausted_licenses,
          COUNT(*) FILTER (WHERE used_seats > total_seats)::INT AS over_allocated_licenses
        FROM v_license_utilization
        WHERE tenant_id = ${tenantId}::uuid;
      `);

      const licenseStats = licenseStatsResult[0] || {
        total_licenses: 0,
        exhausted_licenses: 0,
        over_allocated_licenses: 0,
      };

      // 3. Query expiring licenses horizon (30 days)
      const expiringStatsResult: any = await tx.$queryRaw(Prisma.sql`
        SELECT 
          COUNT(*)::INT AS total_expiring,
          COUNT(*) FILTER (WHERE urgency_bucket = 'CRITICAL')::INT AS critical_expiring,
          COUNT(*) FILTER (WHERE urgency_bucket = 'WARNING')::INT AS warning_expiring,
          COUNT(*) FILTER (WHERE urgency_bucket = 'NOTICE')::INT AS notice_expiring
        FROM v_expiring_licenses
        WHERE tenant_id = ${tenantId}::uuid;
      `);

      const expiringStats = expiringStatsResult[0] || {
        total_expiring: 0,
        critical_expiring: 0,
        warning_expiring: 0,
        notice_expiring: 0,
      };

      // 4. Calculate Factor Scores
      // Factor 1: Asset License Coverage (40 max)
      const totalAssets = Number(assetStats.total_assets);
      const compliantAssets = Number(assetStats.compliant_assets);
      const unlicensedAssets = Number(assetStats.unlicensed_assets);
      const expiredLicenseAssets = Number(assetStats.expired_license_assets);

      const coverageRatio = totalAssets === 0 ? 1 : compliantAssets / totalAssets;
      const factor1Earned = Math.round(coverageRatio * 40);

      // Factor 2: Seat Over-Allocation & Capacity (25 max)
      const overAllocated = Number(licenseStats.over_allocated_licenses);
      const exhaustedLicenses = Number(licenseStats.exhausted_licenses);
      let factor2Earned = 25 - overAllocated * 15 - exhaustedLicenses * 5;
      if (factor2Earned < 0) factor2Earned = 0;

      // Factor 3: Expired Licenses on Active Assets (20 max)
      let factor3Earned = 20 - expiredLicenseAssets * 5;
      if (factor3Earned < 0) factor3Earned = 0;

      // Factor 4: Expiration Horizon Risk (15 max)
      const criticalExp = Number(expiringStats.critical_expiring);
      const warningExp = Number(expiringStats.warning_expiring);
      const noticeExp = Number(expiringStats.notice_expiring);
      let factor4Earned = 15 - criticalExp * 5 - warningExp * 3 - noticeExp * 1;
      if (factor4Earned < 0) factor4Earned = 0;

      const totalScore = Math.min(100, Math.max(0, factor1Earned + factor2Earned + factor3Earned + factor4Earned));

      let grade: 'A' | 'B' | 'C' | 'D' = 'D';
      if (totalScore >= 90) grade = 'A';
      else if (totalScore >= 75) grade = 'B';
      else if (totalScore >= 60) grade = 'C';

      const factors: ComplianceFactor[] = [
        {
          name: 'Asset Licensing Coverage',
          weight: 40,
          earned: factor1Earned,
          status: factor1Earned >= 35 ? 'OPTIMAL' : factor1Earned >= 25 ? 'WARNING' : 'CRITICAL',
          details: `${compliantAssets} of ${totalAssets} assets covered by active licenses (${Math.round(coverageRatio * 100)}%)`,
        },
        {
          name: 'Seat Availability & Allocation Health',
          weight: 25,
          earned: factor2Earned,
          status: factor2Earned >= 20 ? 'OPTIMAL' : factor2Earned >= 10 ? 'WARNING' : 'CRITICAL',
          details: `${exhaustedLicenses} license(s) at zero available capacity; ${overAllocated} over-allocated`,
        },
        {
          name: 'Active Assets with Expired Licenses',
          weight: 20,
          earned: factor3Earned,
          status: expiredLicenseAssets === 0 ? 'OPTIMAL' : 'CRITICAL',
          details: `${expiredLicenseAssets} active asset(s) linked to software contracts that have expired`,
        },
        {
          name: '30-Day Expiration Horizon',
          weight: 15,
          earned: factor4Earned,
          status: criticalExp === 0 && warningExp === 0 ? 'OPTIMAL' : criticalExp > 0 ? 'CRITICAL' : 'WARNING',
          details: `${expiringStats.total_expiring} license(s) expiring within 30 days (${criticalExp} critical <= 7 days)`,
        },
      ];

      // 5. Build Drill-Down Action Items
      const remediationItems: RemediationItem[] = [];

      // Fetch Unlicensed Assets
      if (unlicensedAssets > 0) {
        const unlicensedRows: any = await tx.$queryRaw(Prisma.sql`
          SELECT asset_id, asset_code, asset_name 
          FROM v_asset_catalog 
          WHERE tenant_id = ${tenantId}::uuid AND compliance_status = 'UNLICENSED' 
          LIMIT 5;
        `);

        for (const row of unlicensedRows) {
          remediationItems.push({
            id: `unlicensed-${row.asset_id}`,
            type: 'UNLICENSED_ASSET',
            priority: 'HIGH',
            title: `Attach license to asset "${row.asset_name}"`,
            description: `Asset ${row.asset_code} has no active covering software or font license.`,
            actionUrl: `/assets/${row.asset_id}`,
            entityId: row.asset_id,
            entityName: row.asset_name,
          });
        }
      }

      // Fetch Assets with Expired Licenses
      if (expiredLicenseAssets > 0) {
        const expiredRows: any = await tx.$queryRaw(Prisma.sql`
          SELECT asset_id, asset_code, asset_name 
          FROM v_asset_catalog 
          WHERE tenant_id = ${tenantId}::uuid AND compliance_status = 'EXPIRED_LICENSE' 
          LIMIT 5;
        `);

        for (const row of expiredRows) {
          remediationItems.push({
            id: `expired-${row.asset_id}`,
            type: 'EXPIRED_LICENSE_LINK',
            priority: 'CRITICAL',
            title: `Renew covering license for asset "${row.asset_name}"`,
            description: `Asset ${row.asset_code} is actively deployed but its covering contract is expired.`,
            actionUrl: `/assets/${row.asset_id}`,
            entityId: row.asset_id,
            entityName: row.asset_name,
          });
        }
      }

      // Fetch Exhausted Licenses
      if (exhaustedLicenses > 0) {
        const exhaustedRows: any = await tx.$queryRaw(Prisma.sql`
          SELECT license_id, license_name, vendor_name, total_seats, used_seats 
          FROM v_license_utilization 
          WHERE tenant_id = ${tenantId}::uuid AND available_seats <= 0 
          LIMIT 5;
        `);

        for (const row of exhaustedRows) {
          remediationItems.push({
            id: `exhausted-${row.license_id}`,
            type: 'SEATS_EXHAUSTED',
            priority: 'HIGH',
            title: `License "${row.license_name}" has reached capacity (${row.used_seats}/${row.total_seats})`,
            description: `Procure additional seats or reclaim unused seats to accommodate team members.`,
            actionUrl: `/licenses/${row.license_id}`,
            entityId: row.license_id,
            entityName: row.license_name,
          });
        }
      }

      // Fetch Expiring Licenses
      if (Number(expiringStats.total_expiring) > 0) {
        const expiringRows: any = await tx.$queryRaw(Prisma.sql`
          SELECT license_id, license_name, vendor_name, days_left, urgency_bucket 
          FROM v_expiring_licenses 
          WHERE tenant_id = ${tenantId}::uuid 
          ORDER BY days_left ASC 
          LIMIT 5;
        `);

        for (const row of expiringRows) {
          remediationItems.push({
            id: `expiring-${row.license_id}`,
            type: 'EXPIRING_SOON',
            priority: row.urgency_bucket === 'CRITICAL' ? 'CRITICAL' : 'MEDIUM',
            title: `License "${row.license_name}" expires in ${row.days_left} days`,
            description: `Contract termination scheduled soon. Perform manual renewal or enable auto-renew.`,
            actionUrl: `/licenses/${row.license_id}`,
            entityId: row.license_id,
            entityName: row.license_name,
          });
        }
      }

      let summary = `Your workspace compliance rating is Grade ${grade} (${totalScore}/100). `;
      if (totalScore >= 90) summary += 'All digital assets and seat allocations are in good standing.';
      else if (totalScore >= 60) summary += 'Minor licensing attention required to avoid compliance gaps.';
      else summary += 'Action required: Immediate remediation needed on unlicensed assets or expired contracts.';

      return {
        score: totalScore,
        grade,
        summary,
        factors,
        stats: {
          totalAssets,
          compliantAssets,
          unlicensedAssets,
          expiredLicenseAssets,
          totalLicenses: Number(licenseStats.total_licenses),
          exhaustedLicenses,
          expiringLicenses30d: Number(expiringStats.total_expiring),
        },
        remediationItems,
      };
    });
  }
}

export const complianceService = new ComplianceService();
