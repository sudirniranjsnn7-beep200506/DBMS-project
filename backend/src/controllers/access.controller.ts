// ==============================================================================
// AssetVault: Asset Access HTTP Controller (Checkout, Checkin, Download, Access Logs)
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { Request, Response } from 'express';
import { accessService } from '../services/access.service';
import { getPaginationParams } from '../utils/pagination.util';
import { sendResponse } from '../utils/response.util';
import { asyncHandler } from '../utils/asyncHandler';
import { AccessAction } from '@prisma/client';

export class AccessController {
  public checkout = asyncHandler(async (req: Request, res: Response) => {
    const assetId = (req.params.id || req.params.assetId) as string;
    const metadata = {
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || undefined,
    };

    const result = await accessService.checkoutAsset(
      req.user!.tenantId as string,
      assetId,
      req.user!.id,
      metadata
    );

    sendResponse(res, 200, result);
  });

  public checkin = asyncHandler(async (req: Request, res: Response) => {
    const assetId = (req.params.id || req.params.assetId) as string;
    const metadata = {
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || undefined,
    };

    const result = await accessService.checkinAsset(
      req.user!.tenantId as string,
      assetId,
      req.user!.id,
      metadata
    );

    sendResponse(res, 200, result);
  });

  public download = asyncHandler(async (req: Request, res: Response) => {
    const assetId = (req.params.id || req.params.assetId) as string;
    const metadata = {
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || undefined,
    };

    const result = await accessService.downloadAsset(
      req.user!.tenantId as string,
      assetId,
      req.user!.id,
      metadata
    );

    sendResponse(res, 200, result);
  });

  public listLogsForAsset = asyncHandler(async (req: Request, res: Response) => {
    const assetId = (req.params.id || req.params.assetId) as string;
    const filter = {
      assetId,
      action: req.query.action as AccessAction,
      userId: req.query.userId as string,
      dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
      dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined,
    };

    if (req.query.cursor !== undefined) {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const result = await accessService.listAccessLogsCursor(
        req.prisma,
        req.query.cursor as string,
        limit,
        filter
      );
      sendResponse(res, 200, result.data, result.meta);
      return;
    }

    const params = getPaginationParams(req, 'accessedAt', ['accessedAt', 'action', 'id']);
    const result = await accessService.listAccessLogs(req.prisma, params, filter);
    sendResponse(res, 200, result.data, result.meta);
  });

  public listAllLogs = asyncHandler(async (req: Request, res: Response) => {
    const filter = {
      assetId: req.query.assetId as string,
      action: req.query.action as AccessAction,
      userId: req.query.userId as string,
      dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
      dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined,
    };

    if (req.query.cursor !== undefined) {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const result = await accessService.listAccessLogsCursor(
        req.prisma,
        req.query.cursor as string,
        limit,
        filter
      );
      sendResponse(res, 200, result.data, result.meta);
      return;
    }

    const params = getPaginationParams(req, 'accessedAt', ['accessedAt', 'action', 'id']);
    const result = await accessService.listAccessLogs(req.prisma, params, filter);
    sendResponse(res, 200, result.data, result.meta);
  });
}

export const accessController = new AccessController();
