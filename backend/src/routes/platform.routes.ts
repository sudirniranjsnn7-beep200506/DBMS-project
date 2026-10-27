// ==============================================================================
// AssetVault: Super Admin Platform Analytics Routes
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

// 1. Cross-tenant summary of subscriptions, active seats, and license metrics
router.get('/overview', authorize('analytics:platform_read'), reportController.getPlatformOverview);

export default router;
