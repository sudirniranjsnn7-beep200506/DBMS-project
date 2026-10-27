// ==============================================================================
// AssetVault: Category Service
// Course: BCSE307L Database Systems (Fall 2026-27)
// Enforces taxonomy cycle prevention and blocks deletion on non-empty categories
// ==============================================================================

import { categoryRepository } from '../repositories/category.repository';
import { NotFoundError, ConflictError, BadRequestError } from '../errors/AppError';
import { PaginationParams, formatPaginatedResponse } from '../utils/pagination.util';

export interface CategoryTreeNode {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  assetCount: number;
  children: CategoryTreeNode[];
}

export class CategoryService {
  public async listCategories(prismaClient: any, params: PaginationParams, filter?: { parentId?: string | null }) {
    const { data, total } = await categoryRepository.findMany(prismaClient, params, filter);
    return formatPaginatedResponse(data, total, params);
  }

  public async getCategoryById(prismaClient: any, id: string) {
    const category = await categoryRepository.findById(prismaClient, id);
    if (!category) {
      throw new NotFoundError('Category not found');
    }
    return category;
  }

  /**
   * Builds full hierarchical nested tree of categories for the tenant
   */
  public async getCategoryTree(prismaClient: any): Promise<CategoryTreeNode[]> {
    const all = await categoryRepository.findAllForTree(prismaClient);

    const map = new Map<string, CategoryTreeNode>();
    all.forEach((cat: any) => {
      map.set(cat.id, {
        id: cat.id,
        name: cat.name,
        description: cat.description,
        parentId: cat.parentId,
        assetCount: cat._count?.assets || 0,
        children: [],
      });
    });

    const rootNodes: CategoryTreeNode[] = [];
    all.forEach((cat: any) => {
      const node = map.get(cat.id)!;
      if (cat.parentId && map.has(cat.parentId)) {
        map.get(cat.parentId)!.children.push(node);
      } else {
        rootNodes.push(node);
      }
    });

    return rootNodes;
  }

  public async createCategory(prismaClient: any, tenantId: string, data: any) {
    if (data.parentId) {
      const parent = await categoryRepository.findById(prismaClient, data.parentId);
      if (!parent) {
        throw new BadRequestError('Parent category not found.');
      }
    }

    return categoryRepository.create(prismaClient, {
      name: data.name,
      description: data.description || null,
      tenant: { connect: { id: tenantId } },
      parent: data.parentId ? { connect: { id: data.parentId } } : undefined,
    });
  }

  public async updateCategory(prismaClient: any, id: string, data: any) {
    await this.getCategoryById(prismaClient, id);

    // Cycle Prevention Check
    if (data.parentId !== undefined) {
      if (data.parentId === id) {
        throw new ConflictError('A category cannot be its own parent.');
      }

      if (data.parentId !== null) {
        // Traverse upwards from proposed parent; if 'id' is reached, this would form a cycle!
        let currentParentId: string | null = data.parentId;
        const visited = new Set<string>();

        while (currentParentId) {
          if (currentParentId === id) {
            throw new ConflictError('Cyclic category dependency detected: a category cannot become its own descendant.');
          }
          if (visited.has(currentParentId)) {
            break;
          }
          visited.add(currentParentId);

          const ancestor = await categoryRepository.findById(prismaClient, currentParentId);
          currentParentId = ancestor?.parentId || null;
        }
      }
    }

    return categoryRepository.update(prismaClient, id, {
      name: data.name,
      description: data.description,
      parent:
        data.parentId === null
          ? { disconnect: true }
          : data.parentId
          ? { connect: { id: data.parentId } }
          : undefined,
    });
  }

  public async deleteCategory(prismaClient: any, id: string) {
    const category = await this.getCategoryById(prismaClient, id);

    // Block deletion if it has children or assets (Course requirement: return 409)
    if (category.children && category.children.length > 0) {
      throw new ConflictError('Cannot delete category with child subcategories. Please reassign or delete subcategories first.');
    }

    if (category._count?.assets > 0) {
      throw new ConflictError('Cannot delete category with associated digital assets. Please reassign assets first.');
    }

    return categoryRepository.delete(prismaClient, id);
  }
}

export const categoryService = new CategoryService();
