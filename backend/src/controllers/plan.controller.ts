// ==============================================================================
// AssetVault: Plan HTTP Controller
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { Request, Response } from 'express';
import { planService } from '../services/plan.service';
import { getPaginationParams } from '../utils/pagination.util';
import { sendResponse } from '../utils/response.util';
import { asyncHandler } from '../utils/asyncHandler';

export class PlanController {
  public listPlans = asyncHandler(async (req: Request, res: Response) => {
    const params = getPaginationParams(req, 'id', ['id', 'name', 'monthlyPrice', 'maxUsers', 'maxAssets']);
    const isActiveFilter = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;
    const result = await planService.listPlans(req.prisma, params, { isActive: isActiveFilter });
    sendResponse(res, 200, result.data, result.meta);
  });

  public getPlanById = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string, 10);
    const plan = await planService.getPlanById(req.prisma, id);
    sendResponse(res, 200, plan);
  });

  public createPlan = asyncHandler(async (req: Request, res: Response) => {
    const plan = await planService.createPlan(req.prisma, req.body);
    sendResponse(res, 201, plan);
  });

  public updatePlan = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string, 10);
    const plan = await planService.updatePlan(req.prisma, id, req.body);
    sendResponse(res, 200, plan);
  });

  public deletePlan = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string, 10);
    await planService.deletePlan(req.prisma, id);
    sendResponse(res, 200, { message: 'Plan deleted successfully' });
  });
}

export const planController = new PlanController();
