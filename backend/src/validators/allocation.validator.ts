// ==============================================================================
// AssetVault: License Allocation Request Validators
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { z } from 'zod';

export const allocateSeatSchema = z
  .object({
    userId: z.string().min(1, 'userId is required').trim(),
    notes: z.string().max(500).optional(),
  })
  .strip();

export const releaseSeatSchema = z
  .object({
    allocationId: z.string().min(1).optional(),
    reason: z.string().max(255).optional(),
  })
  .strip();
