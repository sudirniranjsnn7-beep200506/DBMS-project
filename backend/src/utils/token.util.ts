// ==============================================================================
// AssetVault: JWT & Refresh Token Utilities
// Course: BCSE307L Database Systems (Fall 2026-27)
// Enforces short-lived access tokens (15m) and secure httpOnly cookie storage
// ==============================================================================

import jwt from 'jsonwebtoken';
import { Response } from 'express';
import { env } from '../config/env';
import { RoleName } from '../config/permissions';
import { generateSecureRandomString, hashToken } from './hash.util';
import { UnauthorizedError } from '../errors/AppError';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  fullName: string;
  tenantId: string | null;
  roleId: number;
  role: RoleName;
  isSuperAdmin: boolean;
}

export const generateAccessToken = (user: {
  id: string;
  email: string;
  fullName: string;
  tenantId: string | null;
  roleId: number;
  role: RoleName;
  isSuperAdmin: boolean;
}): string => {
  const payload: AccessTokenPayload = {
    sub: user.id,
    email: user.email,
    fullName: user.fullName,
    tenantId: user.tenantId,
    roleId: user.roleId,
    role: user.role,
    isSuperAdmin: user.isSuperAdmin,
  };

  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
};

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Access token has expired', { expired: true });
    }
    throw new UnauthorizedError('Invalid access token');
  }
};

export const generateRefreshTokenData = () => {
  const rawToken = generateSecureRandomString(40);
  const tokenHash = hashToken(rawToken);
  // Default to 7 days
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  return {
    rawToken,
    tokenHash,
    expiresAt,
  };
};

export const setRefreshTokenCookie = (res: Response, rawToken: string): void => {
  const sameSite = (env.COOKIE_SAMESITE || (env.NODE_ENV === 'production' ? 'none' : 'strict')) as
    | 'lax'
    | 'strict'
    | 'none';

  res.cookie('refreshToken', rawToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite,
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    path: '/api',
  });
};

export const clearRefreshTokenCookie = (res: Response): void => {
  const sameSite = (env.COOKIE_SAMESITE || (env.NODE_ENV === 'production' ? 'none' : 'strict')) as
    | 'lax'
    | 'strict'
    | 'none';

  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite,
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
    path: '/api',
  });
};
