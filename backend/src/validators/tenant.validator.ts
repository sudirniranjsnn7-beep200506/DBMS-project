// ==============================================================================
// AssetVault: Tenant Request Validators
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { z } from 'zod';
import { TenantStatus } from '@prisma/client';

export const createTenantSchema = z
  .object({
    name: z.string().min(2).max(100).trim(),
    slug: z
      .string()
      .min(2)
      .max(50)
      .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase alphanumeric characters and hyphens')
      .trim(),
    contactEmail: z.string().email().toLowerCase().trim(),
    planId: z.number().int().positive(),
  })
  .strip();

export const updateTenantSchema = z
  .object({
    name: z.string().min(2).max(100).trim().optional(),
    contactEmail: z.string().email().toLowerCase().trim().optional(),
    planId: z.number().int().positive().optional(),
    status: z.nativeEnum(TenantStatus).optional(),
  })
  .strip();

export const updateTenantStatusSchema = z
  .object({
    status: z.nativeEnum(TenantStatus),
  })
  .strip();

export const updateTenantPlanSchema = z
  .object({
    planId: z.number().int().positive(),
  })
  .strip();

export const queryTenantSchema = z
  .object({
    page: z.string().optional(),
    limit: z.string().optional(),
    q: z.string().optional(),
    sort: z.string().optional(),
    order: z.enum(['asc', 'desc']).optional(),
    status: z.nativeEnum(TenantStatus).optional(),
    planId: z.string().optional(),
  })
  .strip();
