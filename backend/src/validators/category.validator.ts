// ==============================================================================
// AssetVault: Category Request Validators
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { z } from 'zod';

export const createCategorySchema = z
  .object({
    name: z.string().min(2).max(100).trim(),
    description: z.string().max(500).optional().nullable(),
    parentId: z.string().min(1).optional().nullable(),
  })
  .strip();

export const updateCategorySchema = z
  .object({
    name: z.string().min(2).max(100).trim().optional(),
    description: z.string().max(500).optional().nullable(),
    parentId: z.string().min(1).optional().nullable(),
  })
  .strip();

export const queryCategorySchema = z
  .object({
    page: z.string().optional(),
    limit: z.string().optional(),
    q: z.string().optional(),
    sort: z.string().optional(),
    order: z.enum(['asc', 'desc']).optional(),
    parentId: z.string().optional(),
  })
  .strip();
