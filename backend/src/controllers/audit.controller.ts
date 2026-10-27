// ==============================================================================
// AssetVault: Audit Log HTTP Controller
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { Request, Response } from 'express';
import { auditService } from '../services/audit.service';
import { getPaginationParams } from '../utils/pagination.util';
import { sendResponse } from '../utils/response.util';
import { asyncHandler } from '../utils/asyncHandler';
import { AuditAction } from '@prisma/client';

export class AuditController {
  public listAuditLogs = asyncHandler(async (req: Request, res: Response) => {
    const filter = {
      tableName: req.query.tableName as string,
      action: req.query.action as AuditAction,
      userId: req.query.userId as string,
      dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
      dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined,
    };

    // Fast path: Cursor pagination for high-volume logs
    if (req.query.cursor !== undefined) {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const result = await auditService.listAuditLogsCursor(
        req.prisma,
        req.user!.tenantId!,
        req.query.cursor as string,
        limit,
        filter
      );
      sendResponse(res, 200, result.data, result.meta);
      return;
    }

    const params = getPaginationParams(req, 'performed_at', ['performed_at', 'table_name', 'action']);
    const result = await auditService.listAuditLogs(
      req.prisma,
      req.user!.tenantId!,
      params,
      filter
    );

    sendResponse(res, 200, result.data, result.meta);
  });

  public exportCsv = asyncHandler(async (req: Request, res: Response) => {
    const csvContent = await auditService.exportCsv(req.user!.tenantId!, {
      action: req.query.action as string,
      tableName: req.query.tableName as string,
      userId: req.query.userId as string,
      startDate: (req.query.dateFrom || req.query.startDate) as string,
      endDate: (req.query.dateTo || req.query.endDate) as string,
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.csv"');
    res.status(200).send(csvContent);
  });

  public getDiff = asyncHandler(async (req: Request, res: Response) => {
    const diff = await auditService.getAuditDiff(req.prisma, req.user!.tenantId as string, req.params.id as string);
    sendResponse(res, 200, diff);
  });
}

export const auditController = new AuditController();
