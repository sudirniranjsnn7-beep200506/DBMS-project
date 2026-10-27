// ==============================================================================
// AssetVault: Global Trigram Multi-Entity Search Engine
// Course: BCSE307L Database Systems (Fall 2026-27)
// Searches Assets, Licenses, Vendors and Tags in tenant using pg_trgm and ILIKE
// Enforces RBAC per entity type, wildcards escaping, and license key privacy
// ==============================================================================

import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { logger } from '../config/logger';
import { RoleName, hasPermission } from '../config/permissions';
import { BadRequestError } from '../errors/AppError';

export interface SearchResultItem {
  id: string;
  type: 'asset' | 'license' | 'vendor' | 'tag';
  title: string;
  subtitle: string;
  url: string;
  status?: string;
  meta?: any;
}

export interface GlobalSearchResponse {
  query: string;
  results: {
    assets: SearchResultItem[];
    licenses: SearchResultItem[];
    vendors: SearchResultItem[];
    tags: SearchResultItem[];
  };
  total: number;
}

export interface SearchCallerContext {
  userId?: string;
  role?: RoleName;
  isSuperAdmin?: boolean;
}

export const MIN_SEARCH_QUERY_LENGTH = 2;

/**
 * Escapes PostgreSQL LIKE/ILIKE wildcards (%, _, \) in user input
 * to prevent pattern probing and wildcard injection attacks.
 */
export function escapeLikePattern(input: string): string {
  return input
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}

export class SearchService {
  /**
   * Sanitizes and validates query length.
   * Returns empty string if query is empty/absent.
   * Throws BadRequestError if non-empty query is shorter than MIN_SEARCH_QUERY_LENGTH.
   */
  public validateQuery(q: string | undefined): string {
    const rawQuery = (q || '').trim();
    if (!rawQuery) {
      return '';
    }
    if (rawQuery.length < MIN_SEARCH_QUERY_LENGTH) {
      throw new BadRequestError(`Search query must be at least ${MIN_SEARCH_QUERY_LENGTH} characters long`);
    }
    return rawQuery;
  }

  /**
   * Global multi-entity search with RBAC enforcement per entity type
   */
  public async searchAll(
    tenantId: string,
    q: string,
    caller?: SearchCallerContext
  ): Promise<GlobalSearchResponse> {
    const rawQuery = this.validateQuery(q);
    if (!rawQuery) {
      return {
        query: '',
        results: { assets: [], licenses: [], vendors: [], tags: [] },
        total: 0,
      };
    }

    const likePattern = `%${escapeLikePattern(rawQuery)}%`;

    const isSuperAdmin = caller?.isSuperAdmin || false;
    const role = caller?.role;

    // RBAC: Check read permissions per entity type
    const canReadAssets = isSuperAdmin || (role ? hasPermission(role, 'assets:read') : true);
    const canReadLicenses = isSuperAdmin || (role ? hasPermission(role, 'licenses:read') : true);
    const canReadVendors = isSuperAdmin || (role ? hasPermission(role, 'vendors:read') : true);
    const canReadTags = isSuperAdmin || (role ? hasPermission(role, 'tags:read') : true);

    // Masking rules matching license.service / license.controller:
    // Only TENANT_ADMIN, ASSET_MANAGER, and SUPER_ADMIN can view unmasked keys or search by key
    const canViewUnmaskedKeys =
      isSuperAdmin || role === 'TENANT_ADMIN' || role === 'ASSET_MANAGER';

    try {
      const { assets, licenses, vendors, tags } = await prisma.$transaction(async (tx: any) => {
        const isSuperAdminStr = isSuperAdmin ? 'true' : 'false';
        const userId = caller?.userId || '';

        await tx.$executeRaw(
          Prisma.sql`SELECT 
            set_config('app.current_tenant_id', ${tenantId}, true),
            set_config('app.current_user_id', ${userId}, true),
            set_config('app.is_super_admin', ${isSuperAdminStr}, true);`
        );

        // 1. Search Assets (only if caller has assets:read)
        let mappedAssets: SearchResultItem[] = [];
        if (canReadAssets) {
          const assetRows: any = await tx.$queryRaw(Prisma.sql`
            SELECT 
              id, asset_code, name, asset_type, status, description
            FROM assets
            WHERE tenant_id = ${tenantId}::uuid
              AND deleted_at IS NULL
              AND (name ILIKE ${likePattern} OR asset_code ILIKE ${likePattern} OR description ILIKE ${likePattern})
            ORDER BY 
              CASE WHEN name ILIKE ${likePattern} THEN 1 ELSE 2 END,
              name ASC
            LIMIT 8;
          `);

          mappedAssets = assetRows.map((a: any) => ({
            id: a.id,
            type: 'asset',
            title: a.name,
            subtitle: `${a.asset_code} • ${a.asset_type}`,
            url: `/assets/${a.id}`,
            status: a.status,
          }));
        }

        // 2. Search Licenses (only if caller has licenses:read)
        let mappedLicenses: SearchResultItem[] = [];
        if (canReadLicenses) {
          // Privacy protection: Do not match against license_key unless caller can view unmasked keys
          const licenseFilter = canViewUnmaskedKeys
            ? Prisma.sql`(l.name ILIKE ${likePattern} OR l.license_key ILIKE ${likePattern} OR v.name ILIKE ${likePattern})`
            : Prisma.sql`(l.name ILIKE ${likePattern} OR v.name ILIKE ${likePattern})`;

          const licenseRows: any = await tx.$queryRaw(Prisma.sql`
            SELECT 
              l.id, l.name, l.license_key, l.status, l.total_seats, v.name AS vendor_name
            FROM licenses l
            JOIN vendors v ON v.id = l.vendor_id
            WHERE l.tenant_id = ${tenantId}::uuid
              AND l.deleted_at IS NULL
              AND ${licenseFilter}
            ORDER BY 
              CASE WHEN l.name ILIKE ${likePattern} THEN 1 ELSE 2 END,
              l.name ASC
            LIMIT 8;
          `);

          mappedLicenses = licenseRows.map((l: any) => {
            const displayKey = l.license_key
              ? canViewUnmaskedKeys
                ? l.license_key
                : `••••••••-${l.license_key.slice(-4)}`
              : '';
            return {
              id: l.id,
              type: 'license',
              title: l.name,
              subtitle: `${l.vendor_name} • ${l.total_seats} seats • ${displayKey}`,
              url: `/licenses/${l.id}`,
              status: l.status,
            };
          });
        }

        // 3. Search Vendors (only if caller has vendors:read)
        let mappedVendors: SearchResultItem[] = [];
        if (canReadVendors) {
          const vendorRows: any = await tx.$queryRaw(Prisma.sql`
            SELECT 
              id, name, contact_email
            FROM vendors
            WHERE tenant_id = ${tenantId}::uuid
              AND (name ILIKE ${likePattern} OR contact_email ILIKE ${likePattern})
            ORDER BY 
              CASE WHEN name ILIKE ${likePattern} THEN 1 ELSE 2 END,
              name ASC
            LIMIT 8;
          `);

          mappedVendors = vendorRows.map((v: any) => ({
            id: v.id,
            type: 'vendor',
            title: v.name,
            subtitle: v.contact_email || 'Vendor Contact',
            url: `/vendors`,
          }));
        }

        // 4. Search Tags (only if caller has tags:read)
        let mappedTags: SearchResultItem[] = [];
        if (canReadTags) {
          const tagRows: any = await tx.$queryRaw(Prisma.sql`
            SELECT 
              id, name, color
            FROM tags
            WHERE tenant_id = ${tenantId}::uuid
              AND name ILIKE ${likePattern}
            ORDER BY name ASC
            LIMIT 8;
          `);

          mappedTags = tagRows.map((t: any) => ({
            id: t.id,
            type: 'tag',
            title: `#${t.name}`,
            subtitle: `Tag Label`,
            url: `/assets?q=${encodeURIComponent(t.name)}`,
            meta: { color: t.color },
          }));
        }

        return {
          assets: mappedAssets,
          licenses: mappedLicenses,
          vendors: mappedVendors,
          tags: mappedTags,
        };
      });

      const total = assets.length + licenses.length + vendors.length + tags.length;

      return {
        query: rawQuery,
        results: { assets, licenses, vendors, tags },
        total,
      };
    } catch (err: any) {
      if (err instanceof BadRequestError) {
        throw err;
      }
      logger.error({ err, q: rawQuery, tenantId }, 'Global search error');
      return {
        query: rawQuery,
        results: { assets: [], licenses: [], vendors: [], tags: [] },
        total: 0,
      };
    }
  }

  /**
   * Search Assets specifically
   */
  public async searchAssets(
    tenantId: string,
    q: string,
    caller?: SearchCallerContext
  ): Promise<SearchResultItem[]> {
    const rawQuery = this.validateQuery(q);
    if (!rawQuery) return [];

    const likePattern = `%${escapeLikePattern(rawQuery)}%`;
    const isSuperAdmin = caller?.isSuperAdmin ? 'true' : 'false';
    const userId = caller?.userId || '';

    return await prisma.$transaction(async (tx: any) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT 
          set_config('app.current_tenant_id', ${tenantId}, true),
          set_config('app.current_user_id', ${userId}, true),
          set_config('app.is_super_admin', ${isSuperAdmin}, true);`
      );

      const rows: any = await tx.$queryRaw(Prisma.sql`
        SELECT id, asset_code, name, asset_type, status, description
        FROM assets
        WHERE tenant_id = ${tenantId}::uuid
          AND deleted_at IS NULL
          AND (name ILIKE ${likePattern} OR asset_code ILIKE ${likePattern} OR description ILIKE ${likePattern})
        ORDER BY CASE WHEN name ILIKE ${likePattern} THEN 1 ELSE 2 END, name ASC
        LIMIT 20;
      `);

      return rows.map((a: any) => ({
        id: a.id,
        type: 'asset',
        title: a.name,
        subtitle: `${a.asset_code} • ${a.asset_type}`,
        url: `/assets/${a.id}`,
        status: a.status,
      }));
    });
  }

  /**
   * Search Licenses specifically
   */
  public async searchLicenses(
    tenantId: string,
    q: string,
    caller?: SearchCallerContext
  ): Promise<SearchResultItem[]> {
    const rawQuery = this.validateQuery(q);
    if (!rawQuery) return [];

    const likePattern = `%${escapeLikePattern(rawQuery)}%`;
    const isSuperAdmin = caller?.isSuperAdmin || false;
    const isSuperAdminStr = isSuperAdmin ? 'true' : 'false';
    const userId = caller?.userId || '';
    const role = caller?.role;
    const canViewUnmaskedKeys =
      isSuperAdmin || role === 'TENANT_ADMIN' || role === 'ASSET_MANAGER';

    return await prisma.$transaction(async (tx: any) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT 
          set_config('app.current_tenant_id', ${tenantId}, true),
          set_config('app.current_user_id', ${userId}, true),
          set_config('app.is_super_admin', ${isSuperAdminStr}, true);`
      );

      const licenseFilter = canViewUnmaskedKeys
        ? Prisma.sql`(l.name ILIKE ${likePattern} OR l.license_key ILIKE ${likePattern} OR v.name ILIKE ${likePattern})`
        : Prisma.sql`(l.name ILIKE ${likePattern} OR v.name ILIKE ${likePattern})`;

      const rows: any = await tx.$queryRaw(Prisma.sql`
        SELECT l.id, l.name, l.license_key, l.status, l.total_seats, v.name AS vendor_name
        FROM licenses l
        JOIN vendors v ON v.id = l.vendor_id
        WHERE l.tenant_id = ${tenantId}::uuid
          AND l.deleted_at IS NULL
          AND ${licenseFilter}
        ORDER BY CASE WHEN l.name ILIKE ${likePattern} THEN 1 ELSE 2 END, l.name ASC
        LIMIT 20;
      `);

      return rows.map((l: any) => {
        const displayKey = l.license_key
          ? canViewUnmaskedKeys
            ? l.license_key
            : `••••••••-${l.license_key.slice(-4)}`
          : '';
        return {
          id: l.id,
          type: 'license',
          title: l.name,
          subtitle: `${l.vendor_name} • ${l.total_seats} seats • ${displayKey}`,
          url: `/licenses/${l.id}`,
          status: l.status,
        };
      });
    });
  }

  /**
   * Search Vendors specifically
   */
  public async searchVendors(
    tenantId: string,
    q: string,
    caller?: SearchCallerContext
  ): Promise<SearchResultItem[]> {
    const rawQuery = this.validateQuery(q);
    if (!rawQuery) return [];

    const likePattern = `%${escapeLikePattern(rawQuery)}%`;
    const isSuperAdmin = caller?.isSuperAdmin ? 'true' : 'false';
    const userId = caller?.userId || '';

    return await prisma.$transaction(async (tx: any) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT 
          set_config('app.current_tenant_id', ${tenantId}, true),
          set_config('app.current_user_id', ${userId}, true),
          set_config('app.is_super_admin', ${isSuperAdmin}, true);`
      );

      const rows: any = await tx.$queryRaw(Prisma.sql`
        SELECT id, name, contact_email
        FROM vendors
        WHERE tenant_id = ${tenantId}::uuid
          AND (name ILIKE ${likePattern} OR contact_email ILIKE ${likePattern})
        ORDER BY CASE WHEN name ILIKE ${likePattern} THEN 1 ELSE 2 END, name ASC
        LIMIT 20;
      `);

      return rows.map((v: any) => ({
        id: v.id,
        type: 'vendor',
        title: v.name,
        subtitle: v.contact_email || 'Vendor Contact',
        url: `/vendors`,
      }));
    });
  }

  /**
   * Search Tags specifically
   */
  public async searchTags(
    tenantId: string,
    q: string,
    caller?: SearchCallerContext
  ): Promise<SearchResultItem[]> {
    const rawQuery = this.validateQuery(q);
    if (!rawQuery) return [];

    const likePattern = `%${escapeLikePattern(rawQuery)}%`;
    const isSuperAdmin = caller?.isSuperAdmin ? 'true' : 'false';
    const userId = caller?.userId || '';

    return await prisma.$transaction(async (tx: any) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT 
          set_config('app.current_tenant_id', ${tenantId}, true),
          set_config('app.current_user_id', ${userId}, true),
          set_config('app.is_super_admin', ${isSuperAdmin}, true);`
      );

      const rows: any = await tx.$queryRaw(Prisma.sql`
        SELECT id, name, color
        FROM tags
        WHERE tenant_id = ${tenantId}::uuid
          AND name ILIKE ${likePattern}
        ORDER BY name ASC
        LIMIT 20;
      `);

      return rows.map((t: any) => ({
        id: t.id,
        type: 'tag',
        title: `#${t.name}`,
        subtitle: `Tag Label`,
        url: `/assets?q=${encodeURIComponent(t.name)}`,
        meta: { color: t.color },
      }));
    });
  }
}

export const searchService = new SearchService();
