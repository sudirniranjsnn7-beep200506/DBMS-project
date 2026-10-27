// ==============================================================================
// AssetVault: Authentication HTTP Controllers
// Course: BCSE307L Database Systems (Fall 2026-27)
// Enforces cookie-based token handling, generic responses, and server-driven menus
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import {
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
  generateAccessToken,
  generateRefreshTokenData,
} from '../utils/token.util';
import { systemPrisma } from '../config/prisma';
import { env } from '../config/env';

export class AuthController {
  /**
   * POST /api/auth/login
   */
  public async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.login(req.body, {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      });

      setRefreshTokenCookie(res, result.rawRefreshToken);

      res.status(200).json({
        status: 'success',
        data: {
          accessToken: result.accessToken,
          user: result.user,
          refreshToken: result.rawRefreshToken,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/register-tenant
   */
  public async registerTenant(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.registerTenant(req.body, {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      });

      setRefreshTokenCookie(res, result.rawRefreshToken);

      res.status(201).json({
        status: 'success',
        data: {
          accessToken: result.accessToken,
          user: result.user,
          refreshToken: result.rawRefreshToken,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/refresh
   */
  public async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

      const result = await authService.refresh(rawRefreshToken, {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      });

      if (result.newRawRefreshToken) {
        setRefreshTokenCookie(res, result.newRawRefreshToken);
      } else {
        clearRefreshTokenCookie(res);
      }

      res.status(200).json({
        status: 'success',
        data: {
          accessToken: result.accessToken,
          ...(result.newRawRefreshToken ? { refreshToken: result.newRawRefreshToken } : {}),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/logout
   */
  public async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
      await authService.logout(rawRefreshToken);
      clearRefreshTokenCookie(res);

      res.status(200).json({
        status: 'success',
        message: 'Successfully logged out',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/logout-all
   */
  public async logoutAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user?.id) {
        await authService.logoutAll(req.user.id);
      }
      clearRefreshTokenCookie(res);

      res.status(200).json({
        status: 'success',
        message: 'All active sessions successfully revoked',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/auth/me
   */
  public async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = await authService.getMe(req.user!.id);

      res.status(200).json({
        status: 'success',
        data: profile,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/auth/menu
   */
  public async getMenu(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const menu = authService.getMenu(req.user!.role);

      res.status(200).json({
        status: 'success',
        data: menu,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/auth/google/callback
   */
  public async googleCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const allowedClientOrigins = env.CLIENT_URL
        .split(',')
        .map((origin) => origin.trim().replace(/\/$/, ''))
        .filter(Boolean);
      const primaryClientUrl = allowedClientOrigins[0] || 'http://localhost:5173';
      const requestOrigin = typeof req.headers.origin === 'string' ? req.headers.origin.replace(/\/$/, '') : '';
      const redirectOrigin = allowedClientOrigins.includes(requestOrigin)
        ? requestOrigin
        : primaryClientUrl;

      const user = req.user;
      if (!user) {
        res.redirect(`${redirectOrigin}/login?error=not_invited`);
        return;
      }

      // Generate access token & refresh token
      const accessToken = generateAccessToken({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        tenantId: user.tenantId,
        roleId: user.roleId,
        role: user.role,
        isSuperAdmin: user.isSuperAdmin,
      });

      const refreshData = generateRefreshTokenData();

      await systemPrisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: refreshData.tokenHash,
          expiresAt: refreshData.expiresAt,
          userAgent: req.headers['user-agent'],
          ipAddress: req.ip,
        },
      });

      setRefreshTokenCookie(res, refreshData.rawToken);

      // Redirect client with access token
      res.redirect(`${redirectOrigin}/oauth-callback#token=${encodeURIComponent(accessToken)}`);
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
