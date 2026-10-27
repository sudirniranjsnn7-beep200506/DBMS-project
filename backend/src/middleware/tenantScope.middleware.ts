// ==============================================================================
// AssetVault: Tenant Context & Isolation Middleware
// Course: BCSE307L Database Systems (Fall 2026-27)
// Binds tenant-aware Prisma client with RLS session context variables
// Uses one dedicated transaction/connection per request with set_config called once
// Cross-tenant ID probing returns 404 (never 403) to prevent ID enumeration
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { NotFoundError, UnauthorizedError } from '../errors/AppError';
import { prisma, prismaForRequest } from '../config/prisma';

export const tenantContext = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user && !req.jwtUser) {
    throw new UnauthorizedError('Authentication required prior to tenant scoping');
  }

  // Probe prevention: If caller explicitly passes a foreign tenant ID, return 404 (never 403)
  // For tenant routes (/api/tenants/:id), req.params.id represents the target tenant ID
  const isTenantRoute = req.baseUrl === '/api/tenants' || req.baseUrl.endsWith('/tenants');
  const routeTenantId =
    isTenantRoute && req.params.id && req.params.id !== 'current' ? req.params.id : undefined;

  const userTenantId = req.user?.tenantId || req.jwtUser?.tenantId || '';
  const userId = req.user?.id || req.jwtUser?.sub || '';
  const isSuperAdminBool = Boolean(
    req.user?.isSuperAdmin || req.jwtUser?.isSuperAdmin || req.jwtUser?.role === 'SUPER_ADMIN'
  );
  const isSuperAdmin = isSuperAdminBool ? 'true' : 'false';

  const requestedTenantId =
    (req.headers['x-tenant-id'] as string) || req.params.tenantId || routeTenantId || userTenantId;

  if (!isSuperAdminBool && requestedTenantId && requestedTenantId !== userTenantId) {
    throw new NotFoundError('Organization resource not found');
  }

  if (req.user?.tenant) {
    req.tenant = {
      id: req.user.tenant.id,
      name: req.user.tenant.name,
      slug: req.user.tenant.slug,
    };
  }

  if ((req as any).__inRequestTx) {
    return next();
  }

  // SSE Stream endpoints hold the connection indefinitely; do not bind to an interactive transaction
  const isSseStream =
    req.path === '/stream' ||
    req.path.endsWith('/stream') ||
    Boolean(req.headers.accept?.includes('text/event-stream'));

  if (isSseStream) {
    req.prisma = prismaForRequest({
      tenantId: userTenantId,
      userId: userId,
      isSuperAdmin: isSuperAdminBool,
    });
    return next();
  }

  // Redesign: One interactive transaction/connection per request with set_config called once
  prisma.$transaction(
    async (tx) => {
      (req as any).__inRequestTx = true;

      // 1. Set RLS context once for this transaction/connection
      await tx.$executeRaw(
        (Prisma as any).sql`SELECT 
          set_config('app.current_tenant_id', ${userTenantId}, true),
          set_config('app.current_user_id', ${userId}, true),
          set_config('app.is_super_admin', ${isSuperAdmin}, true);`
      );

      // 2. Attach middleware-scoped client wrapping tx
      req.prisma = prismaForRequest(
        {
          tenantId: userTenantId,
          userId: userId,
          isSuperAdmin: isSuperAdminBool,
        },
        tx
      );

      // 3. Keep connection active until response completes
      let settled = false;
      await new Promise<void>((resolve, reject) => {
        const onDone = (statusCode: number) => {
          if (settled) return;
          settled = true;
          if (statusCode >= 400) {
            reject(new Error(`HTTP ${statusCode}`));
          } else {
            resolve();
          }
        };

        res.once('finish', () => onDone(res.statusCode));
        res.once('close', () => {
          if (settled) return;
          if (!res.writableFinished) {
            settled = true;
            reject(new Error('Response closed before it could finish'));
          }
        });
        res.once('error', (err) => {
          if (!settled) {
            settled = true;
            reject(err);
          }
        });

        next();
      });
    },
    {
      maxWait: 5000,
      timeout: 30000,
    }
  ).catch((_err) => {
    if (!res.headersSent) {
      // If PostgreSQL is unreachable or transaction timed out, fall back gracefully
      req.prisma = prismaForRequest({
        tenantId: userTenantId,
        userId: userId,
        isSuperAdmin: isSuperAdminBool,
      });
      next();
    }
  });
};

export const tenantScope = tenantContext;
