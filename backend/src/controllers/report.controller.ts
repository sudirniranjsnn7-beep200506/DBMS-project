// ==============================================================================
// AssetVault: Reporting & Analytics HTTP Controller
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { Request, Response } from 'express';
import { reportService } from '../services/report.service';
import { complianceService } from '../services/compliance.service';
import { costOptimizationService } from '../services/costOptimization.service';
import { sendResponse } from '../utils/response.util';
import { asyncHandler } from '../utils/asyncHandler';

export class ReportController {
  public getDashboard = asyncHandler(async (req: Request, res: Response) => {
    const data = await reportService.getDashboard(req.prisma, req.user!.tenantId!);
    sendResponse(res, 200, data);
  });

  public getLicenseUtilization = asyncHandler(async (req: Request, res: Response) => {
    const data = await reportService.getLicenseUtilization(req.prisma, req.user!.tenantId!);
    sendResponse(res, 200, data);
  });

  public getExpiringLicenses = asyncHandler(async (req: Request, res: Response) => {
    const data = await reportService.getExpiringLicenses(req.prisma, req.user!.tenantId!);
    sendResponse(res, 200, data);
  });

  public getVendorSpend = asyncHandler(async (req: Request, res: Response) => {
    const data = await reportService.getVendorSpend(req.prisma, req.user!.tenantId!);
    sendResponse(res, 200, data);
  });

  public getSpendByMonth = asyncHandler(async (req: Request, res: Response) => {
    const data = await reportService.getSpendByMonth(req.prisma, req.user!.tenantId!);
    sendResponse(res, 200, data);
  });

  public getTopAssets = asyncHandler(async (req: Request, res: Response) => {
    const data = await reportService.getTopAssets(req.prisma, req.user!.tenantId!);
    sendResponse(res, 200, data);
  });

  public getUnlicensedAssets = asyncHandler(async (req: Request, res: Response) => {
    const data = await reportService.getUnlicensedAssets(req.prisma, req.user!.tenantId!);
    sendResponse(res, 200, data);
  });

  public getAccessTrend = asyncHandler(async (req: Request, res: Response) => {
    const data = await reportService.getAccessTrend(req.prisma, req.user!.tenantId!);
    sendResponse(res, 200, data);
  });

  public getPlatformOverview = asyncHandler(async (req: Request, res: Response) => {
    const data = await reportService.getPlatformOverview(req.prisma);
    sendResponse(res, 200, data);
  });

  public getComplianceReport = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.tenantId || req.query.tenantId as string;
    const data = await complianceService.getTenantCompliance(tenantId);
    sendResponse(res, 200, data);
  });

  public getUnusedSeatsReport = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.user!.tenantId || req.query.tenantId as string;
    const data = await costOptimizationService.getUnusedSeatsReport(tenantId);
    sendResponse(res, 200, data);
  });
}

export const reportController = new ReportController();
