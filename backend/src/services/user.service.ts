// ==============================================================================
// AssetVault: User Service
// Course: BCSE307L Database Systems (Fall 2026-27)
// Enforces atomic role changes with audit notes and token invalidation on deactivation
// ==============================================================================

import { userRepository } from '../repositories/user.repository';
import { NotFoundError, ConflictError, BadRequestError } from '../errors/AppError';
import { PaginationParams, formatPaginatedResponse } from '../utils/pagination.util';
import { hashPassword } from '../utils/hash.util';
import { prisma } from '../config/prisma';
import { Prisma } from '@prisma/client';
import { mockStore } from '../config/mockStore';

export class UserService {
  public async listUsers(
    prismaClient: any,
    params: PaginationParams,
    filter?: { roleId?: number; roleName?: string; isActive?: boolean }
  ) {
    const { data, total } = await userRepository.findMany(prismaClient, params, filter);
    return formatPaginatedResponse(data, total, params);
  }

  public async getUserById(prismaClient: any, id: string) {
    const user = await userRepository.findById(prismaClient, id);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return user;
  }

  public async createUser(prismaClient: any, tenantId: string, data: any, _actorUserId?: string) {
    const existing = await prismaClient.user.findUnique({
      where: { email: data.email },
    });
    if (existing) {
      throw new ConflictError(`User with email '${data.email}' already exists.`);
    }

    const role = await prismaClient.role.findUnique({
      where: { name: data.roleName },
    });
    if (!role || role.name === 'SUPER_ADMIN') {
      throw new BadRequestError('Invalid organization role specified.');
    }

    const passwordHash = await hashPassword(data.password);

    return userRepository.create(prismaClient, {
      email: data.email,
      fullName: data.fullName,
      passwordHash,
      avatarUrl: data.avatarUrl || null,
      role: { connect: { id: role.id } },
      tenant: { connect: { id: tenantId } },
      isActive: true,
    });
  }

  public async updateUser(prismaClient: any, id: string, data: any) {
    const existingUser = await this.getUserById(prismaClient, id);

    if (data.email && data.email.toLowerCase() !== existingUser.email?.toLowerCase()) {
      const duplicate = await prismaClient.user.findUnique({
        where: { email: data.email.toLowerCase() },
      });
      if (duplicate && duplicate.id !== id) {
        throw new ConflictError(`Another user with email '${data.email}' already exists.`);
      }
    }

    const updated = await userRepository.update(prismaClient, id, data);

    // Sync any in-memory allocations for this user so seat allocations reflect the updated email/name
    for (const alloc of mockStore.state.allocations as any[]) {
      if (alloc.userId === id) {
        if (data.email) alloc.userEmail = data.email;
        if (data.fullName) alloc.userName = data.fullName;
        if (alloc.user) {
          if (data.email) alloc.user.email = data.email;
          if (data.fullName) alloc.user.fullName = data.fullName;
        }
      }
    }

    return updated;
  }

  public async updateUserStatus(prismaClient: any, id: string, isActive: boolean) {
    await this.getUserById(prismaClient, id);
    const updated = await userRepository.update(prismaClient, id, { isActive });

    // If deactivated, revoke all active sessions immediately
    if (!isActive) {
      await prismaClient.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    return updated;
  }

  /**
   * Atomic User Role Change with Audit Note
   * Transaction 5: Updates user role and records an immutable audit log entry
   */
  public async changeUserRole(
    tenantId: string,
    userId: string,
    newRoleName: string,
    reason: string = 'Administrative role realignment',
    actorUserId?: string
  ) {
    if (newRoleName === 'SUPER_ADMIN') {
      throw new BadRequestError('Cannot promote organizational user to SUPER_ADMIN.');
    }

    return prisma.$transaction(async (tx: any) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT 
          set_config('app.current_tenant_id', ${tenantId}, true),
          set_config('app.current_user_id', ${actorUserId || ''}, true),
          set_config('app.audit_reason', ${reason}, true),
          set_config('app.is_super_admin', 'false', true);`
      );

      const targetRole = await tx.role.findUnique({ where: { name: newRoleName } });
      if (!targetRole) {
        throw new BadRequestError(`Role '${newRoleName}' does not exist.`);
      }

      const currentUser = await tx.user.findFirst({
        where: { id: userId, tenantId },
        include: { role: true },
      });
      if (!currentUser) {
        throw new NotFoundError('User not found in tenant organization.');
      }

      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { roleId: targetRole.id },
        select: {
          id: true,
          email: true,
          fullName: true,
          roleId: true,
          role: { select: { id: true, name: true, description: true } },
        },
      });

      // Revoke refresh tokens so user gets updated role claim on re-login
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      return updatedUser;
    });
  }

  public async resetPassword(prismaClient: any, id: string, newPassword: string) {
    await this.getUserById(prismaClient, id);
    const passwordHash = await hashPassword(newPassword);

    const updated = await userRepository.update(prismaClient, id, { passwordHash });

    // Revoke all refresh tokens on password reset
    await prismaClient.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return updated;
  }

  public async deleteUser(prismaClient: any, id: string) {
    await this.getUserById(prismaClient, id);

    await prismaClient.refreshToken.updateMany({
      where: { userId: id },
      data: { revokedAt: new Date() },
    });

    await prismaClient.licenseAllocation.updateMany({
      where: { userId: id, status: 'ACTIVE' },
      data: { status: 'RELEASED', releasedAt: new Date() },
    });

    return userRepository.delete(prismaClient, id);
  }
}

export const userService = new UserService();
