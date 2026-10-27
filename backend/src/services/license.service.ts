// ==============================================================================
// AssetVault: License Service
// Course: BCSE307L Database Systems (Fall 2026-27)
// Enforces key masking on list/MEMBER views and audit logging on key reveal
// ==============================================================================

import { licenseRepository, LicenseFilterOptions } from '../repositories/license.repository';
import { NotFoundError, ConflictError, BadRequestError } from '../errors/AppError';
import { PaginationParams, formatPaginatedResponse } from '../utils/pagination.util';
import { toCsv } from '../utils/csv.util';
import { prisma } from '../config/prisma';
import { Prisma } from '@prisma/client';

export class LicenseService {
  private maskKey(key: string | null | undefined): string | null {
    if (!key) return null;
    return `••••••••-${key.slice(-4)}`;
  }

  public async listLicenses(
    prismaClient: any,
    tenantId: string,
    params: PaginationParams,
    filter: LicenseFilterOptions
  ) {
    const { data, total } = await licenseRepository.findUtilization(prismaClient, tenantId, params, filter);
    return formatPaginatedResponse(data, total, params);
  }

  public async getLicenseById(
    prismaClient: any,
    id: string,
    callerRole: string,
    callerUserId: string,
    tenantId: string
  ) {
    const license = await licenseRepository.findById(prismaClient, id);
    if (!license) {
      throw new NotFoundError('License not found');
    }

    const canViewRawKey = callerRole === 'TENANT_ADMIN' || callerRole === 'ASSET_MANAGER' || callerRole === 'SUPER_ADMIN';

    if (canViewRawKey) {
      // Only record key reveal in audit trail if licenseKey is a non-empty string
      if (typeof license.licenseKey === 'string' && license.licenseKey.trim() !== '') {
      await prismaClient.auditLog.create({
        data: {
          tenant: tenantId ? { connect: { id: tenantId } } : undefined,
          tableName: 'licenses',
          recordId: id,
          action: 'UPDATE',
          user: callerUserId ? { connect: { id: callerUserId } } : undefined,
          newData: {
            event: 'LICENSE_KEY_REVEALED',
            accessedBy: callerUserId,
            revealedAt: new Date().toISOString(),
          },
        },
      });
      }

      return license;
    } else {
      // Mask key for standard members
      return {
        ...license,
        licenseKey: this.maskKey(license.licenseKey),
      };
    }
  }

  public async createLicense(prismaClient: any, tenantId: string, data: any) {
    const vendor = await prismaClient.vendor.findFirst({ where: { id: data.vendorId } });
    if (!vendor) throw new BadRequestError('Referenced vendor does not exist');

    const licenseType = await prismaClient.licenseType.findUnique({ where: { id: data.licenseTypeId } });
    if (!licenseType) throw new BadRequestError('Referenced licenseType does not exist');

    return licenseRepository.create(prismaClient, {
      name: data.name,
      licenseKey: data.licenseKey,
      totalSeats: data.totalSeats,
      cost: data.cost,
      currency: data.currency,
      startDate: data.startDate,
      endDate: data.endDate,
      autoRenew: data.autoRenew,
      status: 'ACTIVE',
      vendor: { connect: { id: data.vendorId } },
      licenseType: { connect: { id: data.licenseTypeId } },
      tenant: { connect: { id: tenantId } },
    });
  }

  public async updateLicense(prismaClient: any, id: string, data: any) {
    const existing = await licenseRepository.findById(prismaClient, id);
    if (!existing) throw new NotFoundError('License not found');

    return licenseRepository.update(prismaClient, id, {
      name: data.name,
      licenseKey: data.licenseKey,
      totalSeats: data.totalSeats,
      cost: data.cost,
      currency: data.currency,
      startDate: data.startDate,
      endDate: data.endDate,
      status: data.status,
      autoRenew: data.autoRenew,
      vendor: data.vendorId ? { connect: { id: data.vendorId } } : undefined,
      licenseType: data.licenseTypeId ? { connect: { id: data.licenseTypeId } } : undefined,
    });
  }

  public async softDeleteLicense(prismaClient: any, id: string) {
    const existing = await licenseRepository.findById(prismaClient, id);
    if (!existing) throw new NotFoundError('License not found');
    const activeAllocationsCount = await prismaClient.licenseAllocation.count({
      where: {
        licenseId: id,
        status: 'ACTIVE',
      },
    });

    if (activeAllocationsCount > 0) {
      throw new BadRequestError(
        `Cannot delete license with ${activeAllocationsCount} active seat allocation(s). Please release all seats first.`
      );
    }

    return licenseRepository.softDelete(prismaClient, id);
  }

  public async restoreLicense(prismaClient: any, id: string) {
    const existing = await licenseRepository.findById(prismaClient, id, true);
    if (!existing) throw new NotFoundError('License not found');
    return licenseRepository.restore(prismaClient, id);
  }

  /**
   * Invokes stored procedure sp_renew_license
   */
  public async renewLicense(
    tenantId: string,
    licenseId: string,
    newEndDate: Date,
    cost: number,
    performedBy: string,
    notes?: string
  ) {
    return prisma.$transaction(async (tx: any) => {
      // Super admin context is required so sp_renew_license can insert ledger records into license_renewals
      // and trigger audit_logs writes without RLS policy denial. Security and tenant boundaries
      // are strictly enforced internally by sp_renew_license via PL/pgSQL role and tenant checks.
      await tx.$executeRaw(
        Prisma.sql`SELECT 
          set_config('app.current_tenant_id', ${tenantId}, true),
          set_config('app.current_user_id', ${performedBy}, true),
          set_config('app.is_super_admin', 'true', true);`
      );

      await licenseRepository.renew(tx, licenseId, newEndDate, cost, performedBy, notes);

      return {
        success: true,
        message: 'License renewed successfully via sp_renew_license',
        licenseId,
        newEndDate,
      };
    });
  }

  public async findRenewals(prismaClient: any, licenseId: string) {
    const existing = await licenseRepository.findById(prismaClient, licenseId);
    if (!existing) throw new NotFoundError('License not found');
    return licenseRepository.findRenewals(prismaClient, licenseId);
  }

  public async linkAsset(prismaClient: any, assetId: string, licenseId: string) {
    const [asset, license] = await Promise.all([
      prismaClient.asset.findUnique({ where: { id: assetId } }),
      prismaClient.license.findUnique({ where: { id: licenseId } }),
    ]);

    if (!asset) throw new NotFoundError('Asset not found');
    if (!license) throw new NotFoundError('License not found');

    const existing = await prismaClient.assetLicense.findUnique({
      where: { assetId_licenseId: { assetId, licenseId } },
    });
    if (existing) {
      throw new ConflictError('Asset is already covered by this license.');
    }

    return licenseRepository.linkAsset(prismaClient, assetId, licenseId);
  }

  public async unlinkAsset(prismaClient: any, assetId: string, licenseId: string) {
    return licenseRepository.unlinkAsset(prismaClient, assetId, licenseId);
  }

  public async findLicensesByAsset(prismaClient: any, assetId: string) {
    return licenseRepository.findLicensesByAsset(prismaClient, assetId);
  }

  public async findAssetsByLicense(prismaClient: any, licenseId: string) {
    return licenseRepository.findAssetsByLicense(prismaClient, licenseId);
  }

  public async exportCsv(prismaClient: any, tenantId: string): Promise<string> {
    const { data } = await licenseRepository.findUtilization(
      prismaClient,
      tenantId,
      { page: 1, limit: 10000, skip: 0, sort: 'license_name', order: 'asc' },
      {}
    );

    return toCsv(data, [
      'license_id',
      'license_name',
      'vendor_name',
      'license_type',
      'total_seats',
      'used_seats',
      'available_seats',
      'utilization_pct',
      'days_to_expiry',
      'status',
      'start_date',
      'end_date',
      'cost',
      'currency',
    ]);
  }
}

export const licenseService = new LicenseService();
