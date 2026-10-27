// ==============================================================================
// AssetVault: AI Intelligence HTTP Controller
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { Request, Response } from 'express';
import { aiService } from '../services/ai.service';
import { sendResponse } from '../utils/response.util';
import { BadRequestError } from '../errors/AppError';

export class AiController {
  public getContextSummary = async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId || null;
      const snapshot = await aiService.getTenantSnapshot(req.prisma, tenantId);
      return sendResponse(res, 200, {
        tenantId: snapshot.tenantId,
        assetsCount: snapshot.assetsCount,
        licensesCount: snapshot.licensesCount,
        usersCount: snapshot.usersCount,
        totalSeats: snapshot.totalSeats,
        allocatedSeats: snapshot.allocatedSeats,
        unallocatedSeats: snapshot.unallocatedSeats,
        utilizationPct: snapshot.utilizationPct,
        totalAnnualSpend: snapshot.totalAnnualSpend,
        users: snapshot.users.map((u: any) => ({
          id: u.id,
          fullName: u.fullName || u.name || u.email,
          email: u.email,
          role: u.role,
          department: u.department || 'Engineering',
        })),
      });
    } catch (err: any) {
      return res.status(500).json({
        status: 'error',
        message: err?.message || 'Failed to load tenant database context.',
      });
    }
  };

  public runOptimizationAudit = async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId || null;
      const focusArea = typeof req.body?.focusArea === 'string' ? req.body.focusArea : undefined;
      const result = await aiService.generateOptimizationAudit(req.prisma, tenantId, focusArea);
      return sendResponse(res, 200, result);
    } catch (err: any) {
      return res.status(500).json({
        status: 'error',
        message: err?.message || 'Gemini AI optimization audit failed.',
      });
    }
  };

  public askCopilot = async (req: Request, res: Response) => {
    try {
      const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
      if (!prompt) {
        throw new BadRequestError('A question prompt is required.');
      }
      const history = Array.isArray(req.body?.history) ? req.body.history : [];
      const model = typeof req.body?.model === 'string' ? req.body.model : undefined;
      const persona = typeof req.body?.persona === 'string' ? req.body.persona : undefined;
      const tenantId = req.user?.tenantId || null;
      const result = await aiService.askDatabaseCopilot(req.prisma, tenantId, prompt, history, {
        model,
        persona,
      });
      return sendResponse(res, 200, result);
    } catch (err: any) {
      const status = err?.statusCode || 500;
      return res.status(status).json({
        status: 'error',
        message: err?.message || 'Gemini Database Copilot request failed.',
      });
    }
  };

  public extractContract = async (req: Request, res: Response) => {
    try {
      const rawText = typeof req.body?.rawText === 'string' ? req.body.rawText.trim() : '';
      if (!rawText) {
        throw new BadRequestError('Contract or invoice text is required for extraction.');
      }
      const result = await aiService.extractContractMetadata(rawText);
      return sendResponse(res, 200, result);
    } catch (err: any) {
      const status = err?.statusCode || 500;
      return res.status(status).json({
        status: 'error',
        message: err?.message || 'Gemini Contract Extractor failed.',
      });
    }
  };

  public draftEmail = async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId || null;
      const result = await aiService.draftNotificationEmail(req.prisma, tenantId, {
        recipientName: req.body?.recipientName,
        recipientEmail: req.body?.recipientEmail,
        notificationTitle: req.body?.notificationTitle,
        notificationMessage: req.body?.notificationMessage,
        notificationType: req.body?.notificationType,
        licenseName: req.body?.licenseName,
        customContext: req.body?.customContext,
      });
      return sendResponse(res, 200, result);
    } catch (err: any) {
      const status = err?.statusCode || 500;
      return res.status(status).json({
        status: 'error',
        message: err?.message || 'Failed to draft notification email.',
      });
    }
  };
}

export const aiController = new AiController();
