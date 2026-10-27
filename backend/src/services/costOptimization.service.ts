// ==============================================================================
// AssetVault: Cost Optimization & Unused Seat Reclamation Service
// Course: BCSE307L Database Systems (Fall 2026-27)
// Identifies dormant seat allocations (>30 days inactive) and aggregates vendor spend
// ==============================================================================

import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

export interface UnusedSeatCandidate {
  allocationId: string;
  licenseId: string;
  licenseName: string;
  vendorName: string;
  userId: string;
  userName: string;
  userEmail: string;
  allocatedAt: string;
  lastActivityAt: string | null;
  inactiveDays: number;
  totalSeats: number;
  licenseCost: number;
  monthlyCostPerSeat: number;
  potentialAnnualSaving: number;
}

export interface ExpensiveVendor {
  vendorId: string;
  vendorName: string;
  contactEmail: string | null;
  licenseCount: number;
  grandTotalSpend: number;
  avgCostPerSeat: number;
}

export interface CostOptimizationReport {
  summary: {
    totalUnusedSeats: number;
    potentialMonthlySavings: number;
    potentialAnnualSavings: number;
    averageCostPerSeat: number;
  };
  reclaimCandidates: UnusedSeatCandidate[];
  topExpensiveVendors: ExpensiveVendor[];
}

export class CostOptimizationService {
  public async getUnusedSeatsReport(tenantId: string): Promise<CostOptimizationReport> {
    return prisma.$transaction(async (tx: any) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT 
          set_config('app.current_tenant_id', ${tenantId}, true),
          set_config('app.is_super_admin', 'false', true);`
      );

      // 1. Query seat allocations with no access log on covered assets in the last 30 days
      const rows: any = await tx.$queryRaw(Prisma.sql`
        SELECT 
          la.id AS allocation_id,
          la.license_id,
          l.name AS license_name,
          l.cost::FLOAT AS license_cost,
          l.total_seats,
          u.id AS user_id,
          u.full_name AS user_name,
          u.email AS user_email,
          v.name AS vendor_name,
          la.allocated_at,
          MAX(aal.accessed_at) AS last_accessed_at
        FROM license_allocations la
        JOIN licenses l ON l.id = la.license_id
        JOIN users u ON u.id = la.user_id
        JOIN vendors v ON v.id = l.vendor_id
        LEFT JOIN asset_licenses al ON al.license_id = l.id
        LEFT JOIN asset_access_logs aal ON aal.asset_id = al.asset_id AND aal.user_id = u.id
        WHERE l.tenant_id = ${tenantId}::uuid
          AND la.status = 'ACTIVE'
          AND l.deleted_at IS NULL
          AND la.allocated_at < (NOW() - INTERVAL '7 days') -- Give 7 days grace period post-allocation
        GROUP BY 
          la.id, la.license_id, l.name, l.cost, l.total_seats, 
          u.id, u.full_name, u.email, v.name, la.allocated_at
        HAVING MAX(aal.accessed_at) IS NULL OR MAX(aal.accessed_at) < (NOW() - INTERVAL '30 days')
        ORDER BY l.cost DESC, la.allocated_at ASC;
      `);

      let totalMonthlySavings = 0;
      let totalAnnualSavings = 0;
      let seatCostSum = 0;

      const reclaimCandidates: UnusedSeatCandidate[] = rows.map((r: any) => {
        const licenseCost = Number(r.license_cost || 0);
        const totalSeats = Math.max(1, Number(r.total_seats || 1));
        const annualSeatCost = Math.round((licenseCost / totalSeats) * 100) / 100;
        const monthlySeatCost = Math.round((annualSeatCost / 12) * 100) / 100;

        totalMonthlySavings += monthlySeatCost;
        totalAnnualSavings += annualSeatCost;
        seatCostSum += annualSeatCost;

        const lastActivityDate = r.last_accessed_at ? new Date(r.last_accessed_at) : null;
        const allocatedDate = new Date(r.allocated_at);
        const referenceDate = lastActivityDate || allocatedDate;
        const inactiveDays = Math.max(0, Math.floor((Date.now() - referenceDate.getTime()) / (1000 * 60 * 60 * 24)));

        return {
          allocationId: r.allocation_id,
          licenseId: r.license_id,
          licenseName: r.license_name,
          vendorName: r.vendor_name,
          userId: r.user_id,
          userName: r.user_name,
          userEmail: r.user_email,
          allocatedAt: allocatedDate.toISOString(),
          lastActivityAt: lastActivityDate ? lastActivityDate.toISOString() : null,
          inactiveDays,
          totalSeats,
          licenseCost,
          monthlyCostPerSeat: monthlySeatCost,
          potentialAnnualSaving: annualSeatCost,
        };
      });

      const averageCostPerSeat =
        reclaimCandidates.length > 0 ? Math.round((seatCostSum / reclaimCandidates.length) * 100) / 100 : 0;

      // 2. Query top expensive vendors directly from the v_vendor_spend view
      const vendorRows: any = await tx.$queryRaw(Prisma.sql`
        SELECT 
          vendor_id,
          vendor_name,
          contact_email,
          license_count::INT AS license_count,
          grand_total_spend::FLOAT AS grand_total_spend,
          avg_cost_per_seat::FLOAT AS avg_cost_per_seat
        FROM v_vendor_spend
        WHERE tenant_id = ${tenantId}::uuid
        ORDER BY grand_total_spend DESC
        LIMIT 5;
      `);

      const topExpensiveVendors: ExpensiveVendor[] = vendorRows.map((v: any) => ({
        vendorId: v.vendor_id,
        vendorName: v.vendor_name,
        contactEmail: v.contact_email,
        licenseCount: Number(v.license_count),
        grandTotalSpend: Number(v.grand_total_spend || 0),
        avgCostPerSeat: Number(v.avg_cost_per_seat || 0),
      }));

      return {
        summary: {
          totalUnusedSeats: reclaimCandidates.length,
          potentialMonthlySavings: Math.round(totalMonthlySavings * 100) / 100,
          potentialAnnualSavings: Math.round(totalAnnualSavings * 100) / 100,
          averageCostPerSeat,
        },
        reclaimCandidates,
        topExpensiveVendors,
      };
    });
  }
}

export const costOptimizationService = new CostOptimizationService();
