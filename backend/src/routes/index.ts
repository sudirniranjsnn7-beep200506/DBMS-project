// ==============================================================================
// AssetVault: Primary API Router & OpenAPI Swagger Documentation
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { Router, Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import { openApiSpec } from '../docs/openapi';

import { healthRoutes } from './health.routes';
import authRoutes from './auth.routes';
import planRoutes from './plan.routes';
import tenantRoutes from './tenant.routes';
import userRoutes from './user.routes';
import vendorRoutes from './vendor.routes';
import categoryRoutes from './category.routes';
import tagRoutes from './tag.routes';
import assetRoutes from './asset.routes';
import licenseRoutes from './license.routes';
import allocationRoutes from './allocation.routes';
import notificationRoutes from './notification.routes';
import auditRoutes from './audit.routes';
import reportRoutes from './report.routes';
import platformRoutes from './platform.routes';
import searchRoutes from './search.routes';
import aiRoutes from './ai.routes';
import { tenantController } from '../controllers/tenant.controller';

import { authenticate } from '../middleware/auth.middleware';
import { loadUser } from '../middleware/loadUser.middleware';
import { authorize } from '../middleware/authorize.middleware';
import { tenantContext } from '../middleware/tenantScope.middleware';
import { validate } from '../middleware/validate.middleware';
import { runExpiryCheckSchema } from '../validators/notification.validator';
import { notificationController } from '../controllers/notification.controller';

const router = Router();

// 1. OpenAPI 3.0 Interactive Documentation
router.get('/docs.json', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(openApiSpec);
});
router.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

// 2. Health & System Connectivity
router.use('/health', healthRoutes);

// 3. Authentication & Sessions
router.use('/auth', authRoutes);

// 4. Plans & Subscriptions
router.use('/plans', planRoutes);

// 5. Tenants & Organizations
router.use('/tenants', tenantRoutes);

// 6. Users & Team Members
router.use('/users', userRoutes);

// 7. Vendors & Taxonomies
router.use('/vendors', vendorRoutes);
router.use('/categories', categoryRoutes);
router.use('/tags', tagRoutes);

// 8. Digital Assets & Versions
router.use('/assets', assetRoutes);

// 9. Licenses & Renewals
router.use('/licenses', licenseRoutes);

// 10. Allocations
router.use('/allocations', allocationRoutes);

// 11. Notifications & Expiry Checks
router.use('/notifications', notificationRoutes);

// Expiry check admin route alias (/api/admin/run-expiry-check)
router.post(
  '/admin/run-expiry-check',
  authenticate,
  loadUser,
  authorize('notifications:manage'),
  tenantContext,
  validate(runExpiryCheckSchema),
  notificationController.runExpiryCheck
);

// 12. Audit Ledger
router.use('/audit-logs', auditRoutes);

// 13. Reports & Analytics
router.use('/reports', reportRoutes);

// 14. Super Admin Platform Analytics
router.use('/platform', platformRoutes);

// 15. Global Trigram Search (Assets, Licenses, Vendors, Tags)
router.use('/search', searchRoutes);

// 16. Gemini AI Assistant & Optimization Advisor
router.use('/ai', aiRoutes);

// 17. Tenant Data Lifecycle Export Archive
router.get(
  '/tenant/export',
  authenticate,
  loadUser,
  authorize('tenants:update_own'),
  tenantContext,
  tenantController.exportTenantData
);

export default router;
