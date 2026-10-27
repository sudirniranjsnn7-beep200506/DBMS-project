// ==============================================================================
// AssetVault: Tenant Data Archive Export Service
// Course: BCSE307L Database Systems (Fall 2026-27)
// Exports comprehensive JSON archive of tenant assets, licenses, vendors & taxonomies
// ==============================================================================

import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { NotFoundError } from '../errors/AppError';

export class TenantExportService {
  public async exportTenantData(tenantId: string) {
    return prisma.$transaction(async (tx: any) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT 
          set_config('app.current_tenant_id', ${tenantId}, true),
          set_config('app.is_super_admin', 'false', true);`
      );

      // 1. Fetch Tenant details
      const tenant = await tx.tenant.findUnique({
        where: { id: tenantId },
        include: {
          plan: true,
        },
      });

      if (!tenant) {
        throw new NotFoundError(`Tenant ${tenantId} not found`);
      }

      // 2. Fetch Users (Exclude password hashes and tokens)
      const users = await tx.user.findMany({
        where: { tenantId },
        select: {
          id: true,
          email: true,
          fullName: true,
          isActive: true,
          role: {
            select: { name: true, description: true },
          },
          createdAt: true,
          lastLoginAt: true,
        },
      });

      // 3. Fetch Vendors
      const vendors = await tx.vendor.findMany({
        where: { tenantId },
        include: {
          licenses: {
            select: { id: true, name: true, status: true },
          },
        },
      });

      // 4. Fetch Categories & Tags
      const categories = await tx.category.findMany({
        where: { tenantId },
        orderBy: { name: 'asc' },
      });

      const tags = await tx.tag.findMany({
        where: { tenantId },
      });

      // 5. Fetch Assets with Versions and Tag links
      const assets = await tx.asset.findMany({
        where: { tenantId, deletedAt: null },
        include: {
          versions: {
            select: {
              id: true,
              versionNo: true,
              fileUrl: true,
              fileSizeBytes: true,
              checksumSha256: true,
              changeNotes: true,
              createdAt: true,
            },
          },
          assetTags: {
            include: {
              tag: true,
            },
          },
          assetLicenses: {
            select: {
              licenseId: true,
              assignedAt: true,
            },
          },
        },
      });

      // Format BigInt fileSizeBytes safely for JSON serialization
      const serializedAssets = assets.map((a: any) => ({
        ...a,
        versions: a.versions.map((v: any) => ({
          ...v,
          fileSizeBytes: v.fileSizeBytes ? v.fileSizeBytes.toString() : '0',
        })),
        tags: a.assetTags.map((at: any) => at.tag.name),
      }));

      // 6. Fetch Licenses with Allocations and Renewals
      const licenses = await tx.license.findMany({
        where: { tenantId, deletedAt: null },
        include: {
          licenseType: true,
          vendor: { select: { id: true, name: true } },
          allocations: {
            select: {
              id: true,
              userId: true,
              allocatedAt: true,
              releasedAt: true,
              status: true,
            },
          },
          renewals: {
            select: {
              id: true,
              oldEndDate: true,
              newEndDate: true,
              cost: true,
              notes: true,
              renewedAt: true,
            },
          },
        },
      });

      // Mask license keys to protect sensitive credentials in export archive (not a key-reveal action)
      const sanitizedLicenses = licenses.map((lic: any) => ({
        ...lic,
        licenseKey: lic.licenseKey ? `••••••••-${lic.licenseKey.slice(-4)}` : null,
      }));

      // 7. Fetch License Allocations
      const allocations = await tx.licenseAllocation.findMany({
        where: { license: { tenantId } },
        select: {
          id: true,
          licenseId: true,
          userId: true,
          allocatedAt: true,
          releasedAt: true,
          status: true,
        },
      });

      return {
        metadata: {
          system: 'AssetVault Enterprise SaaS',
          version: '1.0.0',
          exportedAt: new Date().toISOString(),
          tenantId: tenant.id,
          tenantName: tenant.name,
          slug: tenant.slug,
          subscriptionPlan: tenant.plan.name,
          recordCounts: {
            users: users.length,
            vendors: vendors.length,
            categories: categories.length,
            tags: tags.length,
            assets: serializedAssets.length,
            licenses: licenses.length,
            allocations: allocations.length,
          },
        },
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          status: tenant.status,
          contactEmail: tenant.contactEmail,
          createdAt: tenant.createdAt,
        },
        users,
        vendors,
        categories,
        tags,
        assets: serializedAssets,
        licenses: sanitizedLicenses,
        allocations,
      };
    });
  }
}

export const tenantExportService = new TenantExportService();
