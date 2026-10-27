// ==============================================================================
// AssetVault: Tenant Repository
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { PrismaClient, Tenant, TenantStatus, Prisma } from '@prisma/client';
import { PaginationParams } from '../utils/pagination.util';

export class TenantRepository {
  public async findMany(
    prisma: PrismaClient | any,
    params: PaginationParams,
    filter?: { status?: TenantStatus; planId?: number }
  ): Promise<{ data: Tenant[]; total: number }> {
    const where: Prisma.TenantWhereInput = {};

    if (filter?.status) {
      where.status = filter.status;
    }

    if (filter?.planId) {
      where.planId = filter.planId;
    }

    if (params.q) {
      where.OR = [
        { name: { contains: params.q, mode: 'insensitive' } },
        { slug: { contains: params.q, mode: 'insensitive' } },
        { contactEmail: { contains: params.q, mode: 'insensitive' } },
      ];
    }

    const orderBy: Prisma.TenantOrderByWithRelationInput = {
      [params.sort]: params.order,
    };

    const [data, total] = await Promise.all([
      prisma.tenant.findMany({
        where,
        skip: params.skip,
        take: params.limit,
        orderBy,
        include: {
          plan: { select: { id: true, name: true, maxUsers: true, maxAssets: true } },
          _count: { select: { users: true, assets: true, licenses: true } },
        },
      }),
      prisma.tenant.count({ where }),
    ]);

    return { data, total };
  }

  public async findById(prisma: PrismaClient | any, id: string): Promise<any> {
    return prisma.tenant.findUnique({
      where: { id },
      include: {
        plan: true,
        _count: { select: { users: true, assets: true, licenses: true } },
      },
    });
  }

  public async findBySlug(prisma: PrismaClient | any, slug: string): Promise<any> {
    return prisma.tenant.findUnique({
      where: { slug },
      include: { plan: true },
    });
  }

  public async create(prisma: PrismaClient | any, data: Prisma.TenantCreateInput): Promise<Tenant> {
    return prisma.tenant.create({
      data,
      include: { plan: true },
    });
  }

  public async update(prisma: PrismaClient | any, id: string, data: Prisma.TenantUpdateInput): Promise<Tenant> {
    return prisma.tenant.update({
      where: { id },
      data,
      include: { plan: true },
    });
  }

  public async delete(prisma: PrismaClient | any, id: string): Promise<Tenant> {
    return prisma.tenant.delete({
      where: { id },
    });
  }
}

export const tenantRepository = new TenantRepository();
