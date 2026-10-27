// ==============================================================================
// AssetVault: Tenant Reporting & Analytics Routes
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { Router } from 'express';
import { reportController } from '../controllers/report.controller';
import { authenticate } from '../middleware/auth.middleware';
import { loadUser } from '../middleware/loadUser.middleware';
import { authorize } from '../middleware/authorize.middleware';
import { tenantContext } from '../middleware/tenantScope.middleware';

const router = Router();

router.use(authenticate, loadUser, tenantContext);

// 1. Consolidated Tenant Dashboard KPIs
router.get('/dashboard', authorize('tenants:read_own'), reportController.getDashboard);

// 2. Real-time License Utilization Report
router.get('/license-utilization', authorize('licenses:read'), reportController.getLicenseUtilization);

// 3. Upcoming Expiring Licenses Alert Report
router.get('/expiring-licenses', authorize('licenses:read'), reportController.getExpiringLicenses);

// 4. Procurement & Renewal Spend by Vendor
router.get('/vendor-spend', authorize('vendors:read'), reportController.getVendorSpend);

// 5. Spend by Month with Running Total (Window Function)
router.get('/spend-by-month', authorize('licenses:read'), reportController.getSpendByMonth);

// 6. Top 10 Most Downloaded Assets (Window Function Rank)
router.get('/top-assets', authorize('assets:read'), reportController.getTopAssets);

// 7. Unlicensed & Expired Assets Report
router.get('/unlicensed-assets', authorize('assets:read'), reportController.getUnlicensedAssets);

// 8. Monthly Access Trend (Materialized View)
router.get('/access-trend', authorize('assets:read'), reportController.getAccessTrend);

// 9. Compliance Engine (Score 0-100 & Drill-down remediation)
router.get('/compliance', authorize('tenants:read_own'), reportController.getComplianceReport);

// 10. Cost Optimization (Dormant Seats & Vendor Spend)
router.get('/unused-seats', authorize('allocations:manage_all'), reportController.getUnusedSeatsReport);

export default router;
