// ==============================================================================
// AssetVault: Category Routes
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { Router } from 'express';
import { categoryController } from '../controllers/category.controller';
import { authenticate } from '../middleware/auth.middleware';
import { loadUser } from '../middleware/loadUser.middleware';
import { authorize } from '../middleware/authorize.middleware';
import { tenantContext } from '../middleware/tenantScope.middleware';
import { validate } from '../middleware/validate.middleware';
import { createCategorySchema, updateCategorySchema } from '../validators/category.validator';

const router = Router();

router.use(authenticate, loadUser);

// Read categories & nested tree
router.get('/tree', authorize('categories:read'), tenantContext, categoryController.getCategoryTree);
router.get('/', authorize('categories:read'), tenantContext, categoryController.listCategories);
router.get('/:id', authorize('categories:read'), tenantContext, categoryController.getCategoryById);

// Manage categories
router.post('/', authorize('categories:manage'), tenantContext, validate(createCategorySchema), categoryController.createCategory);
router.patch('/:id', authorize('categories:manage'), tenantContext, validate(updateCategorySchema), categoryController.updateCategory);
router.delete('/:id', authorize('categories:manage'), tenantContext, categoryController.deleteCategory);

export default router;
