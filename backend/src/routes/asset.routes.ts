// ==============================================================================
// AssetVault: Asset Routes
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { Router } from 'express';
import express from 'express';
import { assetController } from '../controllers/asset.controller';
import { authenticate } from '../middleware/auth.middleware';
import { loadUser } from '../middleware/loadUser.middleware';
import { authorize } from '../middleware/authorize.middleware';
import { tenantContext } from '../middleware/tenantScope.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  createAssetSchema,
  updateAssetSchema,
  attachTagsSchema,
} from '../validators/asset.validator';
import { createVersionSchema, compareVersionsQuerySchema } from '../validators/version.validator';
import { queryAccessLogSchema } from '../validators/access.validator';

import { accessController } from '../controllers/access.controller';

const router = Router();

router.use(authenticate, tenantContext, loadUser);

// 1. Bulk CSV operations (must precede /:id)
router.get('/export', authorize('assets:read'), tenantContext, assetController.exportCsv);
router.get('/export.csv', authorize('assets:read'), tenantContext, assetController.exportCsv);
router.get('/export-csv', authorize('assets:read'), tenantContext, assetController.exportCsv);
router.post(
  '/import',
  express.text({ type: ['text/csv', 'text/plain'], limit: '10mb' }),
  authorize('assets:create'),
  tenantContext,
  assetController.bulkImport
);
router.post(
  '/bulk-import',
  express.text({ type: ['text/csv', 'text/plain'], limit: '10mb' }),
  authorize('assets:create'),
  tenantContext,
  assetController.bulkImport
);

// 2. Asset Core CRUD
router.get('/', authorize('assets:read'), tenantContext, assetController.listAssets);
router.get('/:id', authorize('assets:read'), tenantContext, assetController.getAssetById);
router.post('/', authorize('assets:create'), tenantContext, validate(createAssetSchema), assetController.createAsset);
router.patch('/:id', authorize('assets:update'), tenantContext, validate(updateAssetSchema), assetController.updateAsset);
router.put('/:id', authorize('assets:update'), tenantContext, validate(updateAssetSchema), assetController.updateAsset);
router.delete('/:id', authorize('assets:delete'), tenantContext, assetController.softDeleteAsset);
router.post('/:id/restore', authorize('assets:delete'), tenantContext, assetController.restoreAsset);
router.patch('/:id/restore', authorize('assets:delete'), tenantContext, assetController.restoreAsset);

// 3. Asset Access, Checkout, Checkin & Download (Seat-gated)
router.post('/:id/checkout', authorize('assets:download'), tenantContext, accessController.checkout);
router.post('/:id/checkin', authorize('assets:download'), tenantContext, accessController.checkin);
router.get('/:id/download', authorize('assets:download'), tenantContext, accessController.download);
router.get('/:id/access-logs', authorize('assets:read'), tenantContext, validate({ query: queryAccessLogSchema }), accessController.listLogsForAsset);

// 4. Asset Tag Operations
router.post('/:id/tags', authorize('assets:update'), tenantContext, validate(attachTagsSchema), assetController.attachTags);
router.delete('/:id/tags/:tagId', authorize('assets:update'), tenantContext, assetController.detachTag);

// 5. Asset Versioning Operations
router.get('/:id/versions/compare', authorize('versions:read'), tenantContext, validate({ query: compareVersionsQuerySchema }), assetController.compareVersions);
router.get('/:id/versions', authorize('versions:read'), tenantContext, assetController.listVersions);
router.get('/:id/versions/:versionNo', authorize('versions:read'), tenantContext, assetController.getVersionByNo);
router.post('/:id/versions', authorize('versions:create'), tenantContext, validate(createVersionSchema), assetController.createVersion);

export default router;
