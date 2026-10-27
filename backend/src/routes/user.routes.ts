// ==============================================================================
// AssetVault: User Routes
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { authenticate } from '../middleware/auth.middleware';
import { loadUser } from '../middleware/loadUser.middleware';
import { authorize } from '../middleware/authorize.middleware';
import { tenantContext } from '../middleware/tenantScope.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  createUserSchema,
  updateUserSchema,
  changeRoleSchema,
  resetPasswordSchema,
  updateUserStatusSchema,
} from '../validators/user.validator';

import { allocationController } from '../controllers/allocation.controller';

const router = Router();

router.use(authenticate, loadUser);

// List organization users (Requires users:read, forbidden for MEMBER)
router.get('/', authorize('users:read'), tenantContext, userController.listUsers);
router.get('/:id', authorize('users:read'), tenantContext, userController.getUserById);

// User allocations (Self-view permitted for MEMBER, view-any for ADMIN/MANAGER)
router.get('/:id/allocations', authorize('allocations:read'), tenantContext, allocationController.listAllocationsByUser);

// User administration (Requires users:manage)
router.post('/', authorize('users:manage'), tenantContext, validate(createUserSchema), userController.createUser);
router.patch('/:id', authorize('users:manage'), tenantContext, validate(updateUserSchema), userController.updateUser);
router.put('/:id', authorize('users:manage'), tenantContext, validate(updateUserSchema), userController.updateUser);
router.patch('/:id/status', authorize('users:manage'), tenantContext, validate(updateUserStatusSchema), userController.updateStatus);
router.patch('/:id/role', authorize('users:manage'), tenantContext, validate(changeRoleSchema), userController.changeRole);
router.post('/:id/reset-password', authorize('users:manage'), tenantContext, validate(resetPasswordSchema), userController.resetPassword);
router.delete('/:id', authorize('users:manage'), tenantContext, userController.deleteUser);

export default router;
