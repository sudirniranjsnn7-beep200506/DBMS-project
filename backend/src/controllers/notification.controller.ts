// ==============================================================================
// AssetVault: Notification HTTP Controller
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { Request, Response } from 'express';
import { NotificationType } from '@prisma/client';
import { notificationService } from '../services/notification.service';
import { notificationStreamService } from '../services/notificationStream.service';
import { getPaginationParams } from '../utils/pagination.util';
import { sendResponse } from '../utils/response.util';
import { asyncHandler } from '../utils/asyncHandler';

export class NotificationController {
  public listNotifications = asyncHandler(async (req: Request, res: Response) => {
    const params = getPaginationParams(req, 'createdAt', ['createdAt', 'isRead', 'type', 'id']);
    const filter = {
      isRead: req.query.isRead !== undefined ? req.query.isRead === 'true' : undefined,
      type: req.query.type as NotificationType | undefined,
      dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
      dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined,
    };

    const result = await notificationService.listUserNotifications(
      req.prisma,
      req.user!.id,
      params,
      filter
    );

    sendResponse(res, 200, result.data, result.meta);
  });

  public markAsRead = asyncHandler(async (req: Request, res: Response) => {
    const result = await notificationService.markAsRead(req.prisma, req.params.id as string, req.user!.id);
    sendResponse(res, 200, result);
  });

  public markAllAsRead = asyncHandler(async (req: Request, res: Response) => {
    const result = await notificationService.markAllAsRead(req.prisma, req.user!.id);
    sendResponse(res, 200, result);
  });

  public runExpiryCheck = asyncHandler(async (req: Request, res: Response) => {
    const lookaheadDays = req.body.lookaheadDays ? parseInt(req.body.lookaheadDays, 10) : 30;
    const result = await notificationService.triggerExpiryCheck(
      req.user!.tenantId!,
      req.user!.id,
      lookaheadDays
    );
    sendResponse(res, 200, result);
  });

  public streamNotifications = (req: Request, res: Response): void => {
    notificationStreamService.addClient(
      req.user!.id,
      req.user!.tenantId || null,
      res,
      req.user!.role
    );
  };
}

export const notificationController = new NotificationController();
