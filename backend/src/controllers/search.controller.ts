// ==============================================================================
// AssetVault: Global Search Controller
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { Request, Response } from 'express';
import { searchService } from '../services/search.service';
import { sendResponse } from '../utils/response.util';
import { asyncHandler } from '../utils/asyncHandler';

export class SearchController {
  public search = asyncHandler(async (req: Request, res: Response) => {
    const q = (req.query.q as string) || '';
    const tenantId = req.user!.tenantId || (req.query.tenantId as string);

    if (!tenantId) {
      sendResponse(res, 200, {
        query: q,
        results: { assets: [], licenses: [], vendors: [], tags: [] },
        total: 0,
      });
      return;
    }

    const callerContext = {
      userId: req.user?.id,
      role: req.user?.role,
      isSuperAdmin: req.user?.isSuperAdmin,
    };

    const data = await searchService.searchAll(tenantId, q, callerContext);
    sendResponse(res, 200, data);
  });

  public searchAssets = asyncHandler(async (req: Request, res: Response) => {
    const q = (req.query.q as string) || '';
    const tenantId = req.user?.tenantId || (req.query.tenantId as string);

    if (!tenantId) {
      sendResponse(res, 200, []);
      return;
    }

    const callerContext = {
      userId: req.user?.id,
      role: req.user?.role,
      isSuperAdmin: req.user?.isSuperAdmin,
    };

    const data = await searchService.searchAssets(tenantId, q, callerContext);
    sendResponse(res, 200, data);
  });

  public searchLicenses = asyncHandler(async (req: Request, res: Response) => {
    const q = (req.query.q as string) || '';
    const tenantId = req.user?.tenantId || (req.query.tenantId as string);

    if (!tenantId) {
      sendResponse(res, 200, []);
      return;
    }

    const callerContext = {
      userId: req.user?.id,
      role: req.user?.role,
      isSuperAdmin: req.user?.isSuperAdmin,
    };

    const data = await searchService.searchLicenses(tenantId, q, callerContext);
    sendResponse(res, 200, data);
  });

  public searchVendors = asyncHandler(async (req: Request, res: Response) => {
    const q = (req.query.q as string) || '';
    const tenantId = req.user?.tenantId || (req.query.tenantId as string);

    if (!tenantId) {
      sendResponse(res, 200, []);
      return;
    }

    const callerContext = {
      userId: req.user?.id,
      role: req.user?.role,
      isSuperAdmin: req.user?.isSuperAdmin,
    };

    const data = await searchService.searchVendors(tenantId, q, callerContext);
    sendResponse(res, 200, data);
  });

  public searchTags = asyncHandler(async (req: Request, res: Response) => {
    const q = (req.query.q as string) || '';
    const tenantId = req.user?.tenantId || (req.query.tenantId as string);

    if (!tenantId) {
      sendResponse(res, 200, []);
      return;
    }

    const callerContext = {
      userId: req.user?.id,
      role: req.user?.role,
      isSuperAdmin: req.user?.isSuperAdmin,
    };

    const data = await searchService.searchTags(tenantId, q, callerContext);
    sendResponse(res, 200, data);
  });
}

export const searchController = new SearchController();
