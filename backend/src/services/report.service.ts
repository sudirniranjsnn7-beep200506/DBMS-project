// ==============================================================================
// AssetVault: Reporting & Analytics Service
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { reportRepository } from '../repositories/report.repository';
import { tenantRepository } from '../repositories/tenant.repository';
import { NotFoundError } from '../errors/AppError';

export class ReportService {
  public async getDashboard(prismaClient: any, tenantId: string) {
    const [tenant, stats] = await Promise.all([
      tenantRepository.findById(prismaClient, tenantId),
      reportRepository.getDashboardStats(prismaClient, tenantId),
    ]);

    if (!tenant) {
      throw new NotFoundError('Tenant not found');
    }

    return {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
        plan: tenant.plan,
      },
      stats,
    };
  }

  public async getLicenseUtilization(prismaClient: any, tenantId: string) {
    return reportRepository.getLicenseUtilization(prismaClient, tenantId);
  }

  public async getExpiringLicenses(prismaClient: any, tenantId: string) {
    return reportRepository.getExpiringLicenses(prismaClient, tenantId);
  }

  public async getVendorSpend(prismaClient: any, tenantId: string) {
    return reportRepository.getVendorSpend(prismaClient, tenantId);
  }

  public async getSpendByMonth(prismaClient: any, tenantId: string) {
    return reportRepository.getSpendByMonth(prismaClient, tenantId);
  }

  public async getTopAssets(prismaClient: any, tenantId: string) {
    return reportRepository.getTopAssets(prismaClient, tenantId);
  }

  public async getUnlicensedAssets(prismaClient: any, tenantId: string) {
    return reportRepository.getUnlicensedAssets(prismaClient, tenantId);
  }

  public async getAccessTrend(prismaClient: any, tenantId: string) {
    return reportRepository.getAccessTrend(prismaClient, tenantId);
  }

  public async getPlatformOverview(prismaClient: any) {
    return reportRepository.getPlatformOverview(prismaClient);
  }
}

export const reportService = new ReportService();
