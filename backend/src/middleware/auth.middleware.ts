// ==============================================================================
// AssetVault: JWT Authentication Middleware
// Course: BCSE307L Database Systems (Fall 2026-27)
// Extracts and verifies Bearer access token signature & expiration
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/token.util';
import { UnauthorizedError } from '../errors/AppError';

export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader) {
    const parts = authHeader.trim().split(/\s+/);
    const [scheme, val] = parts;
    if (parts.length === 2 && scheme?.toLowerCase() === 'bearer' && val) {
      token = val;
    } else {
      throw new UnauthorizedError('Invalid authorization scheme. Format: Bearer <token>');
    }
  }

  if (!token) {
    throw new UnauthorizedError('Authorization header missing');
  }

  const decoded = verifyAccessToken(token);

  req.jwtUser = {
    sub: decoded.sub,
    email: decoded.email,
    role: decoded.role,
    tenantId: decoded.tenantId,
  };

  next();
};
