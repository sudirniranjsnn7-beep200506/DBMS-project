// ==============================================================================
// AssetVault: Plan Request Validators
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { z } from 'zod';

export const createPlanSchema = z
  .object({
    name: z.string().min(2).max(50).trim(),
    maxUsers: z.number().int().positive('maxUsers must be greater than 0'),
    maxAssets: z.number().int().positive('maxAssets must be greater than 0'),
    monthlyPrice: z.number().min(0, 'monthlyPrice cannot be negative').default(0),
    isActive: z.boolean().default(true),
  })
  .strip();

export const updatePlanSchema = z
  .object({
    name: z.string().min(2).max(50).trim().optional(),
    maxUsers: z.number().int().positive().optional(),
    maxAssets: z.number().int().positive().optional(),
    monthlyPrice: z.number().min(0).optional(),
    isActive: z.boolean().optional(),
  })
  .strip();

export const queryPlanSchema = z
  .object({
    page: z.string().optional(),
    limit: z.string().optional(),
    q: z.string().optional(),
    sort: z.string().optional(),
    order: z.enum(['asc', 'desc']).optional(),
    isActive: z.enum(['true', 'false']).optional(),
  })
  .strip();
