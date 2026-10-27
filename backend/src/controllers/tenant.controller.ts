// ==============================================================================
// AssetVault: Tenant HTTP Controller
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { Request, Response } from 'express';
import { tenantService } from '../services/tenant.service';
import { tenantExportService } from '../services/tenantExport.service';
import { getPaginationParams } from '../utils/pagination.util';
import { sendResponse } from '../utils/response.util';
import { asyncHandler } from '../utils/asyncHandler';
import { TenantStatus } from '@prisma/client';
import { NotFoundError } from '../errors/AppError';

export class TenantController {
  public listTenants = asyncHandler(async (req: Request, res: Response) => {
    const params = getPaginationParams(req, 'createdAt', ['createdAt', 'name', 'slug', 'status']);
    const status = req.query.status as TenantStatus;
    const planId = req.query.planId ? parseInt(req.query.planId as string, 10) : undefined;

    const result = await tenantService.listTenants(req.prisma, params, { status, planId });
    sendResponse(res, 200, result.data, result.meta);
  });

  public getTenantById = asyncHandler(async (req: Request, res: Response) => {
    const rawId = req.params.id;
    const tenantId = rawId === 'current' ? req.user?.tenantId : rawId;
    if (!req.user?.isSuperAdmin && tenantId !== req.user?.tenantId) {
      throw new NotFoundError('Tenant organization not found');
    }
    const tenant = await tenantService.getTenantById(req.prisma, tenantId!);
    sendResponse(res, 200, tenant);
  });

  public createTenant = asyncHandler(async (req: Request, res: Response) => {
    const tenant = await tenantService.createTenant(req.prisma, req.body, req.user?.id);
    sendResponse(res, 201, tenant);
  });

  public updateTenant = asyncHandler(async (req: Request, res: Response) => {
    const tenant = await tenantService.updateTenant(req.prisma, req.params.id as string, req.body);
    sendResponse(res, 200, tenant);
  });

  public updateStatus = asyncHandler(async (req: Request, res: Response) => {
    const { status } = req.body;
    const tenant = await tenantService.suspendOrActivateTenant(req.params.id as string, status, req.user?.id);
    sendResponse(res, 200, tenant);
  });

  public changePlan = asyncHandler(async (req: Request, res: Response) => {
    const { planId } = req.body;
    const tenant = await tenantService.changePlan(req.prisma, req.params.id as string, planId);
    sendResponse(res, 200, tenant);
  });

  public deleteTenant = asyncHandler(async (req: Request, res: Response) => {
    await tenantService.deleteTenant(req.params.id as string, req.user?.id);
    sendResponse(res, 200, { message: 'Tenant organization removed successfully' });
  });

  public exportTenantData = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.tenantId || (req.params.id as string);
    const data = await tenantExportService.exportTenantData(tenantId);
    const filename = `tenant-archive-${data.tenant.slug}-${new Date().toISOString().split('T')[0]}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(JSON.stringify(data, null, 2));
  });
}

export const tenantController = new TenantController();
