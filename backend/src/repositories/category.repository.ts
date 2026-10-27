// ==============================================================================
// AssetVault: Category Repository
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { PrismaClient, Category, Prisma } from '@prisma/client';
import { PaginationParams } from '../utils/pagination.util';

export class CategoryRepository {
  public async findMany(
    prisma: PrismaClient | any,
    params: PaginationParams,
    filter?: { parentId?: string | null }
  ): Promise<{ data: Category[]; total: number }> {
    const where: Prisma.CategoryWhereInput = {};

    if (filter?.parentId !== undefined) {
      where.parentId = filter.parentId;
    }

    if (params.q) {
      where.OR = [
        { name: { contains: params.q, mode: 'insensitive' } },
        { description: { contains: params.q, mode: 'insensitive' } },
      ];
    }

    const orderBy: Prisma.CategoryOrderByWithRelationInput = {
      [params.sort]: params.order,
    };

    const [data, total] = await Promise.all([
      prisma.category.findMany({
        where,
        skip: params.skip,
        take: params.limit,
        orderBy,
        include: {
          parent: { select: { id: true, name: true } },
          _count: { select: { children: true, assets: true } },
        },
      }),
      prisma.category.count({ where }),
    ]);

    return { data, total };
  }

  public async findAllForTree(prisma: PrismaClient | any): Promise<Category[]> {
    return prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { children: true, assets: true } },
      },
    });
  }

  public async findById(prisma: PrismaClient | any, id: string): Promise<any> {
    return prisma.category.findUnique({
      where: { id },
      include: {
        parent: true,
        children: true,
        _count: { select: { children: true, assets: true } },
      },
    });
  }

  public async findByName(prisma: PrismaClient | any, name: string, tenantId: string): Promise<Category | null> {
    return prisma.category.findFirst({
      where: { name, tenantId },
    });
  }

  public async create(prisma: PrismaClient | any, data: Prisma.CategoryCreateInput): Promise<Category> {
    return prisma.category.create({
      data,
      include: { parent: true },
    });
  }

  public async update(prisma: PrismaClient | any, id: string, data: Prisma.CategoryUpdateInput): Promise<Category> {
    return prisma.category.update({
      where: { id },
      data,
      include: { parent: true },
    });
  }

  public async delete(prisma: PrismaClient | any, id: string): Promise<Category> {
    return prisma.category.delete({
      where: { id },
    });
  }
}

export const categoryRepository = new CategoryRepository();
