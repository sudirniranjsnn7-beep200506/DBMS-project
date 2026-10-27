// ==============================================================================
// AssetVault: Tenant Service
// Course: BCSE307L Database Systems (Fall 2026-27)
// Enforces atomic tenant suspension/deletion transactions with token revocation
// ==============================================================================

import { TenantStatus, Prisma } from '@prisma/client';
import { tenantRepository } from '../repositories/tenant.repository';
import { planRepository } from '../repositories/plan.repository';
import { NotFoundError, ConflictError, BadRequestError } from '../errors/AppError';
import { PaginationParams, formatPaginatedResponse } from '../utils/pagination.util';
import { prisma } from '../config/prisma';

export class TenantService {
  public async listTenants(
    prismaClient: any,
    params: PaginationParams,
    filter?: { status?: TenantStatus; planId?: number }
  ) {
    const { data, total } = await tenantRepository.findMany(prismaClient, params, filter);
    return formatPaginatedResponse(data, total, params);
  }

  public async getTenantById(prismaClient: any, id: string) {
    const tenant = await tenantRepository.findById(prismaClient, id);
    if (!tenant) {
      throw new NotFoundError('Tenant organization not found');
    }
    return tenant;
  }

  public async createTenant(prismaClient: any, data: any, _actorUserId?: string) {
    const existing = await tenantRepository.findBySlug(prismaClient, data.slug);
    if (existing) {
      throw new ConflictError(`Tenant slug '${data.slug}' is already taken.`);
    }

    const plan = await planRepository.findById(prismaClient, data.planId);
    if (!plan) {
      throw new BadRequestError('Referenced subscription plan does not exist.');
    }

    return tenantRepository.create(prismaClient, {
      name: data.name,
      slug: data.slug,
      contactEmail: data.contactEmail,
      plan: { connect: { id: data.planId } },
      status: 'TRIAL',
    });
  }

  public async updateTenant(prismaClient: any, id: string, data: any) {
    await this.getTenantById(prismaClient, id);
    if (data.planId) {
      const plan = await planRepository.findById(prismaClient, data.planId);
      if (!plan) {
        throw new BadRequestError('Referenced subscription plan does not exist.');
      }
    }
    return tenantRepository.update(prismaClient, id, data);
  }

  public async changePlan(prismaClient: any, id: string, planId: number) {
    await this.getTenantById(prismaClient, id);
    const plan = await planRepository.findById(prismaClient, planId);
    if (!plan) {
      throw new BadRequestError('Referenced subscription plan does not exist.');
    }
    return tenantRepository.update(prismaClient, id, { plan: { connect: { id: planId } } });
  }

  /**
   * Atomic Tenant Suspension / Activation
   * Transaction 6: Atomically updates status, revokes user tokens, and writes audit log
   */
  public async suspendOrActivateTenant(id: string, status: TenantStatus, actorUserId?: string) {
    return prisma.$transaction(async (tx: any) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT 
          set_config('app.is_super_admin', 'true', true),
          set_config('app.current_user_id', ${actorUserId || ''}, true);`
      );

      const current = await tx.tenant.findUnique({ where: { id } });
      if (!current) {
        throw new NotFoundError('Tenant organization not found');
      }

      const updated = await tx.tenant.update({
        where: { id },
        data: { status },
        include: { plan: true },
      });

      // If tenant is suspended, revoke all active refresh tokens for all tenant users
      if (status === 'SUSPENDED') {
        const tenantUsers = await tx.user.findMany({
          where: { tenantId: id },
          select: { id: true },
        });
        const userIds = tenantUsers.map((u: any) => u.id);

        if (userIds.length > 0) {
          await tx.refreshToken.updateMany({
            where: { userId: { in: userIds }, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }
      }

      return updated;
    });
  }

  /**
   * Atomic Tenant Deletion
   */
  public async deleteTenant(id: string, actorUserId?: string) {
    return prisma.$transaction(async (tx: any) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT 
          set_config('app.is_super_admin', 'true', true),
          set_config('app.allow_audit_delete', 'true', true),
          set_config('app.current_user_id', ${actorUserId || ''}, true);`
      );

      const current = await tx.tenant.findUnique({ where: { id } });
      if (!current) {
        throw new NotFoundError('Tenant organization not found');
      }

      // Revoke all tokens first
      const tenantUsers = await tx.user.findMany({
        where: { tenantId: id },
        select: { id: true },
      });
      const userIds = tenantUsers.map((u: any) => u.id);
      if (userIds.length > 0) {
        await tx.refreshToken.updateMany({
          where: { userId: { in: userIds } },
          data: { revokedAt: new Date() },
        });
      }

      // Explicit deleteMany calls for dependent tables before deleting assets and licenses
      await tx.licenseAllocation.deleteMany({
        where: { license: { tenantId: id } },
      });
      await tx.assetAccessLog.deleteMany({
        where: { asset: { tenantId: id } },
      });
      await tx.notification.deleteMany({
        where: { tenantId: id },
      });
      await tx.auditLog.deleteMany({
        where: { tenantId: id },
      });

      // Delete tenant's assets and licenses
      await tx.asset.deleteMany({ where: { tenantId: id } });
      await tx.license.deleteMany({ where: { tenantId: id } });

      // Clean up audit logs created by triggers during asset/license deletion
      await tx.auditLog.deleteMany({
        where: { tenantId: id },
      });

      // Delete vendors, categories, tags, and users before deleting tenant
      await tx.vendor.deleteMany({ where: { tenantId: id } });
      await tx.category.deleteMany({ where: { tenantId: id } });
      await tx.tag.deleteMany({ where: { tenantId: id } });
      await tx.user.deleteMany({ where: { tenantId: id } });

      // Final audit log clean up before tenant removal
      await tx.auditLog.deleteMany({
        where: { tenantId: id },
      });

      // Delete tenant
      const deleted = await tx.tenant.delete({ where: { id } });

      return deleted;
    });
  }
}

export const tenantService = new TenantService();
