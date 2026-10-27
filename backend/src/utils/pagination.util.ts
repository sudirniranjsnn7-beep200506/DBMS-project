// ==============================================================================
// AssetVault: Reusable Pagination & Query Helper
// Course: BCSE307L Database Systems (Fall 2026-27)
// Enforces standard response shape: { data: [...], meta: { page, limit, total, totalPages, hasNext, hasPrev } }
// ==============================================================================

import { Request } from 'express';

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
  q?: string;
  sort: string;
  order: 'asc' | 'desc';
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

export const getPaginationParams = (
  req: Request,
  defaultSort = 'createdAt',
  allowedSortFields: string[] = ['createdAt', 'updatedAt', 'name', 'id']
): PaginationParams => {
  const rawPage = parseInt(req.query.page as string, 10);
  const rawLimit = parseInt(req.query.limit as string, 10);

  const page = !isNaN(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit = !isNaN(rawLimit) && rawLimit > 0 ? Math.min(100, rawLimit) : 10;
  const skip = (page - 1) * limit;

  const rawQ = req.query.q as string;
  const q = typeof rawQ === 'string' && rawQ.trim().length > 0 ? rawQ.trim() : undefined;

  const rawSort = req.query.sort as string;
  const sort = allowedSortFields.includes(rawSort) ? rawSort : defaultSort;

  const rawOrder = (req.query.order as string)?.toLowerCase();
  const order = rawOrder === 'asc' ? 'asc' : 'desc';

  return {
    page,
    limit,
    skip,
    q,
    sort,
    order,
  };
};

export const createPaginationMeta = (
  total: number,
  page: number,
  limit: number
): PaginationMeta => {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
};

export const formatPaginatedResponse = <T>(
  data: T[],
  total: number,
  params: { page: number; limit: number }
): PaginatedResult<T> => {
  return {
    data,
    meta: createPaginationMeta(total, params.page, params.limit),
  };
};
