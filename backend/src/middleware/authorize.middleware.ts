// ==============================================================================
// AssetVault: Role-Based Authorization Middleware
// Course: BCSE307L Database Systems (Fall 2026-27)
// Enforces granular permissions derived from single source of truth (/docs/rbac-matrix.md)
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
import { Permission, hasPermission } from '../config/permissions';
import { ForbiddenError, UnauthorizedError } from '../errors/AppError';

export const authorize = (permission: Permission) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required before authorization check');
    }

    if (!hasPermission(req.user.role, permission)) {
      throw new ForbiddenError(
        `Forbidden: Role '${req.user.role}' lacks permission '${permission}' for this resource.`
      );
    }

    next();
  };
};
