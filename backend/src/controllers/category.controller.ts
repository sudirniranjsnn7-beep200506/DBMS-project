// ==============================================================================
// AssetVault: Category HTTP Controller
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { Request, Response } from 'express';
import { categoryService } from '../services/category.service';
import { getPaginationParams } from '../utils/pagination.util';
import { sendResponse } from '../utils/response.util';
import { asyncHandler } from '../utils/asyncHandler';

export class CategoryController {
  public listCategories = asyncHandler(async (req: Request, res: Response) => {
    const params = getPaginationParams(req, 'name', ['name', 'createdAt']);
    const parentId = req.query.parentId !== undefined ? (req.query.parentId as string) || null : undefined;
    const result = await categoryService.listCategories(req.prisma, params, { parentId });
    sendResponse(res, 200, result.data, result.meta);
  });

  public getCategoryTree = asyncHandler(async (req: Request, res: Response) => {
    const tree = await categoryService.getCategoryTree(req.prisma);
    sendResponse(res, 200, tree);
  });

  public getCategoryById = asyncHandler(async (req: Request, res: Response) => {
    const category = await categoryService.getCategoryById(req.prisma, req.params.id as string);
    sendResponse(res, 200, category);
  });

  public createCategory = asyncHandler(async (req: Request, res: Response) => {
    const category = await categoryService.createCategory(req.prisma, req.user!.tenantId as string, req.body);
    sendResponse(res, 201, category);
  });

  public updateCategory = asyncHandler(async (req: Request, res: Response) => {
    const category = await categoryService.updateCategory(req.prisma, req.params.id as string, req.body);
    sendResponse(res, 200, category);
  });

  public deleteCategory = asyncHandler(async (req: Request, res: Response) => {
    await categoryService.deleteCategory(req.prisma, req.params.id as string);
    sendResponse(res, 200, { message: 'Category removed successfully' });
  });
}

export const categoryController = new CategoryController();
