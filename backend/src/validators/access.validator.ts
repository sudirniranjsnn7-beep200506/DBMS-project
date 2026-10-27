// ==============================================================================
// AssetVault: Access Log Request Validators
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { z } from 'zod';
import { AccessAction } from '@prisma/client';

export const isoDateStringSchema = z
  .string()
  .refine(
    (val) => {
      const parsed = Date.parse(val);
      if (isNaN(parsed)) return false;
      if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/.test(val)) {
        return false;
      }
      const datePart = val.slice(0, 10);
      const parts = datePart.split('-');
      if (parts.length !== 3) return false;
      const year = parseInt(parts[0]!, 10);
      const month = parseInt(parts[1]!, 10);
      const day = parseInt(parts[2]!, 10);
      if (isNaN(year) || isNaN(month) || isNaN(day)) return false;
      const dt = new Date(Date.UTC(year, month - 1, day));
      return dt.getUTCFullYear() === year && dt.getUTCMonth() + 1 === month && dt.getUTCDate() === day;
    },
    { message: 'Must be a valid ISO 8601 date string (e.g. YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ)' }
  );

export const limitQuerySchema = z
  .string()
  .regex(/^\d+$/, 'Limit must be a positive integer')
  .refine(
    (v) => {
      const n = parseInt(v, 10);
      return n >= 1 && n <= 100;
    },
    { message: 'Limit must be an integer between 1 and 100' }
  );

export const numericCursorSchema = z
  .string()
  .regex(/^\d+$/, 'Cursor must be a numeric integer');

export const pageQuerySchema = z
  .string()
  .regex(/^\d+$/, 'Page must be a positive integer')
  .refine((v) => parseInt(v, 10) >= 1, { message: 'Page must be at least 1' });

export const queryAccessLogSchema = z
  .object({
    page: pageQuerySchema.optional(),
    limit: limitQuerySchema.optional(),
    cursor: numericCursorSchema.optional(),
    action: z.nativeEnum(AccessAction).optional(),
    userId: z.string().min(1).optional(),
    assetId: z.string().min(1).optional(),
    dateFrom: isoDateStringSchema.optional(),
    dateTo: isoDateStringSchema.optional(),
    sort: z.enum(['accessedAt', 'action', 'id']).optional(),
    order: z.enum(['asc', 'desc']).optional(),
  })
  .strip();
