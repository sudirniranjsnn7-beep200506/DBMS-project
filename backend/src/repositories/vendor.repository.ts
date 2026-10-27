// ==============================================================================
// AssetVault: Vendor Repository
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { PrismaClient, Vendor, Prisma } from '@prisma/client';
import { PaginationParams } from '../utils/pagination.util';

export class VendorRepository {
  public async findMany(
    prisma: PrismaClient | any,
    params: PaginationParams
  ): Promise<{ data: Vendor[]; total: number }> {
    const where: Prisma.VendorWhereInput = {};

    if (params.q) {
      where.OR = [
        { name: { contains: params.q, mode: 'insensitive' } },
        { contactEmail: { contains: params.q, mode: 'insensitive' } },
        { website: { contains: params.q, mode: 'insensitive' } },
      ];
    }

    const orderBy: Prisma.VendorOrderByWithRelationInput = {
      [params.sort]: params.order,
    };

    const [data, total] = await Promise.all([
      prisma.vendor.findMany({
        where,
        skip: params.skip,
        take: params.limit,
        orderBy,
        include: {
          _count: { select: { licenses: true } },
        },
      }),
      prisma.vendor.count({ where }),
    ]);

    return { data, total };
  }

  public async findById(prisma: PrismaClient | any, id: string): Promise<any> {
    return prisma.vendor.findUnique({
      where: { id },
      include: {
        _count: { select: { licenses: true } },
      },
    });
  }

  public async create(prisma: PrismaClient | any, data: Prisma.VendorCreateInput): Promise<Vendor> {
    return prisma.vendor.create({ data });
  }

  public async update(prisma: PrismaClient | any, id: string, data: Prisma.VendorUpdateInput): Promise<Vendor> {
    return prisma.vendor.update({
      where: { id },
      data,
    });
  }

  public async delete(prisma: PrismaClient | any, id: string): Promise<Vendor> {
    return prisma.vendor.delete({
      where: { id },
    });
  }
}

export const vendorRepository = new VendorRepository();
