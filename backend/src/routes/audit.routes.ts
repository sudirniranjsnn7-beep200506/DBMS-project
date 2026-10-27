// ==============================================================================
// AssetVault: Audit Log Routes (Tenant Admin Only)
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { Router } from 'express';
import { auditController } from '../controllers/audit.controller';
import { authenticate } from '../middleware/auth.middleware';
import { loadUser } from '../middleware/loadUser.middleware';
import { authorize } from '../middleware/authorize.middleware';
import { tenantContext } from '../middleware/tenantScope.middleware';
import { validate } from '../middleware/validate.middleware';
import { queryAuditLogSchema } from '../validators/audit.validator';

const router = Router();

router.use(authenticate, loadUser, tenantContext);

// 1. List audit logs with multi-field filtering (supports cursor pagination via ?cursor=)
router.get('/', authorize('audit:read'), validate({ query: queryAuditLogSchema }), auditController.listAuditLogs);

// 1b. Export audit logs to RFC 4180 CSV
router.get('/export', authorize('audit:read'), auditController.exportCsv);

// 2. Retrieve JSON diff comparing oldData and newData for a specific audit log entry
router.get('/:id/diff', authorize('audit:read'), auditController.getDiff);

export default router;
