// ==============================================================================
// AssetVault: Tag Routes
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { Router } from 'express';
import { tagController } from '../controllers/tag.controller';
import { authenticate } from '../middleware/auth.middleware';
import { loadUser } from '../middleware/loadUser.middleware';
import { authorize } from '../middleware/authorize.middleware';
import { tenantContext } from '../middleware/tenantScope.middleware';
import { validate } from '../middleware/validate.middleware';
import { createTagSchema, updateTagSchema } from '../validators/tag.validator';

const router = Router();

router.use(authenticate, loadUser);

// Read tags
router.get('/', authorize('tags:read'), tenantContext, tagController.listTags);
router.get('/:id', authorize('tags:read'), tenantContext, tagController.getTagById);

// Manage tags
router.post('/', authorize('tags:manage'), tenantContext, validate(createTagSchema), tagController.createTag);
router.patch('/:id', authorize('tags:manage'), tenantContext, validate(updateTagSchema), tagController.updateTag);
router.delete('/:id', authorize('tags:manage'), tenantContext, tagController.deleteTag);

export default router;
