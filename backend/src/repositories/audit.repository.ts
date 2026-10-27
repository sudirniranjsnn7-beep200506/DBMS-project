// ==============================================================================
// AssetVault: Audit Log Repository
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { Prisma, PrismaClient, AuditAction } from '@prisma/client';
import { PaginationParams } from '../utils/pagination.util';

export interface AuditLogFilterOptions {
  tableName?: string;
  action?: AuditAction;
  userId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export class AuditRepository {
  public async findAuditLogs(
    prismaClient: PrismaClient,
    tenantId: string,
    params: PaginationParams,
    filter: AuditLogFilterOptions = {}
  ) {
    const where: Prisma.AuditLogWhereInput = {
      tenantId,
      ...(filter.tableName ? { tableName: { equals: filter.tableName, mode: 'insensitive' } } : {}),
      ...(filter.action ? { action: filter.action } : {}),
      ...(filter.userId ? { userId: filter.userId } : {}),
      ...(filter.dateFrom || filter.dateTo
        ? {
            performedAt: {
              ...(filter.dateFrom ? { gte: filter.dateFrom } : {}),
              ...(filter.dateTo ? { lte: filter.dateTo } : {}),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      prismaClient.auditLog.findMany({
        where,
        skip: params.skip,
        take: params.limit,
        orderBy: { performedAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      }),
      prismaClient.auditLog.count({ where }),
    ]);

    // Serialize BigInt IDs to string
    const formattedData = data.map((log) => ({
      ...log,
      id: log.id.toString(),
    }));

    return { data: formattedData, total };
  }

  public async findById(prismaClient: PrismaClient, tenantId: string, id: bigint | number) {
    const log = await prismaClient.auditLog.findFirst({
      where: {
        id: BigInt(id),
        tenantId,
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    if (!log) return null;

    return {
      ...log,
      id: log.id.toString(),
    };
  }
}

export const auditRepository = new AuditRepository();
