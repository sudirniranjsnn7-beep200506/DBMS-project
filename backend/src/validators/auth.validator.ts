// ==============================================================================
// AssetVault: Authentication Request Validators
// Course: BCSE307L Database Systems (Fall 2026-27)
// Enforces strong password complexity and strict mass-assignment prevention
// ==============================================================================

import { z } from 'zod';

export const passwordStrengthRegex = {
  upper: /[A-Z]/,
  lower: /[a-z]/,
  digit: /[0-9]/,
  symbol: /[^A-Za-z0-9]/,
};

export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters long')
  .max(128, 'Password cannot exceed 128 characters')
  .regex(passwordStrengthRegex.upper, 'Password must contain at least one uppercase letter')
  .regex(passwordStrengthRegex.lower, 'Password must contain at least one lowercase letter')
  .regex(passwordStrengthRegex.digit, 'Password must contain at least one numeric digit')
  .regex(passwordStrengthRegex.symbol, 'Password must contain at least one special symbol');

export const loginSchema = z
  .object({
    email: z.string().email('Valid email address is required').toLowerCase().trim(),
    password: z.string().min(1, 'Password is required'),
  })
  .strip();

export const registerTenantSchema = z
  .preprocess(
    (val: any) => {
      if (typeof val !== 'object' || val === null) return val;
      const adminFullName = val.adminFullName || val.fullName;
      const adminEmail = val.adminEmail || val.email;
      const contactEmail = val.contactEmail || adminEmail;
      let slug = val.slug || val.tenantSlug;
      if (!slug && val.tenantName) {
        slug = val.tenantName
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
        if (slug.length < 2) slug = `org-${slug || 'tenant'}`;
      }
      return {
        ...val,
        adminFullName,
        adminEmail,
        contactEmail,
        slug,
      };
    },
    z
      .object({
        tenantName: z.string().min(2, 'Tenant name must be at least 2 characters').max(100).trim(),
        slug: z
          .string()
          .min(2, 'Slug must be at least 2 characters')
          .max(50)
          .regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase alphanumeric characters and hyphens')
          .trim(),
        contactEmail: z.string().email('Valid organization contact email is required').toLowerCase().trim(),
        adminFullName: z.string().min(2, 'Administrator name is required').max(100).trim(),
        adminEmail: z.string().email('Valid administrator email is required').toLowerCase().trim(),
        password: passwordSchema,
      })
      .strip()
  );

export const refreshTokenSchema = z
  .object({
    refreshToken: z.string().optional(),
  })
  .strip();

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterTenantInput = z.infer<typeof registerTenantSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
