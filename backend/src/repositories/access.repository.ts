// ==============================================================================
// AssetVault: Asset Access & Audit Log Repository
// Course: BCSE307L Database Systems (Fall 2026-27)
// Enforces atomic checkout validation and seat-gated file download
// ==============================================================================

import { PrismaClient, AccessAction, Prisma } from '@prisma/client';
import { PaginationParams } from '../utils/pagination.util';

export interface AccessLogFilterOptions {
  action?: AccessAction;
  userId?: string;
  assetId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export class AccessRepository {
  public async logAction(
    prisma: PrismaClient | any,
    assetId: string,
    userId: string,
    action: AccessAction,
    metadata: { ipAddress?: string; userAgent?: string } = {}
  ) {
    return prisma.assetAccessLog.create({
      data: {
        assetId,
        userId,
        action,
        ipAddress: metadata.ipAddress || null,
      },
    });
  }

  /**
   * Checks whether the user holds an active allocated seat on an active license covering this asset
   */
  public async verifyUserSeatCoverage(
    prisma: PrismaClient | any,
    assetId: string,
    userId: string
  ): Promise<boolean> {
    const allocations: any[] = await prisma.$queryRaw(
      Prisma.sql`
        SELECT la.id 
        FROM license_allocations la
        JOIN asset_licenses al ON al.license_id = la.license_id
        JOIN licenses l ON l.id = la.license_id
        WHERE al.asset_id = ${assetId}::UUID
          AND la.user_id = ${userId}::UUID
          AND la.status = 'ACTIVE'
          AND l.status = 'ACTIVE'
          AND l.deleted_at IS NULL
          AND (l.end_date IS NULL OR l.end_date >= CURRENT_DATE)
        LIMIT 1;
      `
    );
    return allocations.length > 0;
  }

  public async findAccessLogs(
    prisma: PrismaClient | any,
    params: PaginationParams,
    filter: AccessLogFilterOptions = {}
  ): Promise<{ data: any[]; total: number }> {
    const where: Prisma.AssetAccessLogWhereInput = {};

    if (filter.action) where.action = filter.action;
    if (filter.userId) where.userId = filter.userId;
    if (filter.assetId) where.assetId = filter.assetId;

    if (filter.dateFrom || filter.dateTo) {
      where.accessedAt = {};
      if (filter.dateFrom) where.accessedAt.gte = filter.dateFrom;
      if (filter.dateTo) where.accessedAt.lte = filter.dateTo;
    }

    const [data, total] = await Promise.all([
      prisma.assetAccessLog.findMany({
        where,
        skip: params.skip,
        take: params.limit,
        orderBy: { [params.sort]: params.order },
        include: {
          asset: { select: { id: true, name: true, assetCode: true, assetType: true } },
          user: { select: { id: true, fullName: true, email: true } },
        },
      }),
      prisma.assetAccessLog.count({ where }),
    ]);

    return { data, total };
  }
}

export const accessRepository = new AccessRepository();
