// ==============================================================================
// AssetVault: License HTTP Controller
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { Request, Response } from 'express';
import { licenseService } from '../services/license.service';
import { exportService } from '../services/export.service';
import { getPaginationParams } from '../utils/pagination.util';
import { sendResponse } from '../utils/response.util';
import { asyncHandler } from '../utils/asyncHandler';
import { LicenseStatus } from '@prisma/client';

export class LicenseController {
  public listLicenses = asyncHandler(async (req: Request, res: Response) => {
    const params = getPaginationParams(req, 'license_name', [
      'license_name',
      'cost',
      'status',
      'total_seats',
      'used_seats',
    ]);

    const filter = {
      status: req.query.status as LicenseStatus,
      vendorId: req.query.vendorId as string,
      licenseTypeId: req.query.licenseTypeId ? parseInt(req.query.licenseTypeId as string, 10) : undefined,
      expiringWithinDays: req.query.expiringWithinDays ? parseInt(req.query.expiringWithinDays as string, 10) : undefined,
      minCost: req.query.minCost ? parseFloat(req.query.minCost as string) : undefined,
      maxCost: req.query.maxCost ? parseFloat(req.query.maxCost as string) : undefined,
      fullyAllocated: req.query.fullyAllocated !== undefined ? req.query.fullyAllocated === 'true' : undefined,
    };

    const result = await licenseService.listLicenses(req.prisma, req.user!.tenantId!, params, filter);
    sendResponse(res, 200, result.data, result.meta);
  });

  public getLicenseById = asyncHandler(async (req: Request, res: Response) => {
    const license = await licenseService.getLicenseById(
      req.prisma,
      req.params.id as string,
      req.user!.role,
      req.user!.id,
      req.user!.tenantId as string
    );
    sendResponse(res, 200, license);
  });

  public createLicense = asyncHandler(async (req: Request, res: Response) => {
    const license = await licenseService.createLicense(req.prisma, req.user!.tenantId as string, req.body);
    sendResponse(res, 201, license);
  });

  public updateLicense = asyncHandler(async (req: Request, res: Response) => {
    const license = await licenseService.updateLicense(req.prisma, req.params.id as string, req.body);
    sendResponse(res, 200, license);
  });

  public softDeleteLicense = asyncHandler(async (req: Request, res: Response) => {
    await licenseService.softDeleteLicense(req.prisma, req.params.id as string);
    sendResponse(res, 200, { message: 'License moved to trash' });
  });

  public restoreLicense = asyncHandler(async (req: Request, res: Response) => {
    const license = await licenseService.restoreLicense(req.prisma, req.params.id as string);
    sendResponse(res, 200, license);
  });

  public renewLicense = asyncHandler(async (req: Request, res: Response) => {
    const { newEndDate, cost, notes } = req.body;
    const result = await licenseService.renewLicense(
      req.user!.tenantId as string,
      req.params.id as string,
      new Date(newEndDate),
      cost,
      req.user!.id,
      notes
    );
    sendResponse(res, 200, result);
  });

  public listRenewals = asyncHandler(async (req: Request, res: Response) => {
    const renewals = await licenseService.findRenewals(req.prisma, req.params.id as string);
    sendResponse(res, 200, renewals);
  });

  public linkAsset = asyncHandler(async (req: Request, res: Response) => {
    const licenseId = (req.params.id || req.params.licenseId) as string;
    const link = await licenseService.linkAsset(req.prisma, req.params.assetId as string, licenseId);
    sendResponse(res, 201, link);
  });

  public unlinkAsset = asyncHandler(async (req: Request, res: Response) => {
    const licenseId = (req.params.id || req.params.licenseId) as string;
    await licenseService.unlinkAsset(req.prisma, req.params.assetId as string, licenseId);
    sendResponse(res, 200, { message: 'Asset unlinked from license' });
  });

  public listLicensesForAsset = asyncHandler(async (req: Request, res: Response) => {
    const licenses = await licenseService.findLicensesByAsset(req.prisma, req.params.id as string);
    sendResponse(res, 200, licenses);
  });

  public listAssetsForLicense = asyncHandler(async (req: Request, res: Response) => {
    const assets = await licenseService.findAssetsByLicense(req.prisma, req.params.id as string);
    sendResponse(res, 200, assets);
  });

  public exportCsv = asyncHandler(async (req: Request, res: Response) => {
    const csvContent = await licenseService.exportCsv(req.prisma, req.user!.tenantId as string);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="licenses-export.csv"');
    res.status(200).send(csvContent);
  });

  public exportPdf = asyncHandler(async (req: Request, res: Response) => {
    const licenseId = req.params.id as string;
    const tenantId = req.user!.tenantId as string;
    const doc = await exportService.generateLicensePdf(licenseId, tenantId);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="license-report-${licenseId}.pdf"`);
    doc.pipe(res);
    doc.end();
  });
}

export const licenseController = new LicenseController();
