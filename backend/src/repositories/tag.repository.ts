// ==============================================================================
// AssetVault: Tag Repository
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { PrismaClient, Tag, Prisma } from '@prisma/client';
import { PaginationParams } from '../utils/pagination.util';

export class TagRepository {
  public async findMany(
    prisma: PrismaClient | any,
    params: PaginationParams
  ): Promise<{ data: Tag[]; total: number }> {
    const where: Prisma.TagWhereInput = {};

    if (params.q) {
      where.name = { contains: params.q, mode: 'insensitive' };
    }

    const orderBy: Prisma.TagOrderByWithRelationInput = {
      [params.sort]: params.order,
    };

    const [data, total] = await Promise.all([
      prisma.tag.findMany({
        where,
        skip: params.skip,
        take: params.limit,
        orderBy,
        include: {
          _count: { select: { assetTags: true } },
        },
      }),
      prisma.tag.count({ where }),
    ]);

    return { data, total };
  }

  public async findById(prisma: PrismaClient | any, id: string): Promise<Tag | null> {
    return prisma.tag.findUnique({
      where: { id },
      include: {
        _count: { select: { assetTags: true } },
      },
    });
  }

  public async findByName(prisma: PrismaClient | any, name: string): Promise<Tag | null> {
    return prisma.tag.findFirst({
      where: { name },
    });
  }

  public async create(prisma: PrismaClient | any, data: Prisma.TagCreateInput): Promise<Tag> {
    return prisma.tag.create({ data });
  }

  public async update(prisma: PrismaClient | any, id: string, data: Prisma.TagUpdateInput): Promise<Tag> {
    return prisma.tag.update({
      where: { id },
      data,
    });
  }

  public async delete(prisma: PrismaClient | any, id: string): Promise<Tag> {
    return prisma.tag.delete({
      where: { id },
    });
  }
}

export const tagRepository = new TagRepository();
