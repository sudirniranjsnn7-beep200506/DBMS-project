// ==============================================================================
// AssetVault: Global Search Routes
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { Router } from 'express';
import { searchController } from '../controllers/search.controller';
import { authenticate } from '../middleware/auth.middleware';
import { loadUser } from '../middleware/loadUser.middleware';
import { authorize } from '../middleware/authorize.middleware';
import { tenantContext } from '../middleware/tenantScope.middleware';

const router = Router();

router.use(authenticate, loadUser, tenantContext);

// Granular entity search endpoints with RBAC authorization
router.get('/assets', authorize('assets:read'), searchController.searchAssets);
router.get('/licenses', authorize('licenses:read'), searchController.searchLicenses);
router.get('/vendors', authorize('vendors:read'), searchController.searchVendors);
router.get('/tags', authorize('tags:read'), searchController.searchTags);

// Global multi-entity search endpoint (filters entities based on caller permissions)
router.get('/', searchController.search);

export default router;
