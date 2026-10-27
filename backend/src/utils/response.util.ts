// ==============================================================================
// AssetVault: Standardized JSON Response Utility
// Course: BCSE307L Database Systems (Fall 2026-27)
// Handles BigInt JSON serialization and standardized { status, data, meta } envelope
// ==============================================================================

import { Response } from 'express';
import { Prisma } from '@prisma/client';
import { PaginationMeta } from './pagination.util';

function serializeBigInt(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return obj.toString();
  // Prisma Decimal instances are objects with enumerable internals. Preserve
  // their numeric value before recursively processing plain objects, or JSON
  // responses turn prices into { s, e, d } and the frontend renders NaN.
  if (Prisma.Decimal.isDecimal(obj)) return obj.toString();
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) return obj.map(serializeBigInt);
  if (typeof obj === 'object') {
    const res: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      res[key] = serializeBigInt(obj[key]);
    }
    return res;
  }
  return obj;
}

export const sendResponse = <T>(
  res: Response,
  statusCode: number,
  data: T,
  meta?: PaginationMeta | Record<string, unknown>
): void => {
  res.status(statusCode).json({
    status: 'success',
    data: serializeBigInt(data),
    ...(meta ? { meta: serializeBigInt(meta) } : {}),
  });
};
