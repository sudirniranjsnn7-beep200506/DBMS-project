// ==============================================================================
// AssetVault: Audit Log Service
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { auditRepository, AuditLogFilterOptions } from '../repositories/audit.repository';
import { NotFoundError } from '../errors/AppError';
import { PaginationParams, formatPaginatedResponse } from '../utils/pagination.util';
import { exportService } from './export.service';

export class AuditService {
  public async listAuditLogs(
    prismaClient: any,
    tenantId: string,
    params: PaginationParams,
    filter: AuditLogFilterOptions
  ) {
    const { data, total } = await auditRepository.findAuditLogs(prismaClient, tenantId, params, filter);
    return formatPaginatedResponse(data, total, params);
  }

  public async listAuditLogsCursor(
    prismaClient: any,
    tenantId: string,
    cursor?: string,
    limit: number = 20,
    filter: AuditLogFilterOptions = {}
  ) {
    const take = Math.min(100, Math.max(1, limit));
    const where: any = { tenantId };

    if (filter.tableName) where.tableName = filter.tableName;
    if (filter.action) where.action = filter.action;
    if (filter.userId) where.userId = filter.userId;
    if (filter.dateFrom || filter.dateTo) {
      where.performedAt = {};
      if (filter.dateFrom) where.performedAt.gte = filter.dateFrom;
      if (filter.dateTo) where.performedAt.lte = filter.dateTo;
    }

    const queryOptions: any = {
      where,
      take: take + 1,
      orderBy: { id: 'desc' },
      include: {
        user: {
          select: { id: true, fullName: true, email: true },
        },
      },
    };

    if (cursor) {
      queryOptions.cursor = { id: BigInt(cursor) };
      queryOptions.skip = 1;
    }

    const items = await prismaClient.auditLog.findMany(queryOptions);
    const hasMore = items.length > take;
    const data = hasMore ? items.slice(0, take) : items;
    const nextCursor = hasMore && data.length > 0 ? data[data.length - 1].id.toString() : null;

    return {
      data,
      meta: {
        limit: take,
        hasMore,
        nextCursor,
      },
    };
  }

  public async exportCsv(tenantId: string, filters: any) {
    return exportService.generateAuditLogCsv(tenantId, filters);
  }

  public async getAuditDiff(prismaClient: any, tenantId: string, logId: string) {
    const log = await auditRepository.findById(prismaClient, tenantId, BigInt(logId));
    if (!log) {
      throw new NotFoundError('Audit log entry not found');
    }

    const oldObj = typeof log.oldData === 'object' && log.oldData !== null ? (log.oldData as Record<string, any>) : {};
    const newObj = typeof log.newData === 'object' && log.newData !== null ? (log.newData as Record<string, any>) : {};
    const allKeys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]));

    const changes: Record<string, { previous: any; current: any; changed: boolean }> = {};
    for (const key of allKeys) {
      const prevVal = oldObj[key];
      const currVal = newObj[key];
      const changed = JSON.stringify(prevVal) !== JSON.stringify(currVal);
      changes[key] = {
        previous: prevVal,
        current: currVal,
        changed,
      };
    }

    return {
      id: log.id,
      tableName: log.tableName,
      recordId: log.recordId,
      action: log.action,
      performedAt: log.performedAt,
      performedBy: log.user,
      diff: changes,
      raw: {
        oldData: log.oldData,
        newData: log.newData,
      },
    };
  }
}

export const auditService = new AuditService();
