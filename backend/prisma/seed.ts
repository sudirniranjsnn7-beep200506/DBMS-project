// ==============================================================================
// AssetVault Production Seed Script
// Course: BCSE307L Database Systems (Fall 2026-27)
// Seeds: 4 Roles, 3 Plans, 5 License Types, 1 Super Admin, 3 Tenants, 18 Users,
//        12 Vendors, 3-level Category hierarchies, Tags, 120 Assets with Versions,
//        30 Licenses with varied expiration horizons, Asset-License mappings,
//        and Seat Allocations invoked via `sp_allocate_license_seat`.
// ==============================================================================

import { PrismaClient, AssetType, AssetStatus, LicenseStatus, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const seedDatabaseUrl =
  process.env.MIGRATE_DATABASE_URL || process.env.DIRECT_URL || process.env.DATABASE_URL;
const prisma = new PrismaClient({
  datasources: seedDatabaseUrl ? { db: { url: seedDatabaseUrl } } : undefined,
});

async function main() {
  const isProduction = process.env.NODE_ENV === 'production';
  const superAdminEmail =
    process.env.SUPER_ADMIN_EMAIL?.trim() || (isProduction ? '' : 'superadmin@assetvault.io');
  const superAdminPassword =
    process.env.SUPER_ADMIN_PASSWORD || (isProduction ? '' : 'Password123!');
  const superAdminName = process.env.SUPER_ADMIN_NAME || 'Global Super Administrator';

  if (isProduction && (!superAdminEmail || !superAdminPassword)) {
    throw new Error(
      'SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be configured before production seeding.'
    );
  }

  console.log('🌱 Starting comprehensive AssetVault database seed...');

  // ----------------------------------------------------------------------------
  // 1. ROLES LOOKUP
  // ----------------------------------------------------------------------------
  console.log('  -> Seeding roles...');
  const roleDefs = [
    { name: 'SUPER_ADMIN', description: 'Global system platform administrator' },
    { name: 'TENANT_ADMIN', description: 'Tenant organization owner with admin privileges' },
    { name: 'ASSET_MANAGER', description: 'Asset custodian and license allocator' },
    { name: 'MEMBER', description: 'Standard organization member with read & checkout rights' },
  ];

  const rolesMap = new Map<string, number>();
  for (const r of roleDefs) {
    const role = await prisma.role.upsert({
      where: { name: r.name },
      update: { description: r.description },
      create: r,
    });
    rolesMap.set(role.name, role.id);
  }

  // ----------------------------------------------------------------------------
  // 2. PLANS LOOKUP
  // ----------------------------------------------------------------------------
  console.log('  -> Seeding subscription plans...');
  const planDefs = [
    { name: 'Free Trial', maxUsers: 10, maxAssets: 100, monthlyPrice: 0.0, isActive: true },
    { name: 'Pro', maxUsers: 50, maxAssets: 5000, monthlyPrice: 49.0, isActive: true },
    { name: 'Enterprise', maxUsers: 500, maxAssets: 50000, monthlyPrice: 199.0, isActive: true },
  ];

  const plansMap = new Map<string, number>();
  for (const p of planDefs) {
    const plan = await prisma.plan.upsert({
      where: { name: p.name },
      update: {
        maxUsers: p.maxUsers,
        maxAssets: p.maxAssets,
        monthlyPrice: p.monthlyPrice,
        isActive: p.isActive,
      },
      create: p,
    });
    plansMap.set(plan.name, plan.id);
  }

  // ----------------------------------------------------------------------------
  // 3. LICENSE TYPES LOOKUP
  // ----------------------------------------------------------------------------
  console.log('  -> Seeding license types...');
  const ltDefs = [
    { name: 'PERPETUAL', isSeatBased: false, isExpirable: false, description: 'Perpetual commercial rights' },
    { name: 'SUBSCRIPTION', isSeatBased: false, isExpirable: true, description: 'Periodic renewable subscription' },
    { name: 'SEAT_BASED', isSeatBased: true, isExpirable: true, description: 'Fixed allocated seat capacity' },
    { name: 'USAGE_BASED', isSeatBased: false, isExpirable: true, description: 'Metered usage contract' },
    { name: 'OPEN_SOURCE', isSeatBased: false, isExpirable: false, description: 'Permissive open source license' },
  ];

  const licenseTypesMap = new Map<string, number>();
  for (const lt of ltDefs) {
    const licenseType = await prisma.licenseType.upsert({
      where: { name: lt.name },
      update: {
        isSeatBased: lt.isSeatBased,
        isExpirable: lt.isExpirable,
        description: lt.description,
      },
      create: lt,
    });
    licenseTypesMap.set(licenseType.name, licenseType.id);
  }

  // Hash the configured password for first-time administrator creation.
  const superAdminHash = await bcrypt.hash(superAdminPassword, 10);

  // Common password hash for test accounts
  const passwordHash = await bcrypt.hash('Password123!', 10);

  // ----------------------------------------------------------------------------
  // 4. SUPER ADMIN USER (tenant_id = null)
  // ----------------------------------------------------------------------------
  console.log('  -> Seeding platform super administrator...');
  const superAdmin = await prisma.user.upsert({
    where: { email: superAdminEmail },
    // Do not reset the password on every container restart. The configured
    // password is applied only when the administrator is created for the first time.
    update: {
      fullName: superAdminName,
      isActive: true,
    },
    create: {
      email: superAdminEmail,
      fullName: superAdminName,
      passwordHash: superAdminHash,
      roleId: rolesMap.get('SUPER_ADMIN')!,
      tenantId: null,
      isActive: true,
    },
  });
  console.log(`    ✓ Super Admin configured: ${superAdmin.email}`);

  // Check if demo seed should run (production skips demo entities unless SEED_DEMO=true)
  const shouldSeedDemo = process.env.SEED_DEMO === 'true' || !isProduction;

  if (!shouldSeedDemo) {
    console.log('✨ Production mode detected without SEED_DEMO=true. Skipping demo tenants, vendors, assets, and licenses.');
    console.log('✅ Core reference tables (roles, plans, license types) and Super Admin seeded successfully.');
    return;
  }

  // ----------------------------------------------------------------------------
  // 5. TENANTS & USERS
  // ----------------------------------------------------------------------------
  console.log('  -> Seeding 3 tenants and 18 users...');
  const tenantConfigs = [
    {
      name: 'TechCorp Dynamics',
      slug: 'techcorp',
      planName: 'Enterprise',
      contactEmail: 'admin@techcorp.com',
      domain: 'techcorp.io',
    },
    {
      name: 'InnovateLabs Inc',
      slug: 'innovatelabs',
      planName: 'Pro',
      contactEmail: 'admin@innovatelabs.io',
      domain: 'innovatelabs.io',
    },
    {
      name: 'CreativeStudio Visuals',
      slug: 'creativestudio',
      planName: 'Free Trial',
      contactEmail: 'contact@creativestudio.design',
      domain: 'creativestudio.design',
    },
  ];

  const seededTenants: Array<{ id: string; name: string; slug: string; users: any[] }> = [];

  for (const tc of tenantConfigs) {
    const tenant = await prisma.tenant.upsert({
      where: { slug: tc.slug },
      update: {
        name: tc.name,
        planId: plansMap.get(tc.planName)!,
        contactEmail: tc.contactEmail,
        status: 'ACTIVE',
      },
      create: {
        name: tc.name,
        slug: tc.slug,
        planId: plansMap.get(tc.planName)!,
        contactEmail: tc.contactEmail,
        status: 'ACTIVE',
      },
    });

    // Seed 6 Users per Tenant (1 Admin, 2 Managers, 3 Members)
    const userSpecs = [
      { role: 'TENANT_ADMIN', suffix: 'admin', name: `${tc.name} Lead Admin` },
      { role: 'ASSET_MANAGER', suffix: 'mgr1', name: `${tc.name} Senior Asset Manager` },
      { role: 'ASSET_MANAGER', suffix: 'mgr2', name: `${tc.name} Content Specialist` },
      { role: 'MEMBER', suffix: 'dev1', name: `${tc.name} Engineer Alpha` },
      { role: 'MEMBER', suffix: 'dev2', name: `${tc.name} Designer Beta` },
      { role: 'MEMBER', suffix: 'dev3', name: `${tc.name} Analyst Gamma` },
    ];

    const tenantUsers = [];
    for (const spec of userSpecs) {
      const email = `${tc.slug}.${spec.suffix}@${tc.domain}`;
      const user = await prisma.user.upsert({
        where: { email },
        update: {
          fullName: spec.name,
          passwordHash,
          isActive: true,
          roleId: rolesMap.get(spec.role)!,
        },
        create: {
          tenantId: tenant.id,
          email,
          fullName: spec.name,
          passwordHash,
          roleId: rolesMap.get(spec.role)!,
          isActive: true,
        },
      });
      tenantUsers.push(user);
    }

    seededTenants.push({ id: tenant.id, name: tenant.name, slug: tenant.slug, users: tenantUsers });
  }

  // ----------------------------------------------------------------------------
  // 6. VENDORS (4 per Tenant = 12 total)
  // ----------------------------------------------------------------------------
  console.log('  -> Seeding 12 vendors...');
  const vendorTemplates = [
    { name: 'Adobe Creative Systems', email: 'licensing@adobe.com', website: 'https://adobe.com' },
    { name: 'Microsoft Enterprise', email: 'azure-licensing@microsoft.com', website: 'https://microsoft.com' },
    { name: 'Figma Cloud Inc', email: 'sales@figma.com', website: 'https://figma.com' },
    { name: 'JetBrains DevTools', email: 'sales@jetbrains.com', website: 'https://jetbrains.com' },
  ];

  const tenantVendors = new Map<string, any[]>();
  for (const tenant of seededTenants) {
    const vendors = [];
    for (const vt of vendorTemplates) {
      const vendorName = `${vt.name} (${tenant.slug})`;
      let vendor = await prisma.vendor.findFirst({
        where: { tenantId: tenant.id, name: vendorName },
      });
      if (!vendor) {
        vendor = await prisma.vendor.create({
          data: {
            tenantId: tenant.id,
            name: vendorName,
            contactEmail: vt.email,
            website: vt.website,
            supportPhone: '+1-800-555-0199',
          },
        });
      }
      vendors.push(vendor);
    }
    tenantVendors.set(tenant.id, vendors);
  }

  // ----------------------------------------------------------------------------
  // 7. 3-LEVEL CATEGORY HIERARCHY PER TENANT
  // ----------------------------------------------------------------------------
  console.log('  -> Seeding 3-level category trees per tenant...');
  const tenantCategories = new Map<string, any[]>();

  for (const tenant of seededTenants) {
    const leafCategories = [];

    // Level 1 Root
    const roots = ['Digital Media & Design', 'Engineering Resources', 'Research & Datasets'];
    for (const rName of roots) {
      let rootCat = await prisma.category.findFirst({
        where: { tenantId: tenant.id, name: rName },
      });
      if (!rootCat) {
        rootCat = await prisma.category.create({
          data: { tenantId: tenant.id, name: rName, description: `Root category for ${rName}` },
        });
      }

      // Level 2 Branch
      const branches = [`${rName} - 2D Production`, `${rName} - Archived Assets`];
      for (const bName of branches) {
        let branchCat = await prisma.category.findFirst({
          where: { tenantId: tenant.id, name: bName },
        });
        if (!branchCat) {
          branchCat = await prisma.category.create({
            data: {
              tenantId: tenant.id,
              name: bName,
              parentId: rootCat.id,
              description: `Intermediate branch: ${bName}`,
            },
          });
        }

        // Level 3 Leaves
        const leaves = [`${bName} - High Res Vectors`, `${bName} - Published Releases`];
        for (const lName of leaves) {
          let leafCat = await prisma.category.findFirst({
            where: { tenantId: tenant.id, name: lName },
          });
          if (!leafCat) {
            leafCat = await prisma.category.create({
              data: {
                tenantId: tenant.id,
                name: lName,
                parentId: branchCat.id,
                description: `Operational classification: ${lName}`,
              },
            });
          }
          leafCategories.push(leafCat);
        }
      }
    }
    tenantCategories.set(tenant.id, leafCategories);
  }

  // ----------------------------------------------------------------------------
  // 8. METADATA TAGS PER TENANT
  // ----------------------------------------------------------------------------
  console.log('  -> Seeding metadata tags...');
  const tagList = [
    { name: 'vector', color: '#6366f1' },
    { name: 'official', color: '#10b981' },
    { name: 'confidential', color: '#ef4444' },
    { name: 'high-res', color: '#f59e0b' },
    { name: 'v2026', color: '#8b5cf6' },
  ];

  const tenantTags = new Map<string, any[]>();
  for (const tenant of seededTenants) {
    const tags = [];
    for (const tDef of tagList) {
      let tag = await prisma.tag.findFirst({
        where: { tenantId: tenant.id, name: tDef.name },
      });
      if (!tag) {
        tag = await prisma.tag.create({
          data: { tenantId: tenant.id, name: tDef.name, color: tDef.color },
        });
      }
      tags.push(tag);
    }
    tenantTags.set(tenant.id, tags);
  }

  // ----------------------------------------------------------------------------
  // 9. 120 ASSETS WITH VERSIONS (40 per tenant)
  // ----------------------------------------------------------------------------
  console.log('  -> Seeding 120 digital assets with versions and tags (40 per tenant)...');
  const assetTypes: AssetType[] = [
    AssetType.IMAGE,
    AssetType.DOCUMENT,
    AssetType.FONT,
    AssetType.SOFTWARE,
    AssetType.DATASET,
    AssetType.VIDEO,
    AssetType.AUDIO,
  ];

  const tenantAssets = new Map<string, any[]>();

  for (const tenant of seededTenants) {
    const categories = tenantCategories.get(tenant.id)!;
    const users = tenant.users;
    const tags = tenantTags.get(tenant.id)!;
    const assets = [];

    for (let i = 1; i <= 40; i++) {
      const assetCode = `AST-${tenant.slug.toUpperCase()}-${String(i).padStart(4, '0')}`;
      const type = assetTypes[(i - 1) % assetTypes.length]!;
      const owner = users[(i - 1) % users.length]!;
      const category = categories[(i - 1) % categories.length]!;

      let asset = await prisma.asset.findFirst({
        where: { tenantId: tenant.id, assetCode },
      });

      if (!asset) {
        asset = await prisma.asset.create({
          data: {
            tenantId: tenant.id,
            ownerId: owner.id,
            categoryId: category.id,
            assetCode,
            name: `${tenant.name} ${type} Artifact #${i}`,
            description: `Enterprise digital production resource ${assetCode} tracked in AssetVault.`,
            assetType: type,
            status: i % 10 === 0 ? AssetStatus.DRAFT : AssetStatus.ACTIVE,
          },
        });

        // Version 1
        await prisma.assetVersion.create({
          data: {
            assetId: asset.id,
            versionNo: 1,
            fileUrl: `https://storage.assetvault.io/${tenant.slug}/${assetCode}-v1.dat`,
            fileSizeBytes: BigInt(1048576 * ((i % 20) + 1)), // 1 MB - 20 MB
            checksumSha256: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852${String(i).padStart(4, '0')}`,
            changeNotes: 'Initial master release version.',
            uploadedBy: owner.id,
          },
        });

        // Optional Version 2 for some assets
        if (i % 3 === 0) {
          await prisma.assetVersion.create({
            data: {
              assetId: asset.id,
              versionNo: 2,
              fileUrl: `https://storage.assetvault.io/${tenant.slug}/${assetCode}-v2.dat`,
              fileSizeBytes: BigInt(2097152 * ((i % 15) + 1)),
              checksumSha256: `a1b2c3d498fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852${String(i).padStart(4, '0')}`,
              changeNotes: 'Iterative revision with updated metadata.',
              uploadedBy: owner.id,
            },
          });
        }

        // Link Tags
        const tag = tags[i % tags.length];
        await prisma.assetTag.upsert({
          where: { assetId_tagId: { assetId: asset.id, tagId: tag.id } },
          update: {},
          create: { assetId: asset.id, tagId: tag.id },
        });
      }
      assets.push(asset);
    }
    tenantAssets.set(tenant.id, assets);
  }

  // ----------------------------------------------------------------------------
  // 10. 30 LICENSES WITH VARIED EXPIRATION HORIZONS (10 per tenant)
  // ----------------------------------------------------------------------------
  console.log('  -> Seeding 30 commercial licenses with diverse expiration horizons...');
  const tenantLicenses = new Map<string, any[]>();

  for (const tenant of seededTenants) {
    const vendors = tenantVendors.get(tenant.id)!;
    const licenses = [];

    // Expiration offsets relative to today:
    // 1-2: Expired (-15 days, -45 days)
    // 3-4: Critical (<= 7 days: +3 days, +6 days)
    // 5-6: Warning (<= 15 days: +11 days, +14 days)
    // 7-8: Notice (<= 30 days: +21 days, +28 days)
    // 9-10: Healthy Active (+180 days, +365 days)
    const expirationDays = [-15, -45, 3, 6, 11, 14, 21, 28, 180, 365];

    for (let j = 0; j < 10; j++) {
      const licKey = `LIC-${tenant.slug.toUpperCase()}-${String(j + 1).padStart(4, '0')}`;
      const vendor = vendors[j % vendors.length]!;
      const daysOffset = expirationDays[j]!;
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + daysOffset);

      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - 1);

      const isSeatBased = j % 2 === 0;
      const typeId = isSeatBased ? licenseTypesMap.get('SEAT_BASED')! : licenseTypesMap.get('SUBSCRIPTION')!;
      const totalSeats = isSeatBased ? 10 : 1;
      const status = daysOffset < 0 ? LicenseStatus.EXPIRED : LicenseStatus.ACTIVE;

      let license = await prisma.license.findFirst({
        where: { tenantId: tenant.id, licenseKey: licKey },
      });

      if (!license) {
        license = await prisma.license.create({
          data: {
            tenantId: tenant.id,
            vendorId: vendor.id,
            licenseTypeId: typeId,
            name: `${vendor.name} Agreement #${j + 1}`,
            licenseKey: licKey,
            totalSeats,
            startDate,
            endDate,
            cost: new Prisma.Decimal((j + 1) * 350.0),
            currency: 'USD',
            autoRenew: j % 2 === 1,
            status,
            terms: 'Standard Master Service Agreement terms with seat concurrency monitoring.',
          },
        });
      }
      licenses.push(license);
    }
    tenantLicenses.set(tenant.id, licenses);
  }

  // ----------------------------------------------------------------------------
  // 11. MAP LICENSES TO ASSETS (asset_licenses)
  // ----------------------------------------------------------------------------
  console.log('  -> Mapping licenses to assets (asset_licenses)...');
  for (const tenant of seededTenants) {
    const assets = tenantAssets.get(tenant.id)!;
    const licenses = tenantLicenses.get(tenant.id)!;
    const admin = tenant.users.find((u) => u.roleId === rolesMap.get('TENANT_ADMIN'))!;

    for (let k = 0; k < 25; k++) {
      const asset = assets[k];
      const license = licenses[k % licenses.length];

      await prisma.assetLicense.upsert({
        where: { assetId_licenseId: { assetId: asset.id, licenseId: license.id } },
        update: {},
        create: {
          assetId: asset.id,
          licenseId: license.id,
          assignedBy: admin.id,
          assignedAt: new Date(),
        },
      });
    }
  }

  // ----------------------------------------------------------------------------
  // 12. SEAT ALLOCATIONS VIA STORED PROCEDURE sp_allocate_license_seat
  // ----------------------------------------------------------------------------
  console.log('  -> Allocating seats via PL/pgSQL stored procedure sp_allocate_license_seat...');
  for (const tenant of seededTenants) {
    const licenses = tenantLicenses.get(tenant.id)!;
    const activeSeatLicenses = licenses.filter((l) => l.totalSeats > 0 && l.status === 'ACTIVE');
    const admin = tenant.users.find((u) => u.roleId === rolesMap.get('TENANT_ADMIN'))!;
    const members = tenant.users.filter((u) => u.id !== admin.id);

    if (activeSeatLicenses.length > 0) {
      const targetLicense = activeSeatLicenses[0];
      // Allocate seat to the first 3 members
      for (let m = 0; m < Math.min(3, members.length); m++) {
        const member = members[m];
        try {
          await prisma.$executeRaw(
            Prisma.sql`CALL sp_allocate_license_seat(${targetLicense.id}::uuid, ${member.id}::uuid, ${admin.id}::uuid)`
          );
          console.log(
            `    ✓ Seat allocated: User ${member.email} -> License ${targetLicense.name} via sp_allocate_license_seat`
          );
        } catch (err: any) {
          // If already allocated (idempotency), proceed
          if (err.message && err.message.includes('already holds an active seat')) {
            console.log(`    ℹ User ${member.email} already has an active seat on ${targetLicense.name}`);
          } else {
            console.warn(`    ⚠ Allocation notice: ${err.message}`);
          }
        }
      }
    }
  }

  // ----------------------------------------------------------------------------
  // 13. GENERATE EXPIRY NOTIFICATIONS VIA fn_generate_expiry_notifications
  // ----------------------------------------------------------------------------
  console.log('  -> Triggering fn_generate_expiry_notifications routine for all tenants...');
  for (const tenant of seededTenants) {
    const result: any[] = await prisma.$queryRaw(
      Prisma.sql`SELECT fn_generate_expiry_notifications(${tenant.id}::uuid, 30) AS notif_count`
    );
    console.log(`    ✓ Generated ${result[0]?.notif_count ?? 0} expiry notification alerts for ${tenant.name}`);
  }

  // ----------------------------------------------------------------------------
  // 14. REFRESH MATERIALIZED VIEW
  // ----------------------------------------------------------------------------
  console.log('  -> Refreshing materialized view mv_monthly_access_stats...');
  await prisma.$executeRaw(Prisma.sql`SELECT fn_refresh_monthly_access_stats()`);

  console.log('🎉 Comprehensive AssetVault seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
