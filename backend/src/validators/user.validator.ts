// ==============================================================================
// AssetVault: User Request Validators
// Course: BCSE307L Database Systems (Fall 2026-27)
// Enforces tenant role limits: Never permits assignment of SUPER_ADMIN
// ==============================================================================

import { z } from 'zod';

export const TENANT_ASSIGNABLE_ROLES = ['TENANT_ADMIN', 'ASSET_MANAGER', 'MEMBER'] as const;

export const createUserSchema = z
  .object({
    email: z.string().email().toLowerCase().trim(),
    fullName: z.string().min(2).max(100).trim(),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    roleName: z.enum(TENANT_ASSIGNABLE_ROLES, {
      errorMap: () => ({ message: 'roleName must be TENANT_ADMIN, ASSET_MANAGER, or MEMBER' }),
    }),
    avatarUrl: z.string().url().optional(),
  })
  .strip();

export const updateUserSchema = z
  .object({
    fullName: z.string().min(2).max(100).trim().optional(),
    email: z.string().email('Valid email address is required').toLowerCase().trim().optional(),
    avatarUrl: z.string().url().optional().nullable(),
  })
  .strip();

export const changeRoleSchema = z
  .object({
    roleName: z.enum(TENANT_ASSIGNABLE_ROLES, {
      errorMap: () => ({ message: 'roleName must be TENANT_ADMIN, ASSET_MANAGER, or MEMBER' }),
    }),
    reason: z.string().max(500).optional(),
  })
  .strip();

export const resetPasswordSchema = z
  .object({
    newPassword: z.string().min(6, 'Password must be at least 6 characters'),
  })
  .strip();

export const updateUserStatusSchema = z
  .object({
    isActive: z.boolean(),
  })
  .strip();

export const queryUserSchema = z
  .object({
    page: z.string().optional(),
    limit: z.string().optional(),
    q: z.string().optional(),
    sort: z.string().optional(),
    order: z.enum(['asc', 'desc']).optional(),
    role: z.string().optional(),
    isActive: z.enum(['true', 'false']).optional(),
  })
  .strip();
