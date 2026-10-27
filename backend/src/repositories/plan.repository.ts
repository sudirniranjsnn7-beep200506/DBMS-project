// ==============================================================================
// AssetVault: Subscription Plan Repository
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { PrismaClient, Plan, Prisma } from '@prisma/client';
import { PaginationParams } from '../utils/pagination.util';

export class PlanRepository {
  public async findMany(
    prisma: PrismaClient | any,
    params: PaginationParams,
    filter?: { isActive?: boolean }
  ): Promise<{ data: Plan[]; total: number }> {
    const where: Prisma.PlanWhereInput = {};

    if (filter?.isActive !== undefined) {
      where.isActive = filter.isActive;
    }

    if (params.q) {
      where.name = { contains: params.q, mode: 'insensitive' };
    }

    const orderBy: Prisma.PlanOrderByWithRelationInput = {
      [params.sort]: params.order,
    };

    const [data, total] = await Promise.all([
      prisma.plan.findMany({
        where,
        skip: params.skip,
        take: params.limit,
        orderBy,
      }),
      prisma.plan.count({ where }),
    ]);

    return { data, total };
  }

  public async findById(prisma: PrismaClient | any, id: number): Promise<Plan | null> {
    return prisma.plan.findUnique({
      where: { id },
    });
  }

  public async findByName(prisma: PrismaClient | any, name: string): Promise<Plan | null> {
    return prisma.plan.findUnique({
      where: { name },
    });
  }

  public async create(prisma: PrismaClient | any, data: Prisma.PlanCreateInput): Promise<Plan> {
    return prisma.plan.create({ data });
  }

  public async update(prisma: PrismaClient | any, id: number, data: Prisma.PlanUpdateInput): Promise<Plan> {
    return prisma.plan.update({
      where: { id },
      data,
    });
  }

  public async delete(prisma: PrismaClient | any, id: number): Promise<Plan> {
    return prisma.plan.delete({
      where: { id },
    });
  }
}

export const planRepository = new PlanRepository();
