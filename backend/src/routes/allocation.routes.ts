// ==============================================================================
// AssetVault: Direct Allocation Routes
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { Router } from 'express';
import { allocationController } from '../controllers/allocation.controller';
import { authenticate } from '../middleware/auth.middleware';
import { loadUser } from '../middleware/loadUser.middleware';
import { authorize } from '../middleware/authorize.middleware';
import { tenantContext } from '../middleware/tenantScope.middleware';
import { validate } from '../middleware/validate.middleware';
import { allocateSeatSchema, releaseSeatSchema } from '../validators/allocation.validator';

const router = Router();

router.use(authenticate, loadUser, tenantContext);

// List allocations across tenant
router.get(
  '/',
  authorize('allocations:read'),
  allocationController.listAllocations
);

// Allocate seat
router.post(
  '/',
  authorize('allocations:checkout_self'),
  validate(allocateSeatSchema),
  allocationController.allocateSeat
);

// Release seat by allocationId
router.post(
  '/:allocationId/release',
  authorize('allocations:release_self'),
  validate(releaseSeatSchema),
  allocationController.releaseSeat
);

export default router;
