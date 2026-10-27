// ==============================================================================
// AssetVault: License Management Routes
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { Router } from 'express';
import { licenseController } from '../controllers/license.controller';
import { authenticate } from '../middleware/auth.middleware';
import { loadUser } from '../middleware/loadUser.middleware';
import { authorize } from '../middleware/authorize.middleware';
import { tenantContext } from '../middleware/tenantScope.middleware';
import { validate } from '../middleware/validate.middleware';
import { allocationController } from '../controllers/allocation.controller';
import { allocateSeatSchema, releaseSeatSchema } from '../validators/allocation.validator';
import {
  createLicenseSchema,
  updateLicenseSchema,
  renewLicenseSchema,
  queryLicenseSchema,
} from '../validators/license.validator';

const router = Router();

// All license routes require authentication, user loading, and tenant scoping
router.use(authenticate, loadUser, tenantContext);

// 1. Export licenses to CSV (must come before /:id)
router.get('/export', authorize('licenses:read'), licenseController.exportCsv);
router.get('/export.csv', authorize('licenses:read'), licenseController.exportCsv);
router.get('/export-csv', authorize('licenses:read'), licenseController.exportCsv);

// 2. List licenses
router.get('/', authorize('licenses:read'), validate({ query: queryLicenseSchema }), licenseController.listLicenses);

// 3. Create license
router.post('/', authorize('licenses:create'), validate(createLicenseSchema), licenseController.createLicense);

// 4. Get single license (masks key unless TENANT_ADMIN or ASSET_MANAGER)
router.get('/:id', authorize('licenses:read'), licenseController.getLicenseById);

// 4b. Export license report to PDF
router.get('/:id/pdf', authorize('licenses:read'), licenseController.exportPdf);

// 5. Update license
router.patch('/:id', authorize('licenses:update'), validate(updateLicenseSchema), licenseController.updateLicense);
router.put('/:id', authorize('licenses:update'), validate(updateLicenseSchema), licenseController.updateLicense);

// 6. Delete license (soft delete)
router.delete('/:id', authorize('licenses:delete'), licenseController.softDeleteLicense);

// 7. Restore soft-deleted license
router.post('/:id/restore', authorize('licenses:delete'), licenseController.restoreLicense);

// 8. Renew license (calls sp_renew_license)
router.post('/:id/renew', authorize('licenses:renew'), validate(renewLicenseSchema), licenseController.renewLicense);

// 9. List renewals
router.get('/:id/renewals', authorize('licenses:read'), licenseController.listRenewals);

// 10. Link asset to license
router.post('/:id/link-asset/:assetId', authorize('licenses:link_asset'), licenseController.linkAsset);

// 11. Unlink asset from license
router.delete('/:id/link-asset/:assetId', authorize('licenses:link_asset'), licenseController.unlinkAsset);

// 12. List assets covered by this license
router.get('/:id/assets', authorize('licenses:read'), licenseController.listAssetsForLicense);

// 13. License seat allocations
router.post('/:id/allocate', authorize('allocations:checkout_self'), validate(allocateSeatSchema), allocationController.allocateSeat);
router.post('/:id/release', authorize('allocations:release_self'), validate(releaseSeatSchema), allocationController.releaseSeat);
router.get('/:id/allocations', authorize('allocations:read'), allocationController.listAllocationsByLicense);

export default router;
