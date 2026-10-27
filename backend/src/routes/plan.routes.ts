// ==============================================================================
// AssetVault: Subscription Plan Routes
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { Router } from 'express';
import { planController } from '../controllers/plan.controller';
import { authenticate } from '../middleware/auth.middleware';
import { loadUser } from '../middleware/loadUser.middleware';
import { authorize } from '../middleware/authorize.middleware';
import { tenantContext } from '../middleware/tenantScope.middleware';
import { validate } from '../middleware/validate.middleware';
import { createPlanSchema, updatePlanSchema } from '../validators/plan.validator';

const router = Router();

// All plan routes require authenticated context
router.use(authenticate, loadUser);

// Read plans (accessible to all authenticated users)
router.get('/', authorize('plans:read'), tenantContext, planController.listPlans);
router.get('/:id', authorize('plans:read'), tenantContext, planController.getPlanById);

// Plan management (Super Admin only)
router.post('/', authorize('plans:manage'), tenantContext, validate(createPlanSchema), planController.createPlan);
router.patch('/:id', authorize('plans:manage'), tenantContext, validate(updatePlanSchema), planController.updatePlan);
router.delete('/:id', authorize('plans:manage'), tenantContext, planController.deletePlan);

export default router;
