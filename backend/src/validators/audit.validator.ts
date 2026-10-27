// ==============================================================================
// AssetVault: Audit Log Request Validators
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { z } from 'zod';
import { AuditAction } from '@prisma/client';

export const queryAuditLogSchema = z
  .object({
    page: z.string().optional(),
    limit: z.string().optional(),
    tableName: z.string().optional(),
    action: z.nativeEnum(AuditAction).optional(),
    userId: z.string().min(1).optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
  })
  .strip();
