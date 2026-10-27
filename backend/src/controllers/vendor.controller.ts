// ==============================================================================
// AssetVault: Vendor HTTP Controller
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { Request, Response } from 'express';
import { vendorService } from '../services/vendor.service';
import { getPaginationParams } from '../utils/pagination.util';
import { sendResponse } from '../utils/response.util';
import { asyncHandler } from '../utils/asyncHandler';

export class VendorController {
  public listVendors = asyncHandler(async (req: Request, res: Response) => {
    const params = getPaginationParams(req, 'name', ['name', 'createdAt']);
    const result = await vendorService.listVendors(req.prisma, params);
    sendResponse(res, 200, result.data, result.meta);
  });

  public getVendorById = asyncHandler(async (req: Request, res: Response) => {
    const vendor = await vendorService.getVendorById(req.prisma, req.params.id as string);
    sendResponse(res, 200, vendor);
  });

  public createVendor = asyncHandler(async (req: Request, res: Response) => {
    const vendor = await vendorService.createVendor(req.prisma, req.body);
    sendResponse(res, 201, vendor);
  });

  public updateVendor = asyncHandler(async (req: Request, res: Response) => {
    const vendor = await vendorService.updateVendor(req.prisma, req.params.id as string, req.body);
    sendResponse(res, 200, vendor);
  });

  public deleteVendor = asyncHandler(async (req: Request, res: Response) => {
    await vendorService.deleteVendor(req.prisma, req.params.id as string);
    sendResponse(res, 200, { message: 'Vendor removed successfully' });
  });
}

export const vendorController = new VendorController();
