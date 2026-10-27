// ==============================================================================
// AssetVault: User Repository
// Course: BCSE307L Database Systems (Fall 2026-27)
// Enforces sanitization: Never returns password_hash to callers
// ==============================================================================

import { PrismaClient, Prisma } from '@prisma/client';
import { PaginationParams } from '../utils/pagination.util';

export const USER_SAFE_SELECT = {
  id: true,
  tenantId: true,
  roleId: true,
  email: true,
  fullName: true,
  googleId: true,
  avatarUrl: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  role: {
    select: {
      id: true,
      name: true,
      description: true,
    },
  },
  tenant: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
};

export class UserRepository {
  public async findMany(
    prisma: PrismaClient | any,
    params: PaginationParams,
    filter?: { roleId?: number; roleName?: string; isActive?: boolean }
  ): Promise<{ data: any[]; total: number }> {
    const where: Prisma.UserWhereInput = {};

    if (filter?.isActive !== undefined) {
      where.isActive = filter.isActive;
    }

    if (filter?.roleId) {
      where.roleId = filter.roleId;
    } else if (filter?.roleName) {
      where.role = { name: filter.roleName };
    }

    if (params.q) {
      where.OR = [
        { fullName: { contains: params.q, mode: 'insensitive' } },
        { email: { contains: params.q, mode: 'insensitive' } },
      ];
    }

    const orderBy: Prisma.UserOrderByWithRelationInput = {
      [params.sort]: params.order,
    };

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: params.skip,
        take: params.limit,
        orderBy,
        select: USER_SAFE_SELECT,
      }),
      prisma.user.count({ where }),
    ]);

    return { data, total };
  }

  public async findById(prisma: PrismaClient | any, id: string): Promise<any | null> {
    return prisma.user.findFirst({
      where: { id },
      select: USER_SAFE_SELECT,
    });
  }

  public async findByEmail(prisma: PrismaClient | any, email: string): Promise<any | null> {
    return prisma.user.findFirst({
      where: { email },
      select: USER_SAFE_SELECT,
    });
  }

  public async create(prisma: PrismaClient | any, data: Prisma.UserCreateInput): Promise<any> {
    return prisma.user.create({
      data,
      select: USER_SAFE_SELECT,
    });
  }

  public async update(prisma: PrismaClient | any, id: string, data: Prisma.UserUpdateInput): Promise<any> {
    return prisma.user.update({
      where: { id },
      data,
      select: USER_SAFE_SELECT,
    });
  }

  public async delete(prisma: PrismaClient | any, id: string): Promise<any> {
    return prisma.user.delete({
      where: { id },
      select: USER_SAFE_SELECT,
    });
  }
}

export const userRepository = new UserRepository();
