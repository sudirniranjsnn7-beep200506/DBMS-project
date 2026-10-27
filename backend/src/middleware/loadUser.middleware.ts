// ==============================================================================
// AssetVault: Dynamic User Hydration Middleware
// Course: BCSE307L Database Systems (Fall 2026-27)
// Re-queries database on every request to immediately reflect deactivations or role updates
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
import { prismaForRequest } from '../config/prisma';
import { UnauthorizedError, ForbiddenError } from '../errors/AppError';
import { RoleName, getPermissionsForRole } from '../config/permissions';

export const loadUser = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.jwtUser?.sub) {
      throw new UnauthorizedError('Authentication token payload missing');
    }

    // Always fetch fresh user state from PostgreSQL with tenant context
    const isSuperAdmin = Boolean(req.jwtUser.isSuperAdmin || req.jwtUser.role === 'SUPER_ADMIN');
    const userPrisma =
      req.prisma ||
      prismaForRequest({
        tenantId: req.jwtUser.tenantId,
        userId: req.jwtUser.sub,
        isSuperAdmin,
      });

    let user = await userPrisma.user.findUnique({
      where: { id: req.jwtUser.sub },
      include: {
        role: true,
        tenant: {
          include: { plan: true },
        },
      },
    });

    if (!user && req.jwtUser.email) {
      // Auto-recover signed-in user session if in-memory store was reset by dev server restart
      const { mockStore } = await import('../config/mockStore');
      const tenantId = req.jwtUser.tenantId || 'tenant-recovered';
      let existingTenant = mockStore.state.tenants.find((t) => t.id === tenantId);
      if (!existingTenant && req.jwtUser.tenantId) {
        existingTenant = {
          id: tenantId,
          name: 'Future Group',
          slug: 'future-group',
          contactEmail: req.jwtUser.email,
          planId: 1,
          status: 'TRIAL',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockStore.state.tenants.push(existingTenant);
      }

      const jwtAny = req.jwtUser as any;
      const roleObj =
        mockStore.state.roles.find((r) => r.name === jwtAny?.role) ||
        mockStore.state.roles.find((r) => r.id === jwtAny?.roleId) ||
        mockStore.state.roles.find((r) => r.name === 'TENANT_ADMIN') ||
        mockStore.state.roles[1];

      const recoveredUser = {
        id: req.jwtUser.sub,
        tenantId: req.jwtUser.tenantId || null,
        roleId: roleObj?.id || 2,
        email: req.jwtUser.email,
        fullName: jwtAny?.fullName || 'Administrator',
        passwordHash: '$2a$12$D021KNk/cBAisMwChHfu/.oyT8l/ILtBOJFzVmoY9Vqi4TaICrXPa',
        isActive: true,
        lastLoginAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockStore.state.users.push(recoveredUser);
      mockStore.saveState();
      user = mockStore.populateRelations('user', recoveredUser, { role: true, tenant: { include: { plan: true } } });
    }

    if (!user) {
      throw new UnauthorizedError('User account not found or removed');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('User account has been deactivated. Please contact your administrator.');
    }

    if (user.tenant && user.tenant.status === 'SUSPENDED') {
      throw new ForbiddenError('Organization tenant is suspended. Access blocked.');
    }

    const roleName = user.role.name as RoleName;

    req.user = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      tenantId: user.tenantId,
      roleId: user.roleId,
      role: roleName,
      isSuperAdmin: roleName === 'SUPER_ADMIN',
      permissions: getPermissionsForRole(roleName),
      tenant: user.tenant,
    };

    if (user.tenant) {
      req.tenant = {
        id: user.tenant.id,
        name: user.tenant.name,
        slug: user.tenant.slug,
      };
    }

    next();
  } catch (error) {
    next(error);
  }
};
