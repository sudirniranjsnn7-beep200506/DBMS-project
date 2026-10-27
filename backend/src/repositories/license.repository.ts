// ==============================================================================
// AssetVault: License Repository
// Course: BCSE307L Database Systems (Fall 2026-27)
// Reads utilization from v_license_utilization view and executes sp_renew_license
// ==============================================================================

import { PrismaClient, License, Prisma, LicenseStatus } from '@prisma/client';
import { PaginationParams } from '../utils/pagination.util';

export interface LicenseUtilizationViewRow {
  license_id: string;
  tenant_id: string;
  vendor_id?: string;
  license_type_id?: number;
  license_name: string;
  vendor_name: string;
  license_type: string;
  total_seats: number;
  used_seats: number;
  available_seats: number;
  utilization_pct: number;
  days_to_expiry: number | null;
  status: LicenseStatus;
  start_date: Date;
  end_date: Date | null;
  cost: number | null;
  currency: string;
}

export interface LicenseFilterOptions {
  status?: LicenseStatus;
  vendorId?: string;
  licenseTypeId?: number;
  expiringWithinDays?: number;
  minCost?: number;
  maxCost?: number;
  fullyAllocated?: boolean;
}

export class LicenseRepository {
  /**
   * Reads from v_license_utilization view using parameterized Prisma.sql
   */
  public async findUtilization(
    prisma: PrismaClient | any,
    tenantId: string,
    params: PaginationParams,
    filter: LicenseFilterOptions = {}
  ): Promise<{ data: LicenseUtilizationViewRow[]; total: number }> {
    const conditions: Prisma.Sql[] = [Prisma.sql`tenant_id = ${tenantId}::UUID`];

    if (params.q) {
      const searchPattern = `%${params.q}%`;
      conditions.push(Prisma.sql`(license_name ILIKE ${searchPattern} OR vendor_name ILIKE ${searchPattern})`);
    }

    if (filter.vendorId) {
      conditions.push(Prisma.sql`vendor_id = ${filter.vendorId}::UUID`);
    }

    if (filter.licenseTypeId !== undefined) {
      conditions.push(Prisma.sql`license_type_id = ${filter.licenseTypeId}`);
    }

    if (filter.status) {
      conditions.push(Prisma.sql`status = ${filter.status}::license_status`);
    }

    if (filter.expiringWithinDays !== undefined) {
      conditions.push(
        Prisma.sql`days_to_expiry IS NOT NULL AND days_to_expiry >= 0 AND days_to_expiry <= ${filter.expiringWithinDays}`
      );
    }

    if (filter.minCost !== undefined) {
      conditions.push(Prisma.sql`cost >= ${filter.minCost}`);
    }

    if (filter.maxCost !== undefined) {
      conditions.push(Prisma.sql`cost <= ${filter.maxCost}`);
    }

    if (filter.fullyAllocated !== undefined) {
      if (filter.fullyAllocated) {
        conditions.push(Prisma.sql`available_seats = 0`);
      } else {
        conditions.push(Prisma.sql`available_seats > 0`);
      }
    }

    const whereClause = conditions.length > 0
      ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
      : Prisma.empty;

    let sortColumn = 'license_name';
    if (params.sort === 'cost') sortColumn = 'cost';
    else if (params.sort === 'status') sortColumn = 'status';
    else if (params.sort === 'totalSeats') sortColumn = 'total_seats';
    else if (params.sort === 'usedSeats') sortColumn = 'used_seats';

    const orderDirection = params.order === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
    const orderClause = Prisma.sql`ORDER BY ${Prisma.raw(sortColumn)} ${orderDirection}`;

    const [data, countResult] = await prisma.$transaction(async (tx: any) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT 
          set_config('app.current_tenant_id', ${tenantId}, true),
          set_config('app.is_super_admin', 'false', true);`
      );
      return Promise.all([
        tx.$queryRaw(
          Prisma.sql`SELECT *, (SELECT CONCAT('••••••••-', RIGHT(lic.license_key, 4)) FROM licenses lic WHERE lic.id = v_license_utilization.license_id) AS license_key FROM v_license_utilization ${whereClause} ${orderClause} LIMIT ${params.limit} OFFSET ${params.skip};`
        ),
        tx.$queryRaw(
          Prisma.sql`SELECT COUNT(*)::int AS count FROM v_license_utilization ${whereClause};`
        ),
      ]);
    });

    const total = (countResult as any[])[0]?.count || 0;
    return { data: data as LicenseUtilizationViewRow[], total };
  }

  public async findById(prisma: PrismaClient | any, id: string, includeDeleted = false): Promise<any | null> {
    const where: Prisma.LicenseWhereInput = { id };
    if (!includeDeleted) {
      where.deletedAt = null;
    }

    return prisma.license.findFirst({
      where,
      include: {
        vendor: { select: { id: true, name: true, contactEmail: true, website: true } },
        licenseType: { select: { id: true, name: true, isSeatBased: true, isExpirable: true } },
        allocations: {
          where: { status: 'ACTIVE' },
          include: { user: { select: { id: true, fullName: true, email: true } } },
        },
        renewals: { orderBy: { renewedAt: 'desc' } },
        _count: { select: { allocations: true, assetLicenses: true } },
      },
    });
  }

  public async create(prisma: PrismaClient | any, data: Prisma.LicenseCreateInput): Promise<License> {
    return prisma.license.create({
      data,
      include: { vendor: true, licenseType: true },
    });
  }

  public async update(prisma: PrismaClient | any, id: string, data: Prisma.LicenseUpdateInput): Promise<License> {
    return prisma.license.update({
      where: { id },
      data,
      include: { vendor: true, licenseType: true },
    });
  }

  public async softDelete(prisma: PrismaClient | any, id: string): Promise<License> {
    return prisma.license.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  public async restore(prisma: PrismaClient | any, id: string): Promise<License> {
    return prisma.license.update({
      where: { id },
      data: { deletedAt: null },
    });
  }

  /**
   * Invokes stored procedure sp_renew_license via parameterized raw SQL
   */
  public async renew(
    prisma: PrismaClient | any,
    licenseId: string,
    newEndDate: Date,
    cost: number,
    performedBy: string,
    notes?: string
  ): Promise<string> {
    const result: any = await prisma.$queryRaw(
      Prisma.sql`CALL sp_renew_license(
        ${licenseId}::UUID,
        ${newEndDate}::DATE,
        ${cost}::NUMERIC,
        ${performedBy}::UUID,
        ${notes || null},
        NULL
      );`
    );
    return result?.[0]?.p_renewal_id || '';
  }

  public async findRenewals(prisma: PrismaClient | any, licenseId: string) {
    return prisma.licenseRenewal.findMany({
      where: { licenseId },
      orderBy: { renewedAt: 'desc' },
      include: {
        renewer: { select: { id: true, fullName: true, email: true } },
      },
    });
  }

  public async linkAsset(prisma: PrismaClient | any, assetId: string, licenseId: string) {
    return prisma.assetLicense.create({
      data: { assetId, licenseId },
      include: { asset: true, license: true },
    });
  }

  public async unlinkAsset(prisma: PrismaClient | any, assetId: string, licenseId: string) {
    return prisma.assetLicense.deleteMany({
      where: { assetId, licenseId },
    });
  }

  public async findLicensesByAsset(prisma: PrismaClient | any, assetId: string) {
    return prisma.assetLicense.findMany({
      where: { assetId },
      include: {
        license: {
          include: {
            vendor: { select: { id: true, name: true } },
            licenseType: true,
          },
        },
      },
    });
  }

  public async findAssetsByLicense(prisma: PrismaClient | any, licenseId: string) {
    return prisma.assetLicense.findMany({
      where: { licenseId },
      include: {
        asset: {
          include: {
            category: { select: { id: true, name: true } },
            owner: { select: { id: true, fullName: true } },
          },
        },
      },
    });
  }
}

export const licenseRepository = new LicenseRepository();
