// ==============================================================================
// AssetVault: Vendor Routes
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { Router } from 'express';
import { vendorController } from '../controllers/vendor.controller';
import { authenticate } from '../middleware/auth.middleware';
import { loadUser } from '../middleware/loadUser.middleware';
import { authorize } from '../middleware/authorize.middleware';
import { tenantContext } from '../middleware/tenantScope.middleware';
import { validate } from '../middleware/validate.middleware';
import { createVendorSchema, updateVendorSchema } from '../validators/vendor.validator';

const router = Router();

router.use(authenticate, loadUser);

// Read vendors
router.get('/', authorize('vendors:read'), tenantContext, vendorController.listVendors);
router.get('/:id', authorize('vendors:read'), tenantContext, vendorController.getVendorById);

// Manage vendors
router.post('/', authorize('vendors:manage'), tenantContext, validate(createVendorSchema), vendorController.createVendor);
router.patch('/:id', authorize('vendors:manage'), tenantContext, validate(updateVendorSchema), vendorController.updateVendor);
router.delete('/:id', authorize('vendors:manage'), tenantContext, vendorController.deleteVendor);

export default router;
