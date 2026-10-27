// ==============================================================================
// AssetVault: License Allocation HTTP Controller
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { Request, Response } from 'express';
import { allocationService } from '../services/allocation.service';
import { getPaginationParams } from '../utils/pagination.util';
import { sendResponse } from '../utils/response.util';
import { asyncHandler } from '../utils/asyncHandler';
import { BadRequestError } from '../errors/AppError';

export class AllocationController {
  public allocateSeat = asyncHandler(async (req: Request, res: Response) => {
    const licenseId = (req.params.id || req.params.licenseId || req.body.licenseId) as string;
    if (!licenseId) {
      throw new BadRequestError('License ID is required for allocation');
    }

    const { userId } = req.body;
    const result = await allocationService.allocateSeat(
      req.user!.tenantId as string,
      licenseId,
      userId,
      req.user!.id,
      req.user!.role
    );
    sendResponse(res, 201, result);
  });

  public releaseSeat = asyncHandler(async (req: Request, res: Response) => {
    const allocationId = (req.params.allocationId || req.body.allocationId) as string;
    if (!allocationId) {
      throw new BadRequestError('Allocation ID is required to release seat');
    }

    const { reason } = req.body;
    const result = await allocationService.releaseSeat(
      req.user!.tenantId as string,
      allocationId,
      req.user!.id,
      req.user!.role,
      reason
    );
    sendResponse(res, 200, result);
  });

  public listAllocationsByLicense = asyncHandler(async (req: Request, res: Response) => {
    const licenseId = (req.params.id || req.params.licenseId) as string;
    const params = getPaginationParams(req, 'allocated_at', ['allocated_at', 'status']);
    const result = await allocationService.listAllocationsByLicense(
      req.prisma,
      licenseId,
      params,
      req.user?.id,
      req.user?.role
    );
    sendResponse(res, 200, result.data, result.meta);
  });

  public listAllocationsByUser = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req.params.id || req.params.userId) as string;
    const params = getPaginationParams(req, 'allocated_at', ['allocated_at', 'status']);
    const result = await allocationService.listAllocationsByUser(
      req.prisma,
      userId,
      params,
      req.user!.id,
      req.user!.role
    );
    sendResponse(res, 200, result.data, result.meta);
  });

  public listAllocations = asyncHandler(async (req: Request, res: Response) => {
    const params = getPaginationParams(req, 'allocated_at', ['allocated_at', 'status']);
    const status = req.query.status as string | undefined;
    const result = await allocationService.listAllocations(
      req.prisma,
      req.user!.tenantId as string,
      params,
      status
    );
    sendResponse(res, 200, result.data, result.meta);
  });
}

export const allocationController = new AllocationController();

