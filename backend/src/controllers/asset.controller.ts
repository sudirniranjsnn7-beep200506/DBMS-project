// ==============================================================================
// AssetVault: Asset HTTP Controller
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { Request, Response } from 'express';
import { assetService } from '../services/asset.service';
import { getPaginationParams } from '../utils/pagination.util';
import { sendResponse } from '../utils/response.util';
import { asyncHandler } from '../utils/asyncHandler';
import { AssetType, AssetStatus } from '@prisma/client';
import { compareVersionsQuerySchema } from '../validators/version.validator';

export class AssetController {
  public listAssets = asyncHandler(async (req: Request, res: Response) => {
    const params = getPaginationParams(req, 'created_at', ['name', 'assetCode', 'created_at', 'updated_at']);

    const filter = {
      categoryId: req.query.categoryId as string,
      assetType: req.query.assetType as AssetType,
      status: req.query.status as AssetStatus,
      tag: req.query.tag as string,
      ownerId: req.query.ownerId as string,
      complianceStatus: req.query.complianceStatus as string,
      createdFrom: req.query.createdFrom ? new Date(req.query.createdFrom as string) : undefined,
      createdTo: req.query.createdTo ? new Date(req.query.createdTo as string) : undefined,
    };

    const result = await assetService.listAssets(req.prisma, req.user!.tenantId!, params, filter);
    sendResponse(res, 200, result.data, result.meta);
  });

  public getAssetById = asyncHandler(async (req: Request, res: Response) => {
    const asset = await assetService.getAssetById(req.prisma, req.params.id as string);
    sendResponse(res, 200, asset);
  });

  public createAsset = asyncHandler(async (req: Request, res: Response) => {
    const asset = await assetService.createAsset(req.prisma, req.user!.tenantId as string, req.user!.id, req.body);
    sendResponse(res, 201, asset);
  });

  public updateAsset = asyncHandler(async (req: Request, res: Response) => {
    const asset = await assetService.updateAsset(req.prisma, req.params.id as string, req.body);
    sendResponse(res, 200, asset);
  });

  public softDeleteAsset = asyncHandler(async (req: Request, res: Response) => {
    await assetService.softDeleteAsset(req.prisma, req.params.id as string);
    sendResponse(res, 200, { message: 'Asset moved to trash (soft deleted)' });
  });

  public restoreAsset = asyncHandler(async (req: Request, res: Response) => {
    const asset = await assetService.restoreAsset(req.prisma, req.params.id as string);
    sendResponse(res, 200, asset);
  });

  public attachTags = asyncHandler(async (req: Request, res: Response) => {
    const tagIds = Array.isArray(req.body.tagIds) ? req.body.tagIds : [req.body.tagId];
    const results = await assetService.attachTags(req.prisma, req.params.id as string, tagIds);
    sendResponse(res, 200, results);
  });

  public detachTag = asyncHandler(async (req: Request, res: Response) => {
    await assetService.detachTag(req.prisma, req.params.id as string, req.params.tagId as string);
    sendResponse(res, 200, { message: 'Tag detached from asset' });
  });

  public createVersion = asyncHandler(async (req: Request, res: Response) => {
    const version = await assetService.createVersion(
      req.user!.tenantId as string,
      req.params.id as string,
      req.body,
      req.user!.id
    );
    sendResponse(res, 201, version);
  });

  public listVersions = asyncHandler(async (req: Request, res: Response) => {
    const versions = await assetService.listVersions(req.prisma, req.params.id as string);
    sendResponse(res, 200, versions);
  });

  public getVersionByNo = asyncHandler(async (req: Request, res: Response) => {
    const versionNo = parseInt(req.params.versionNo as string, 10);
    const version = await assetService.getVersionByNo(req.prisma, req.params.id as string, versionNo);
    sendResponse(res, 200, version);
  });

  public compareVersions = asyncHandler(async (req: Request, res: Response) => {
    const parsed = compareVersionsQuerySchema.parse(req.query);
    const diff = await assetService.compareVersions(req.prisma, req.params.id as string, parsed.from, parsed.to);
    sendResponse(res, 200, diff);
  });

  public bulkImport = asyncHandler(async (req: Request, res: Response) => {
    let csvData = typeof req.body === 'string' ? req.body : req.body?.csv;
    if (!csvData && req.file) {
      csvData = req.file.buffer.toString('utf8');
    }
    const result = await assetService.bulkImport(req.user!.tenantId as string, req.user!.id, csvData || '');
    sendResponse(res, 201, result);
  });

  public exportCsv = asyncHandler(async (req: Request, res: Response) => {
    const csvContent = await assetService.exportCsv(req.prisma, req.user!.tenantId as string);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="assets-export.csv"');
    res.status(200).send(csvContent);
  });
}

export const assetController = new AssetController();
