// ==============================================================================
// AssetVault: License Allocation Repository
// Course: BCSE307L Database Systems (Fall 2026-27)
// Executes stored procedures sp_allocate_license_seat & sp_release_license_seat
// ==============================================================================

import { PrismaClient, LicenseAllocation, Prisma } from '@prisma/client';
import { PaginationParams } from '../utils/pagination.util';

export class AllocationRepository {
  /**
   * Invokes stored procedure sp_allocate_license_seat via parameterized raw SQL
   */
  public async allocateSeat(
    prisma: PrismaClient | any,
    licenseId: string,
    userId: string,
    allocatedBy: string
  ): Promise<string> {
    const result: any = await prisma.$queryRaw(
      Prisma.sql`CALL sp_allocate_license_seat(
        ${licenseId}::UUID,
        ${userId}::UUID,
        ${allocatedBy}::UUID,
        NULL
      );`
    );
    return result?.[0]?.p_allocation_id || '';
  }

  /**
   * Invokes stored procedure sp_release_license_seat via parameterized raw SQL
   */
  public async releaseSeat(
    prisma: PrismaClient | any,
    allocationId: string,
    revokedBy: string,
    reason?: string
  ): Promise<void> {
    await prisma.$executeRaw(
      Prisma.sql`CALL sp_release_license_seat(
        ${allocationId}::UUID,
        ${revokedBy}::UUID,
        ${reason || 'Administrative seat release'}
      );`
    );
  }

  public async findById(prisma: PrismaClient | any, id: string): Promise<LicenseAllocation | null> {
    return prisma.licenseAllocation.findUnique({
      where: { id },
      include: {
        license: { select: { id: true, name: true, totalSeats: true } },
        user: { select: { id: true, fullName: true, email: true } },
      },
    });
  }

  public async findByLicense(
    prisma: PrismaClient | any,
    licenseId: string,
    params: PaginationParams,
    userId?: string
  ): Promise<{ data: any[]; total: number }> {
    const where: any = { licenseId };
    if (userId) {
      where.userId = userId;
    }
    const [data, total] = await Promise.all([
      prisma.licenseAllocation.findMany({
        where,
        skip: params.skip,
        take: params.limit,
        orderBy: { allocatedAt: 'desc' },
        include: {
          user: { select: { id: true, fullName: true, email: true } },
        },
      }),
      prisma.licenseAllocation.count({ where }),
    ]);
    return { data, total };
  }

  public async findByUser(
    prisma: PrismaClient | any,
    userId: string,
    params: PaginationParams
  ): Promise<{ data: any[]; total: number }> {
    const where = { userId };
    const [data, total] = await Promise.all([
      prisma.licenseAllocation.findMany({
        where,
        skip: params.skip,
        take: params.limit,
        orderBy: { allocatedAt: 'desc' },
        include: {
          license: {
            select: {
              id: true,
              name: true,
              status: true,
              endDate: true,
              vendor: { select: { id: true, name: true } },
            },
          },
        },
      }),
      prisma.licenseAllocation.count({ where }),
    ]);
    return { data, total };
  }

  public async findAll(
    prisma: PrismaClient | any,
    tenantId: string,
    params: PaginationParams,
    status?: string
  ): Promise<{ data: any[]; total: number }> {
    const where: any = {
      license: { tenantId },
    };

    if (status) {
      if (status === 'RELEASED' || status === 'REVOKED') {
        where.status = { in: ['RELEASED', 'REVOKED'] };
      } else {
        where.status = status;
      }
    }

    const [data, total] = await Promise.all([
      prisma.licenseAllocation.findMany({
        where,
        skip: params.skip,
        take: params.limit,
        orderBy: { allocatedAt: 'desc' },
        include: {
          license: {
            select: {
              id: true,
              name: true,
              totalSeats: true,
              vendor: { select: { id: true, name: true } },
            },
          },
          user: { select: { id: true, fullName: true, email: true } },
        },
      }),
      prisma.licenseAllocation.count({ where }),
    ]);
    return { data, total };
  }
}

export const allocationRepository = new AllocationRepository();
