// ==============================================================================
// AssetVault: Notification Request Validators
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { z } from 'zod';
import { NotificationType } from '@prisma/client';
import {
  isoDateStringSchema,
  limitQuerySchema,
  numericCursorSchema,
  pageQuerySchema,
} from './access.validator';

export const queryNotificationSchema = z
  .object({
    page: pageQuerySchema.optional(),
    limit: limitQuerySchema.optional(),
    cursor: numericCursorSchema.optional(),
    isRead: z.enum(['true', 'false']).optional(),
    type: z.nativeEnum(NotificationType).optional(),
    dateFrom: isoDateStringSchema.optional(),
    dateTo: isoDateStringSchema.optional(),
    sort: z.enum(['createdAt', 'isRead', 'type', 'id']).optional(),
    order: z.enum(['asc', 'desc']).optional(),
  })
  .strip();

export const runExpiryCheckSchema = z.preprocess(
  (val: any) => {
    if (val && typeof val === 'object') {
      const rawDays = val.lookaheadDays !== undefined ? val.lookaheadDays : val.daysAhead;
      const lookaheadDays =
        rawDays !== undefined
          ? typeof rawDays === 'string'
            ? parseInt(rawDays, 10)
            : rawDays
          : 30;
      return {
        ...val,
        lookaheadDays,
      };
    }
    return { lookaheadDays: 30 };
  },
  z
    .object({
      lookaheadDays: z.number().int().min(1).max(365).default(30),
    })
    .passthrough()
);
