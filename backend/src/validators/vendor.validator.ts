// ==============================================================================
// AssetVault: Vendor Request Validators
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { z } from 'zod';

export const createVendorSchema = z
  .object({
    name: z.string().min(2).max(100).trim(),
    contactEmail: z.string().email().toLowerCase().trim().optional().nullable(),
    website: z.string().url().optional().nullable(),
    supportPhone: z.string().max(30).optional().nullable(),
  })
  .strip();

export const updateVendorSchema = z
  .object({
    name: z.string().min(2).max(100).trim().optional(),
    contactEmail: z.string().email().toLowerCase().trim().optional().nullable(),
    website: z.string().url().optional().nullable(),
    supportPhone: z.string().max(30).optional().nullable(),
  })
  .strip();

export const queryVendorSchema = z
  .object({
    page: z.string().optional(),
    limit: z.string().optional(),
    q: z.string().optional(),
    sort: z.string().optional(),
    order: z.enum(['asc', 'desc']).optional(),
  })
  .strip();
