// ==============================================================================
// AssetVault: Tag Request Validators
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { z } from 'zod';

export const createTagSchema = z
  .object({
    name: z.string().min(1).max(50).trim(),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a valid 6-digit hexadecimal color (e.g. #6366f1)')
      .default('#6366f1'),
  })
  .strip();

export const updateTagSchema = z
  .object({
    name: z.string().min(1).max(50).trim().optional(),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a valid 6-digit hexadecimal color')
      .optional(),
  })
  .strip();

export const queryTagSchema = z
  .object({
    page: z.string().optional(),
    limit: z.string().optional(),
    q: z.string().optional(),
    sort: z.string().optional(),
    order: z.enum(['asc', 'desc']).optional(),
  })
  .strip();
