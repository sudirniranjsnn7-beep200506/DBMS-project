// ==============================================================================
// AssetVault: Authentication & Session Routes
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { Router } from 'express';
import passport from 'passport';
import { authController } from '../controllers/auth.controller';
import { validate } from '../middleware/validate.middleware';
import { authenticate } from '../middleware/auth.middleware';
import { loadUser } from '../middleware/loadUser.middleware';
import { authRateLimiter, refreshRateLimiter } from '../middleware/rateLimiter.middleware';
import { loginSchema, registerTenantSchema, refreshTokenSchema } from '../validators/auth.validator';
import { env } from '../config/env';

const router = Router();
const primaryClientUrl = (env.CLIENT_URL.split(',')[0] || 'http://localhost:5173')
  .trim()
  .replace(/\/$/, '');

// 1. Password Login
router.post('/login', authRateLimiter, validate(loginSchema), authController.login);

// 2. Tenant Self-Registration
router.post('/register-tenant', authRateLimiter, validate(registerTenantSchema), authController.registerTenant);

// 3. Token Refresh with Rotation & Reuse Detection (uses looser limiter)
router.post('/refresh', refreshRateLimiter, validate(refreshTokenSchema), authController.refresh);

// 4. Logout (current session)
router.post('/logout', authController.logout);

// 5. Logout All (revokes all active refresh tokens for the authenticated user)
router.post('/logout-all', authenticate, loadUser, authController.logoutAll);

// 6. Current User Profile & Derived Permissions
router.get('/me', authenticate, loadUser, authController.getMe);

// 7. Role-Based Navigation Menu
router.get('/menu', authenticate, loadUser, authController.getMenu);

// 8. Google OAuth 2.0 Endpoints (optional; only register when credentials are configured)
if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
  router.get(
    '/google',
    passport.authenticate('google', {
      scope: ['profile', 'email'],
      session: false,
    })
  );

  router.get(
    '/google/callback',
    passport.authenticate('google', {
      session: false,
      failureRedirect: `${primaryClientUrl}/login?error=not_invited`,
    }),
    authController.googleCallback
  );
}

export default router;
