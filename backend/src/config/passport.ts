// ==============================================================================
// AssetVault: Passport Google OAuth 2.0 Strategy
// Course: BCSE307L Database Systems (Fall 2026-27)
// Enforces strict tenant invitation policy (Never auto-creates uninvited accounts)
// ==============================================================================

import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { env } from './env';
import { systemPrisma } from './prisma';
import { logger } from './logger';
import { getPermissionsForRole, RoleName } from './permissions';

export const configurePassport = (): void => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    logger.warn('Google OAuth credentials not configured; OAuth endpoints disabled in this environment.');
    return;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        callbackURL: env.GOOGLE_CALLBACK_URL,
        proxy: true,
      },
      async (_accessToken: string, _refreshToken: string, profile: any, done: (err: any, user?: any, info?: any) => void) => {
        try {
          const verifiedEmail = profile.emails?.find((entry: { value: string; verified?: boolean }) => entry.verified === true)?.value;
          const email = verifiedEmail?.toLowerCase().trim();
          if (!email) {
            return done(new Error('Google profile did not provide a verified email address'), undefined);
          }

          // 1. Look up existing pre-invited user by email or existing googleId
          let user = await systemPrisma.user.findFirst({
            where: {
              OR: [{ googleId: profile.id }, { email }],
            },
            include: {
              role: true,
              tenant: {
                include: { plan: true },
              },
            },
          });

          // 2. Strict Requirement: If no user exists, do NOT auto-create; fail with not_invited
          if (!user) {
            logger.info({ email }, 'Google OAuth attempted by uninvited email. Registration blocked.');
            return done(null, false, { message: 'not_invited' });
          }

          // 3. Reject inactive accounts
          if (!user.isActive) {
            return done(null, false, { message: 'account_inactive' });
          }

          // 4. Reject suspended tenants
          if (user.tenant && user.tenant.status === 'SUSPENDED') {
            return done(null, false, { message: 'tenant_suspended' });
          }

          // 5. Link Google ID and avatar on first Google OAuth login
          if (!user.googleId) {
            user = await systemPrisma.user.update({
              where: { id: user.id },
              data: {
                googleId: profile.id,
                avatarUrl: profile.photos?.[0]?.value || user.avatarUrl,
                lastLoginAt: new Date(),
              },
              include: {
                role: true,
                tenant: {
                  include: { plan: true },
                },
              },
            });
          } else {
            await systemPrisma.user.update({
              where: { id: user.id },
              data: { lastLoginAt: new Date() },
            });
          }

          const roleName = user.role.name as RoleName;
          const authUser = {
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

          return done(null, authUser);
        } catch (error) {
          logger.error({ error }, 'Error in Google OAuth authentication callback');
          return done(error as Error, undefined);
        }
      }
    )
  );
};
