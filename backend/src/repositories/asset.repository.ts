// ==============================================================================
// AssetVault: Asset Repository
// Course: BCSE307L Database Systems (Fall 2026-27)
// Reads catalog listings from v_asset_catalog view via Prisma.sql
// ==============================================================================

import { PrismaClient, Asset, Prisma, AssetType, AssetStatus } from '@prisma/client';
import { PaginationParams } from '../utils/pagination.util';

export interface AssetCatalogViewRow {
  asset_id: string;
  tenant_id: string;
  asset_code: string;
  asset_name: string;
  description: string | null;
  asset_type: AssetType;
  asset_status: AssetStatus;
  category_name: string | null;
  category_id?: string | null;
  owner_id?: string;
  owner_name: string;
  owner_email: string;
  latest_version_no: number;
  total_versions: number;
  tags: string[];
  covering_licenses_count: number;
  compliance_status: string;
  created_at: Date;
  updated_at: Date;
}

export interface AssetFilterOptions {
  categoryId?: string;
  assetType?: AssetType;
  status?: AssetStatus;
  tag?: string;
  ownerId?: string;
  complianceStatus?: string;
  createdFrom?: Date;
  createdTo?: Date;
  includeDeleted?: boolean;
}

export class AssetRepository {
  /**
   * Reads from v_asset_catalog view using parameterized Prisma.sql
   */
  public async findCatalog(
    prisma: PrismaClient | any,
    tenantId: string,
    params: PaginationParams,
    filter: AssetFilterOptions = {}
  ): Promise<{ data: AssetCatalogViewRow[]; total: number }> {
    const conditions: Prisma.Sql[] = [Prisma.sql`tenant_id = ${tenantId}::UUID`];

    if (params.q) {
      const searchPattern = `%${params.q}%`;
      conditions.push(
        Prisma.sql`(asset_name ILIKE ${searchPattern} OR asset_code ILIKE ${searchPattern} OR description ILIKE ${searchPattern})`
      );
    }

    if (filter.categoryId) {
      conditions.push(Prisma.sql`category_id = ${filter.categoryId}::UUID`);
    }

    if (filter.ownerId) {
      conditions.push(Prisma.sql`owner_id = ${filter.ownerId}::UUID`);
    }

    if (filter.assetType) {
      conditions.push(Prisma.sql`asset_type = ${filter.assetType}::asset_type`);
    }

    if (filter.status) {
      conditions.push(Prisma.sql`asset_status = ${filter.status}::asset_status`);
    }

    if (filter.complianceStatus) {
      conditions.push(Prisma.sql`compliance_status = ${filter.complianceStatus}`);
    }

    if (filter.tag) {
      conditions.push(Prisma.sql`${filter.tag} = ANY(tags)`);
    }

    if (filter.createdFrom) {
      conditions.push(Prisma.sql`created_at >= ${filter.createdFrom}`);
    }

    if (filter.createdTo) {
      conditions.push(Prisma.sql`created_at <= ${filter.createdTo}`);
    }

    const whereClause = conditions.length > 0
      ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
      : Prisma.empty;

    // Sort order safely mapped
    let sortColumn = 'created_at';
    if (params.sort === 'name') sortColumn = 'asset_name';
    else if (params.sort === 'assetCode') sortColumn = 'asset_code';
    else if (params.sort === 'updatedAt') sortColumn = 'updated_at';

    const orderDirection = params.order === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
    const orderClause = Prisma.sql`ORDER BY ${Prisma.raw(sortColumn)} ${orderDirection}`;

    const [data, countResult] = await Promise.all([
      prisma.$queryRaw(
        Prisma.sql`SELECT * FROM v_asset_catalog ${whereClause} ${orderClause} LIMIT ${params.limit} OFFSET ${params.skip};`
      ),
      prisma.$queryRaw(
        Prisma.sql`SELECT COUNT(*)::int AS count FROM v_asset_catalog ${whereClause};`
      ),
    ]);

    const total = (countResult as any[])[0]?.count || 0;
    return { data: data as AssetCatalogViewRow[], total };
  }

  public async findCatalogCompliance(
    prisma: PrismaClient | any,
    id: string,
    tenantId: string
  ): Promise<{ compliance_status: string; covering_licenses_count: number } | null> {
    // Use the same database view as the asset list so detail pages get the
    // canonical compliance calculation, scoped to the owning tenant.
    const rows = (await prisma.$queryRaw(
      Prisma.sql`SELECT compliance_status, covering_licenses_count
                  FROM v_asset_catalog
                  WHERE asset_id = ${id}::uuid
                    AND tenant_id = ${tenantId}::uuid
                  LIMIT 1`
    )) as Array<{ compliance_status: string; covering_licenses_count: number }>;
    return rows[0] ?? null;
  }

  public async findById(prisma: PrismaClient | any, id: string, includeDeleted = false): Promise<any | null> {
    const where: Prisma.AssetWhereInput = { id };
    if (!includeDeleted) {
      where.deletedAt = null;
    }

    return prisma.asset.findFirst({
      where,
      include: {
        category: { select: { id: true, name: true } },
        owner: { select: { id: true, fullName: true, email: true } },
        versions: { orderBy: { versionNo: 'desc' } },
        assetTags: { include: { tag: true } },
        assetLicenses: {
          include: {
            license: {
              select: {
                id: true,
                name: true,
                status: true,
                totalSeats: true,
                endDate: true,
                vendor: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });
  }

  public async findByCode(prisma: PrismaClient | any, assetCode: string): Promise<Asset | null> {
    return prisma.asset.findFirst({
      where: { assetCode, deletedAt: null },
    });
  }

  public async create(prisma: PrismaClient | any, data: Prisma.AssetCreateInput): Promise<Asset> {
    return prisma.asset.create({
      data,
      include: {
        category: true,
        owner: { select: { id: true, fullName: true, email: true } },
      },
    });
  }

  public async update(prisma: PrismaClient | any, id: string, data: Prisma.AssetUpdateInput): Promise<Asset> {
    return prisma.asset.update({
      where: { id },
      data,
    });
  }

  public async softDelete(prisma: PrismaClient | any, id: string): Promise<Asset> {
    return prisma.asset.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  public async restore(prisma: PrismaClient | any, id: string): Promise<Asset> {
    return prisma.asset.update({
      where: { id },
      data: { deletedAt: null },
    });
  }

  public async attachTag(prisma: PrismaClient | any, assetId: string, tagId: string) {
    return prisma.assetTag.upsert({
      where: { assetId_tagId: { assetId, tagId } },
      create: { assetId, tagId },
      update: {},
    });
  }

  public async detachTag(prisma: PrismaClient | any, assetId: string, tagId: string) {
    return prisma.assetTag.deleteMany({
      where: { assetId, tagId },
    });
  }
}

export const assetRepository = new AssetRepository();
