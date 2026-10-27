// ==============================================================================
// AssetVault: License Allocation Service
// Course: BCSE307L Database Systems (Fall 2026-27)
// Enforces self-allocation boundaries for MEMBER roles and executes sp_allocate/release
// ==============================================================================

import { allocationRepository } from '../repositories/allocation.repository';
import { NotFoundError, ForbiddenError } from '../errors/AppError';
import { PaginationParams, formatPaginatedResponse } from '../utils/pagination.util';
import { prisma } from '../config/prisma';
import { Prisma } from '@prisma/client';
import { licenseAllocationFailuresTotal } from '../middleware/observability.middleware';

export class AllocationService {
  /**
   * Allocates a seat via stored procedure sp_allocate_license_seat
   */
  public async allocateSeat(
    tenantId: string,
    licenseId: string,
    targetUserId: string,
    callerUserId: string,
    callerRole: string
  ) {
    try {
      // MEMBER role constraint: can only allocate to self
      if (callerRole === 'MEMBER' && targetUserId !== callerUserId) {
        licenseAllocationFailuresTotal.inc({ reason: 'forbidden_member_cross_allocation' });
        throw new ForbiddenError('Standard members can only allocate license seats to themselves.');
      }

      return await prisma.$transaction(async (tx: any) => {
        await tx.$executeRaw(
          Prisma.sql`SELECT 
            set_config('app.current_tenant_id', ${tenantId}, true),
            set_config('app.current_user_id', ${callerUserId}, true),
            set_config('app.is_super_admin', 'false', true);`
        );

        const allocationId = await allocationRepository.allocateSeat(
          tx,
          licenseId,
          targetUserId,
          callerUserId
        );

        return {
          success: true,
          message: 'License seat allocated successfully via sp_allocate_license_seat',
          allocationId,
          licenseId,
          userId: targetUserId,
        };
      });
    } catch (err: any) {
      const msg = err.message || '';
      const reason = msg.includes('exhausted')
        ? 'seats_exhausted'
        : msg.includes('already holds')
        ? 'already_allocated'
        : msg.includes('expired')
        ? 'license_expired'
        : msg.includes('inactive')
        ? 'user_inactive'
        : 'unknown_failure';
      licenseAllocationFailuresTotal.inc({ reason });
      throw err;
    }
  }

  /**
   * Releases an allocated seat via stored procedure sp_release_license_seat
   */
  public async releaseSeat(
    tenantId: string,
    allocationId: string,
    callerUserId: string,
    callerRole: string,
    reason?: string
  ) {
    return prisma.$transaction(async (tx: any) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT 
          set_config('app.current_tenant_id', ${tenantId}, true),
          set_config('app.current_user_id', ${callerUserId}, true),
          set_config('app.is_super_admin', 'false', true);`
      );

      const allocation = await allocationRepository.findById(tx, allocationId);
      if (!allocation) {
        throw new NotFoundError('License allocation not found');
      }

      // MEMBER role constraint: can only release self allocation
      if (callerRole === 'MEMBER' && allocation.userId !== callerUserId) {
        throw new ForbiddenError('Standard members can only release their own seat allocations.');
      }

      await allocationRepository.releaseSeat(
        tx,
        allocationId,
        callerUserId,
        reason || 'User seat release'
      );

      return {
        success: true,
        message: 'License seat released successfully via sp_release_license_seat',
        allocationId,
      };
    });
  }

  public async listAllocationsByLicense(
    prismaClient: any,
    licenseId: string,
    params: PaginationParams,
    callerUserId?: string,
    callerRole?: string
  ) {
    const filterUserId = callerRole === 'MEMBER' ? callerUserId : undefined;
    const { data, total } = await allocationRepository.findByLicense(
      prismaClient,
      licenseId,
      params,
      filterUserId
    );
    return formatPaginatedResponse(data, total, params);
  }

  public async listAllocationsByUser(
    prismaClient: any,
    userId: string,
    params: PaginationParams,
    callerUserId: string,
    callerRole: string
  ) {
    if (callerRole === 'MEMBER' && userId !== callerUserId) {
      throw new ForbiddenError('Standard members cannot view allocations of other users.');
    }

    const { data, total } = await allocationRepository.findByUser(prismaClient, userId, params);
    return formatPaginatedResponse(data, total, params);
  }

  public async listAllocations(prismaClient: any, tenantId: string, params: PaginationParams, status?: string) {
    const { data, total } = await allocationRepository.findAll(prismaClient, tenantId, params, status);
    return formatPaginatedResponse(data, total, params);
  }
}

export const allocationService = new AllocationService();


