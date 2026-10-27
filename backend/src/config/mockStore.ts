// ==============================================================================
// AssetVault - In-Memory Database Mock Store
// Automatically used when PostgreSQL database is unreachable
// Ensures zero-downtime, fully interactive local applet operation
// ==============================================================================

const BCRYPT_PASSWORD_HASH = '$2a$10$Wdkk2P5XbxNUKMged8lf.ec4X3KILgM4XYxy8hBQ1.8jeYMuvlBIi'; // Password123!

export interface MockStoreState {
  roles: any[];
  plans: any[];
  licenseTypes: any[];
  tenants: any[];
  users: any[];
  vendors: any[];
  categories: any[];
  tags: any[];
  assets: any[];
  assetVersions: any[];
  licenses: any[];
  allocations: any[];
  notifications: any[];
  auditLogs: any[];
  refreshTokens: any[];
  assetTags: any[];
}

export function createInitialState(): MockStoreState {
  const roles = [
    { id: 1, name: 'SUPER_ADMIN', description: 'Global system platform administrator' },
    { id: 2, name: 'TENANT_ADMIN', description: 'Tenant organization owner with admin privileges' },
    { id: 3, name: 'ASSET_MANAGER', description: 'Asset custodian and license allocator' },
    { id: 4, name: 'MEMBER', description: 'Standard organization member with read & checkout rights' },
  ];

  const plans = [
    { id: 1, name: 'Free Trial', maxUsers: 10, maxAssets: 100, monthlyPrice: 0.0, isActive: true },
    { id: 2, name: 'Pro', maxUsers: 50, maxAssets: 5000, monthlyPrice: 49.0, isActive: true },
    { id: 3, name: 'Enterprise', maxUsers: 500, maxAssets: 50000, monthlyPrice: 199.0, isActive: true },
  ];

  const licenseTypes = [
    { id: 1, name: 'PERPETUAL', description: 'One-time purchase with indefinite usage rights', isSeatBased: false, isExpirable: false },
    { id: 2, name: 'SUBSCRIPTION', description: 'Recurring time-bound SaaS or enterprise subscription', isSeatBased: false, isExpirable: true },
    { id: 3, name: 'SEAT_BASED', description: 'Named-user or floating seat allocation contract', isSeatBased: true, isExpirable: true },
    { id: 4, name: 'USAGE_BASED', description: 'Metered consumption or API-quota license', isSeatBased: false, isExpirable: true },
    { id: 5, name: 'OPEN_SOURCE', description: 'Permissive or copyleft open-source software license', isSeatBased: false, isExpirable: false },
  ];

  const tenants = [
    {
      id: 'tenant-acme-corp',
      name: 'Acme Corporation',
      slug: 'acme',
      status: 'ACTIVE',
      planId: 2,
      createdAt: new Date('2026-01-15T00:00:00Z'),
      updatedAt: new Date('2026-01-15T00:00:00Z'),
    },
    {
      id: 'tenant-stark-ind',
      name: 'Stark Industries',
      slug: 'stark',
      status: 'ACTIVE',
      planId: 3,
      createdAt: new Date('2026-02-01T00:00:00Z'),
      updatedAt: new Date('2026-02-01T00:00:00Z'),
    },
  ];

  const users = [
    {
      id: 'user-super-admin',
      email: 'superadmin@assetvault.io',
      fullName: 'Global Super Administrator',
      roleId: 1,
      tenantId: null,
      passwordHash: BCRYPT_PASSWORD_HASH,
      isActive: true,
      department: 'Executive',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    },
    {
      id: 'user-tenant-admin',
      email: 'admin@acme.com',
      fullName: 'Acme Administrator',
      roleId: 2,
      tenantId: 'tenant-acme-corp',
      passwordHash: BCRYPT_PASSWORD_HASH,
      isActive: true,
      department: 'IT Operations',
      createdAt: new Date('2026-01-15T00:00:00Z'),
      updatedAt: new Date('2026-01-15T00:00:00Z'),
    },
    {
      id: 'user-asset-manager',
      email: 'manager@acme.com',
      fullName: 'Acme Asset Manager',
      roleId: 3,
      tenantId: 'tenant-acme-corp',
      passwordHash: BCRYPT_PASSWORD_HASH,
      isActive: true,
      department: 'Procurement',
      createdAt: new Date('2026-01-20T00:00:00Z'),
      updatedAt: new Date('2026-01-20T00:00:00Z'),
    },
    {
      id: 'user-member',
      email: 'member@acme.com',
      fullName: 'Acme Team Member',
      roleId: 4,
      tenantId: 'tenant-acme-corp',
      passwordHash: BCRYPT_PASSWORD_HASH,
      isActive: true,
      department: 'Engineering',
      createdAt: new Date('2026-02-01T00:00:00Z'),
      updatedAt: new Date('2026-02-01T00:00:00Z'),
    },
  ];

  const vendors = [
    {
      id: 'vendor-1',
      tenantId: 'tenant-acme-corp',
      name: 'Adobe Systems Inc.',
      contactEmail: 'enterprise-licensing@adobe.com',
      websiteUrl: 'https://www.adobe.com',
      createdAt: new Date('2026-01-15T00:00:00Z'),
      updatedAt: new Date('2026-01-15T00:00:00Z'),
    },
    {
      id: 'vendor-2',
      tenantId: 'tenant-acme-corp',
      name: 'JetBrains s.r.o.',
      contactEmail: 'sales@jetbrains.com',
      websiteUrl: 'https://www.jetbrains.com',
      createdAt: new Date('2026-01-15T00:00:00Z'),
      updatedAt: new Date('2026-01-15T00:00:00Z'),
    },
    {
      id: 'vendor-3',
      tenantId: 'tenant-acme-corp',
      name: 'Monotype Imaging Inc.',
      contactEmail: 'licensing@monotype.com',
      websiteUrl: 'https://www.monotype.com',
      createdAt: new Date('2026-01-15T00:00:00Z'),
      updatedAt: new Date('2026-01-15T00:00:00Z'),
    },
    {
      id: 'vendor-4',
      tenantId: 'tenant-acme-corp',
      name: 'Figma Inc.',
      contactEmail: 'sales@figma.com',
      websiteUrl: 'https://www.figma.com',
      createdAt: new Date('2026-01-15T00:00:00Z'),
      updatedAt: new Date('2026-01-15T00:00:00Z'),
    },
  ];

  const categories = [
    {
      id: 'cat-1',
      tenantId: 'tenant-acme-corp',
      name: 'Developer Tools',
      description: 'Integrated Development Environments and CLI utilities',
      parentId: null,
      createdAt: new Date('2026-01-15T00:00:00Z'),
      updatedAt: new Date('2026-01-15T00:00:00Z'),
    },
    {
      id: 'cat-2',
      tenantId: 'tenant-acme-corp',
      name: 'Creative & Design',
      description: 'UI/UX software, illustration and visual assets',
      parentId: null,
      createdAt: new Date('2026-01-15T00:00:00Z'),
      updatedAt: new Date('2026-01-15T00:00:00Z'),
    },
    {
      id: 'cat-3',
      tenantId: 'tenant-acme-corp',
      name: 'Typography & Fonts',
      description: 'Commercial font families and web font licenses',
      parentId: 'cat-2',
      createdAt: new Date('2026-01-15T00:00:00Z'),
      updatedAt: new Date('2026-01-15T00:00:00Z'),
    },
  ];

  const tags = [
    {
      id: 'tag-1',
      tenantId: 'tenant-acme-corp',
      name: 'Core Tooling',
      color: '#3B82F6',
      createdAt: new Date('2026-01-15T00:00:00Z'),
      updatedAt: new Date('2026-01-15T00:00:00Z'),
    },
    {
      id: 'tag-2',
      tenantId: 'tenant-acme-corp',
      name: 'Engineering',
      color: '#10B981',
      createdAt: new Date('2026-01-15T00:00:00Z'),
      updatedAt: new Date('2026-01-15T00:00:00Z'),
    },
    {
      id: 'tag-3',
      tenantId: 'tenant-acme-corp',
      name: 'Brand Guidelines',
      color: '#EC4899',
      createdAt: new Date('2026-01-15T00:00:00Z'),
      updatedAt: new Date('2026-01-15T00:00:00Z'),
    },
  ];

  const assets = [
    {
      id: 'asset-1',
      tenantId: 'tenant-acme-corp',
      name: 'IntelliJ IDEA Ultimate',
      type: 'SOFTWARE',
      status: 'ACTIVE',
      categoryId: 'cat-1',
      vendorId: 'vendor-2',
      description: 'Premier Java, Kotlin & Fullstack development environment for engineering teams.',
      createdAt: new Date('2026-01-16T00:00:00Z'),
      updatedAt: new Date('2026-01-16T00:00:00Z'),
    },
    {
      id: 'asset-2',
      tenantId: 'tenant-acme-corp',
      name: 'Helvetica Neue Pro Complete',
      type: 'FONT',
      status: 'ACTIVE',
      categoryId: 'cat-3',
      vendorId: 'vendor-3',
      description: 'Corporate brand typography family across OpenType and WOFF2 formats.',
      createdAt: new Date('2026-01-17T00:00:00Z'),
      updatedAt: new Date('2026-01-17T00:00:00Z'),
    },
    {
      id: 'asset-3',
      tenantId: 'tenant-acme-corp',
      name: 'Adobe Creative Cloud Suite',
      type: 'SOFTWARE',
      status: 'ACTIVE',
      categoryId: 'cat-2',
      vendorId: 'vendor-1',
      description: 'Full suite including Photoshop, Illustrator, Premiere Pro, and After Effects.',
      createdAt: new Date('2026-01-18T00:00:00Z'),
      updatedAt: new Date('2026-01-18T00:00:00Z'),
    },
    {
      id: 'asset-4',
      tenantId: 'tenant-acme-corp',
      name: 'Figma Enterprise Organization',
      type: 'SOFTWARE',
      status: 'ACTIVE',
      categoryId: 'cat-2',
      vendorId: 'vendor-4',
      description: 'Collaborative cloud interface design, prototyping and design system maintenance.',
      createdAt: new Date('2026-01-19T00:00:00Z'),
      updatedAt: new Date('2026-01-19T00:00:00Z'),
    },
  ];

  const assetVersions = [
    {
      id: 'ver-1',
      assetId: 'asset-1',
      versionNumber: '2026.1',
      storageUrl: 'https://download.jetbrains.com/idea/ideaIU-2026.1.tar.gz',
      fileSize: 1048576000,
      mimeType: 'application/gzip',
      checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      changelog: 'Initial 2026 release with JDK 25 support',
      createdAt: new Date('2026-01-16T00:00:00Z'),
    },
  ];

  const licenses = [
    {
      id: 'lic-1',
      tenantId: 'tenant-acme-corp',
      assetId: 'asset-1',
      vendorId: 'vendor-2',
      licenseKey: 'JB-INTEL-2026-ACME-99124',
      type: 'SEAT_BASED',
      status: 'ACTIVE',
      totalSeats: 35,
      allocatedSeats: 2,
      cost: 499.0,
      autoRenew: true,
      expiresAt: new Date(Date.now() + 180 * 24 * 3600 * 1000),
      createdAt: new Date('2026-01-16T00:00:00Z'),
      updatedAt: new Date('2026-01-16T00:00:00Z'),
    },
    {
      id: 'lic-2',
      tenantId: 'tenant-acme-corp',
      assetId: 'asset-2',
      vendorId: 'vendor-3',
      licenseKey: 'MONO-HN-CORP-44091',
      type: 'PERPETUAL',
      status: 'ACTIVE',
      totalSeats: 100,
      allocatedSeats: 1,
      cost: 1450.0,
      autoRenew: false,
      expiresAt: null,
      createdAt: new Date('2026-01-17T00:00:00Z'),
      updatedAt: new Date('2026-01-17T00:00:00Z'),
    },
    {
      id: 'lic-3',
      tenantId: 'tenant-acme-corp',
      assetId: 'asset-3',
      vendorId: 'vendor-1',
      licenseKey: 'ADBE-CC-ENT-2026-081',
      type: 'SUBSCRIPTION',
      status: 'ACTIVE',
      totalSeats: 20,
      allocatedSeats: 1,
      cost: 899.0,
      autoRenew: true,
      expiresAt: new Date(Date.now() + 45 * 24 * 3600 * 1000),
      createdAt: new Date('2026-01-18T00:00:00Z'),
      updatedAt: new Date('2026-01-18T00:00:00Z'),
    },
    {
      id: 'lic-4',
      tenantId: 'tenant-acme-corp',
      assetId: 'asset-4',
      vendorId: 'vendor-4',
      licenseKey: 'FIGMA-ENT-ORGLIC-309',
      type: 'SEAT_BASED',
      status: 'ACTIVE',
      totalSeats: 25,
      allocatedSeats: 2,
      cost: 750.0,
      autoRenew: true,
      expiresAt: new Date(Date.now() + 120 * 24 * 3600 * 1000),
      createdAt: new Date('2026-01-19T00:00:00Z'),
      updatedAt: new Date('2026-01-19T00:00:00Z'),
    },
  ];

  const allocations = [
    {
      id: 'alloc-1',
      tenantId: 'tenant-acme-corp',
      licenseId: 'lic-1',
      userId: 'user-tenant-admin',
      status: 'ACTIVE',
      allocatedAt: new Date('2026-01-20T00:00:00Z'),
      notes: 'Lead Infrastructure Engineer seat',
    },
    {
      id: 'alloc-2',
      tenantId: 'tenant-acme-corp',
      licenseId: 'lic-1',
      userId: 'user-member',
      status: 'ACTIVE',
      allocatedAt: new Date('2026-02-05T00:00:00Z'),
      notes: 'Fullstack Core Dev seat',
    },
    {
      id: 'alloc-3',
      tenantId: 'tenant-acme-corp',
      licenseId: 'lic-2',
      userId: 'user-asset-manager',
      status: 'ACTIVE',
      allocatedAt: new Date('2026-01-22T00:00:00Z'),
      notes: 'Design System & Typography Lead',
    },
    {
      id: 'alloc-4',
      tenantId: 'tenant-acme-corp',
      licenseId: 'lic-3',
      userId: 'user-asset-manager',
      status: 'ACTIVE',
      allocatedAt: new Date('2026-01-25T00:00:00Z'),
      notes: 'Creative Suite seat',
    },
  ];

  const notifications = [
    {
      id: 'notif-1',
      tenantId: 'tenant-acme-corp',
      userId: 'user-tenant-admin',
      type: 'SYSTEM',
      title: 'AssetVault Operational',
      message: 'Workspace is running with in-memory persistence and RLS guardrails active.',
      isRead: false,
      createdAt: new Date(),
    },
    {
      id: 'notif-2',
      tenantId: 'tenant-acme-corp',
      userId: 'user-tenant-admin',
      type: 'EXPIRY_60',
      title: 'Adobe CC License Renewal',
      message: 'License ADBE-CC-ENT-2026-081 renewal is due in 45 days.',
      isRead: false,
      createdAt: new Date(),
    },
  ];

  const auditLogs = [
    {
      id: 'audit-1',
      tenantId: 'tenant-acme-corp',
      userId: 'user-tenant-admin',
      action: 'INSERT',
      entityType: 'License',
      entityId: 'lic-1',
      details: { note: 'Provisioned initial JetBrains developer pack' },
      createdAt: new Date('2026-01-16T00:00:00Z'),
    },
  ];

  return {
    roles,
    plans,
    licenseTypes,
    tenants,
    users,
    vendors,
    categories,
    tags,
    assets,
    assetVersions,
    licenses,
    allocations,
    notifications,
    auditLogs,
    refreshTokens: [],
    assetTags: [],
  };
}

export class MockPrismaStore {
  public state: MockStoreState;
  private persistPath: string;

  constructor() {
    this.persistPath = require('path').resolve(process.cwd(), '.mock-store-state.json');
    this.state = this.loadState();
  }

  private loadState(): MockStoreState {
    const initial = createInitialState();
    try {
      const fs = require('fs');
      if (fs.existsSync(this.persistPath)) {
        const raw = fs.readFileSync(this.persistPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.users) && Array.isArray(parsed.tenants)) {
          return {
            ...initial,
            ...parsed,
            roles: initial.roles,
            plans: initial.plans,
            licenseTypes: initial.licenseTypes,
          };
        }
      }
    } catch {
      // Ignore read errors and fall back to initial state
    }
    return initial;
  }

  public saveState(): void {
    try {
      const fs = require('fs');
      fs.writeFileSync(this.persistPath, JSON.stringify(this.state, null, 2), 'utf-8');
    } catch {
      // Ignore write errors
    }
  }

  public normalizeWriteData(data: any): any {
    if (!data || typeof data !== 'object') return {};
    const normalized: any = { ...data };
    const relationKeys = ['tenant', 'role', 'plan', 'vendor', 'category', 'asset', 'license', 'licenseType', 'user', 'owner'];
    for (const rel of relationKeys) {
      if (normalized[rel] && typeof normalized[rel] === 'object') {
        if (normalized[rel].connect?.id !== undefined) {
          const fk = rel === 'owner' ? 'ownerId' : `${rel}Id`;
          normalized[fk] = normalized[rel].connect.id;
        } else if (normalized[rel].connect?.name !== undefined && rel === 'role') {
          const matchedRole = this.state.roles.find((r) => r.name === normalized[rel].connect.name);
          if (matchedRole) normalized.roleId = matchedRole.id;
        }
        delete normalized[rel];
      }
    }
    return normalized;
  }

  public getCollection(modelName: string): any[] {
    const key = modelName.toLowerCase();
    switch (key) {
      case 'role':
        return this.state.roles;
      case 'plan':
        return this.state.plans;
      case 'licensetype':
        return this.state.licenseTypes;
      case 'tenant':
        return this.state.tenants;
      case 'user':
        return this.state.users;
      case 'vendor':
        return this.state.vendors;
      case 'category':
        return this.state.categories;
      case 'tag':
        return this.state.tags;
      case 'asset':
        return this.state.assets;
      case 'assetversion':
        return this.state.assetVersions;
      case 'license':
        return this.state.licenses;
      case 'allocation':
      case 'licenseallocation':
        return this.state.allocations;
      case 'notification':
        return this.state.notifications;
      case 'auditlog':
        return this.state.auditLogs;
      case 'refreshtoken':
        return this.state.refreshTokens;
      default:
        if (!(this.state as any)[key]) {
          (this.state as any)[key] = [];
        }
        return (this.state as any)[key];
    }
  }

  public matches(item: any, where?: any): boolean {
    if (!where) return true;
    for (const [key, value] of Object.entries(where)) {
      if (value === undefined) continue;
      if (key === 'AND') {
        if (Array.isArray(value)) {
          if (!value.every((w) => this.matches(item, w))) return false;
        } else if (!this.matches(item, value)) return false;
      } else if (key === 'OR') {
        if (Array.isArray(value)) {
          if (!value.some((w) => this.matches(item, w))) return false;
        } else if (!this.matches(item, value)) return false;
      } else if (key === 'NOT') {
        if (this.matches(item, value)) return false;
      } else if (key === 'role' && value && typeof value === 'object' && 'name' in (value as any)) {
        const userRole = this.state.roles.find((r) => r.id === item.roleId);
        if (!userRole || userRole.name !== (value as any).name) return false;
      } else if (value && typeof value === 'object' && !(value instanceof Date)) {
        const valObj = value as any;
        if ('equals' in valObj) {
          if (item[key] !== valObj.equals) return false;
        } else if ('in' in valObj) {
          if (!Array.isArray(valObj.in) || !valObj.in.includes(item[key])) return false;
        } else if ('notIn' in valObj) {
          if (Array.isArray(valObj.notIn) && valObj.notIn.includes(item[key])) return false;
        } else if ('contains' in valObj) {
          const itemVal = String(item[key] || '').toLowerCase();
          const search = String(valObj.contains || '').toLowerCase();
          if (!itemVal.includes(search)) return false;
        } else if ('gte' in valObj) {
          const a = item[key] instanceof Date || typeof item[key] === 'string' ? new Date(item[key]).getTime() : item[key];
          const b = valObj.gte instanceof Date || typeof valObj.gte === 'string' ? new Date(valObj.gte).getTime() : valObj.gte;
          if (a < b) return false;
        } else if ('lte' in valObj) {
          const a = item[key] instanceof Date || typeof item[key] === 'string' ? new Date(item[key]).getTime() : item[key];
          const b = valObj.lte instanceof Date || typeof valObj.lte === 'string' ? new Date(valObj.lte).getTime() : valObj.lte;
          if (a > b) return false;
        } else if ('gt' in valObj) {
          const a = item[key] instanceof Date || typeof item[key] === 'string' ? new Date(item[key]).getTime() : item[key];
          const b = valObj.gt instanceof Date || typeof valObj.gt === 'string' ? new Date(valObj.gt).getTime() : valObj.gt;
          if (a <= b) return false;
        } else if ('lt' in valObj) {
          const a = item[key] instanceof Date || typeof item[key] === 'string' ? new Date(item[key]).getTime() : item[key];
          const b = valObj.lt instanceof Date || typeof valObj.lt === 'string' ? new Date(valObj.lt).getTime() : valObj.lt;
          if (a >= b) return false;
        } else if ('not' in valObj) {
          if (valObj.not === null) {
            if (item[key] === null || item[key] === undefined) return false;
          } else if (item[key] === valObj.not) {
            return false;
          }
        }
      } else {
        if (value === null) {
          if (item[key] !== null && item[key] !== undefined) return false;
        } else if (key === 'email' && typeof value === 'string') {
          if (String(item[key] || '').toLowerCase() !== value.toLowerCase()) return false;
        } else {
          if (item[key] !== value) return false;
        }
      }
    }
    return true;
  }

  public populateRelations(modelName: string, item: any, _includeOrSelect?: any): any {
    if (!item) return item;
    const cloned = { ...item };
    const lowerModel = modelName.toLowerCase();

    if (lowerModel === 'user') {
      cloned.role =
        this.state.roles.find((r) => r.id === item.roleId) ||
        (item.role && typeof item.role === 'object' && item.role.name ? item.role : null) ||
        this.state.roles.find((r) => r.name === 'TENANT_ADMIN') ||
        null;

      const tenant = this.state.tenants.find((t) => t.id === item.tenantId) || null;
      if (tenant) {
        cloned.tenant = {
          ...tenant,
          plan: this.state.plans.find((p) => p.id === tenant.planId) || this.state.plans[0] || null,
        };
      } else {
        cloned.tenant = null;
      }
    } else if (lowerModel === 'refreshtoken') {
      const rawUser = this.state.users.find((u) => u.id === item.userId) || null;
      cloned.user = rawUser ? this.populateRelations('user', rawUser) : null;
      cloned.revokedAt = item.revokedAt ? new Date(item.revokedAt) : null;
      cloned.expiresAt = item.expiresAt ? new Date(item.expiresAt) : new Date(Date.now() + 7 * 86400000);
      cloned.createdAt = item.createdAt ? new Date(item.createdAt) : new Date();
    } else if (lowerModel === 'tenant') {
      cloned.plan = this.state.plans.find((p) => p.id === item.planId) || this.state.plans[0] || null;
    } else if (lowerModel === 'asset') {
      cloned.vendor = this.state.vendors.find((v) => v.id === item.vendorId) || null;
      cloned.category = this.state.categories.find((c) => c.id === item.categoryId) || null;
      cloned.versions = this.state.assetVersions.filter((v) => v.assetId === item.id);
      cloned.licenses = this.state.licenses.filter((l) => l.assetId === item.id);
    } else if (lowerModel === 'license') {
      cloned.asset = this.state.assets.find((a) => a.id === item.assetId) || null;
      cloned.vendor = this.state.vendors.find((v) => v.id === item.vendorId) || null;
      cloned.licenseType =
        this.state.licenseTypes.find((lt) => lt.id === item.licenseTypeId) ||
        this.state.licenseTypes[2] ||
        null;
      cloned.allocations = this.state.allocations.filter((al) => al.licenseId === item.id);
    } else if (lowerModel === 'allocation' || lowerModel === 'licenseallocation') {
      const lic = this.state.licenses.find((l) => l.id === item.licenseId);
      if (lic) {
        cloned.license = {
          ...lic,
          name: lic.name || lic.licenseKey || 'Enterprise License',
          asset: this.state.assets.find((a) => a.id === lic.assetId) || null,
          vendor: this.state.vendors.find((v) => v.id === lic.vendorId) || null,
        };
      } else {
        cloned.license = null;
      }
      cloned.user = this.state.users.find((u) => u.id === item.userId) || null;
    }

    return cloned;
  }
}

export const mockStore = new MockPrismaStore();

export function createMockModelClient(modelName: string): any {
  return {
    async findUnique(args: any = {}) {
      const collection = mockStore.getCollection(modelName);
      const item = collection.find((i) => mockStore.matches(i, args.where));
      return item ? mockStore.populateRelations(modelName, item, args.include || args.select) : null;
    },

    async findFirst(args: any = {}) {
      const collection = mockStore.getCollection(modelName);
      const item = collection.find((i) => mockStore.matches(i, args.where));
      return item ? mockStore.populateRelations(modelName, item, args.include || args.select) : null;
    },

    async findFirstOrThrow(args: any = {}) {
      const res = await this.findFirst(args);
      if (!res) throw new Error(`${modelName} not found`);
      return res;
    },

    async findUniqueOrThrow(args: any = {}) {
      const res = await this.findUnique(args);
      if (!res) throw new Error(`${modelName} not found`);
      return res;
    },

    async findMany(args: any = {}) {
      const collection = mockStore.getCollection(modelName);
      let items = collection.filter((i) => mockStore.matches(i, args.where));

      if (args.orderBy) {
        const orderKey = Object.keys(args.orderBy)[0];
        if (orderKey) {
          const dir = args.orderBy[orderKey];
          items.sort((a, b) => {
            const va = a[orderKey];
            const vb = b[orderKey];
            if (va < vb) return dir === 'desc' ? 1 : -1;
            if (va > vb) return dir === 'desc' ? -1 : 1;
            return 0;
          });
        }
      }

      if (typeof args.skip === 'number') {
        items = items.slice(args.skip);
      }
      if (typeof args.take === 'number') {
        items = items.slice(0, args.take);
      }

      return items.map((i) => mockStore.populateRelations(modelName, i, args.include || args.select));
    },

    async count(args: any = {}) {
      const collection = mockStore.getCollection(modelName);
      return collection.filter((i) => mockStore.matches(i, args.where)).length;
    },

    async aggregate(args: any = {}) {
      const count = await this.count(args);
      return {
        _count: { _all: count, id: count },
        _sum: { cost: 3500 },
        _avg: { cost: 875 },
      };
    },

    async groupBy(_args: any = {}) {
      return [];
    },

    async create(args: any = {}) {
      const collection = mockStore.getCollection(modelName);
      const normalizedData = mockStore.normalizeWriteData(args.data);
      const newItem = {
        id: normalizedData?.id || require('crypto').randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...(modelName.toLowerCase() === 'refreshtoken' ? { revokedAt: null } : {}),
        ...normalizedData,
      };
      collection.push(newItem);
      mockStore.saveState();
      return mockStore.populateRelations(modelName, newItem, args.include || args.select);
    },

    async update(args: any = {}) {
      const collection = mockStore.getCollection(modelName);
      const idx = collection.findIndex((i) => mockStore.matches(i, args.where));
      if (idx === -1) {
        throw new Error(`${modelName} not found for update`);
      }
      const normalizedData = mockStore.normalizeWriteData(args.data);
      collection[idx] = {
        ...collection[idx],
        ...normalizedData,
        updatedAt: new Date(),
      };
      mockStore.saveState();
      return mockStore.populateRelations(modelName, collection[idx], args.include || args.select);
    },

    async upsert(args: any = {}) {
      const existing = await this.findFirst({ where: args.where });
      if (existing) {
        return this.update({ where: args.where, data: args.update, include: args.include, select: args.select });
      }
      return this.create({
        data: { ...(args.where || {}), ...(args.create || {}) },
        include: args.include,
        select: args.select,
      });
    },

    async delete(args: any = {}) {
      const collection = mockStore.getCollection(modelName);
      const idx = collection.findIndex((i) => mockStore.matches(i, args.where));
      if (idx === -1) {
        throw new Error(`${modelName} not found for deletion`);
      }
      const [removed] = collection.splice(idx, 1);
      mockStore.saveState();
      return removed;
    },

    async updateMany(args: any = {}) {
      const collection = mockStore.getCollection(modelName);
      const normalizedData = mockStore.normalizeWriteData(args.data);
      let count = 0;
      for (let i = 0; i < collection.length; i++) {
        if (mockStore.matches(collection[i], args.where)) {
          collection[i] = { ...collection[i], ...normalizedData, updatedAt: new Date() };
          count++;
        }
      }
      mockStore.saveState();
      return { count };
    },

    async deleteMany(args: any = {}) {
      const collection = mockStore.getCollection(modelName);
      let count = 0;
      for (let i = collection.length - 1; i >= 0; i--) {
        if (mockStore.matches(collection[i], args.where)) {
          collection.splice(i, 1);
          count++;
        }
      }
      mockStore.saveState();
      return { count };
    },
  };
}

export function createMockPrismaClient(): any {
  const handler: ProxyHandler<any> = {
    get(_target, prop: string) {
      if (prop === '$connect') return async () => {};
      if (prop === '$disconnect') return async () => {};
      if (prop === '$transaction') {
        return async (fnOrArray: any) => {
          if (typeof fnOrArray === 'function') {
            return fnOrArray(createMockPrismaClient());
          }
          if (Array.isArray(fnOrArray)) {
            return Promise.all(fnOrArray);
          }
          return fnOrArray;
        };
      }
      if (prop === '$queryRaw') {
        return async (queryObj: any) => {
          const sqlText =
            typeof queryObj === 'string'
              ? queryObj
              : Array.isArray(queryObj?.strings)
              ? queryObj.strings.join(' ')
              : String(queryObj || '');

          if (sqlText.includes('fn_tenant_dashboard_stats')) {
            const totalAssets = mockStore.state.assets.length;
            const totalLicenses = mockStore.state.licenses.length;
            const totalSeats = mockStore.state.licenses.reduce((s, l) => s + (l.totalSeats || 0), 0);
            const allocatedSeats = mockStore.state.licenses.reduce((s, l) => s + (l.allocatedSeats || 0), 0);
            const totalSpend = mockStore.state.licenses.reduce((s, l) => s + Number(l.cost || 0), 0);
            return [
              {
                fn_tenant_dashboard_stats: {
                  total_assets: totalAssets,
                  asset_count: totalAssets,
                  total_licenses: totalLicenses,
                  license_count: totalLicenses,
                  user_count: mockStore.state.users.length,
                  allocated_seats: allocatedSeats,
                  active_allocated_seats: allocatedSeats,
                  total_seats: totalSeats,
                  total_contracted_seats: totalSeats,
                  expiring_in_30_days: 1,
                  expiring_licenses_30d: 1,
                  unlicensed_assets_count: 0,
                  total_license_cost: totalSpend,
                  total_license_spend: totalSpend,
                },
              },
            ];
          }

          if (sqlText.includes('v_asset_catalog')) {
            if (sqlText.toLowerCase().includes('count(')) {
              return [{ total: mockStore.state.assets.length, count: mockStore.state.assets.length }];
            }
            if (sqlText.includes('UNLICENSED')) {
              return [];
            }
            return mockStore.state.assets.map((a, idx) => ({
              asset_id: a.id,
              tenant_id: a.tenantId,
              asset_code: `AST-${100 + idx}`,
              asset_name: a.name,
              description: a.description,
              asset_type: a.type,
              asset_status: a.status,
              category_name: 'Developer Tools',
              owner_name: 'Acme Administrator',
              owner_email: 'admin@acme.com',
              latest_version_no: 1,
              total_versions: 1,
              tags: ['Engineering', 'Production'],
              covering_licenses_count: 1,
              compliance_status: 'COMPLIANT',
              created_at: a.createdAt,
              updated_at: a.updatedAt,
            }));
          }

          if (sqlText.includes('sp_allocate_license_seat')) {
            const values = Array.isArray(queryObj?.values) ? queryObj.values : [];
            const [licenseId, userId, allocatedBy] = values;
            const lic = mockStore.state.licenses.find((l) => l.id === licenseId);
            if (!lic) {
              throw new Error('License not found');
            }
            const activeForLicense = mockStore.state.allocations.filter(
              (a) => a.licenseId === licenseId && a.status === 'ACTIVE'
            );
            const currentUsed = Math.max(Number(lic.allocatedSeats ?? lic.usedSeats ?? 0), activeForLicense.length);
            if (currentUsed >= Number(lic.totalSeats || 1)) {
              throw new Error('License seats exhausted');
            }
            const existingActive = activeForLicense.find((a) => a.userId === userId);
            if (existingActive) {
              throw new Error('User already holds an active seat for this license');
            }
            const newAlloc = {
              id: require('crypto').randomUUID(),
              tenantId: lic.tenantId || 'tenant-acme-corp',
              licenseId,
              userId,
              allocatedBy: allocatedBy || userId,
              status: 'ACTIVE',
              allocatedAt: new Date(),
              revokedAt: null,
              notes: 'Allocated via sp_allocate_license_seat',
            };
            mockStore.state.allocations.unshift(newAlloc);
            const updatedActiveCount = mockStore.state.allocations.filter(
              (a) => a.licenseId === licenseId && a.status === 'ACTIVE'
            ).length;
            lic.allocatedSeats = Math.max(currentUsed + 1, updatedActiveCount);
            lic.usedSeats = lic.allocatedSeats;
            mockStore.saveState();
            return [{ p_allocation_id: newAlloc.id }];
          }

          if (sqlText.includes('sp_release_license_seat')) {
            const values = Array.isArray(queryObj?.values) ? queryObj.values : [];
            const [allocationId, revokedBy, reason] = values;
            const alloc = mockStore.state.allocations.find((a) => a.id === allocationId);
            if (alloc && alloc.status === 'ACTIVE') {
              alloc.status = 'REVOKED';
              alloc.revokedAt = new Date();
              alloc.revokedBy = revokedBy || null;
              alloc.revokeReason = reason || 'Administrative seat release';
              const lic = mockStore.state.licenses.find((l) => l.id === alloc.licenseId);
              if (lic) {
                const remainingActive = mockStore.state.allocations.filter(
                  (a) => a.licenseId === lic.id && a.status === 'ACTIVE'
                ).length;
                lic.allocatedSeats = remainingActive;
                lic.usedSeats = remainingActive;
              }
              mockStore.saveState();
            }
            return [{ success: true }];
          }

          if (sqlText.includes('sp_renew_license')) {
            const values = Array.isArray(queryObj?.values) ? queryObj.values : [];
            const [licenseId, newEndDate, cost] = values;
            const lic = mockStore.state.licenses.find((l) => l.id === licenseId);
            if (lic) {
              lic.endDate = new Date(newEndDate);
              lic.expiresAt = new Date(newEndDate);
              if (cost !== undefined && cost !== null) {
                lic.cost = Number(cost);
              }
              lic.status = 'ACTIVE';
              mockStore.saveState();
            }
            return [{ p_renewal_id: require('crypto').randomUUID() }];
          }

          if (sqlText.includes('v_license_utilization')) {
            if (sqlText.toLowerCase().includes('count(')) {
              return [{ total: mockStore.state.licenses.length, count: mockStore.state.licenses.length }];
            }
            return mockStore.state.licenses.map((l) => {
              const vendor = mockStore.state.vendors.find((v) => v.id === l.vendorId);
              const licType = mockStore.state.licenseTypes.find((lt) => lt.id === l.licenseTypeId);
              const totalSeats = Number(l.totalSeats || 1);
              const activeAllocsForLic = mockStore.state.allocations.filter(
                (a) => a.licenseId === l.id && a.status === 'ACTIVE'
              ).length;
              const usedSeats = Math.max(Number(l.allocatedSeats ?? l.usedSeats ?? 0), activeAllocsForLic);
              const endDate = l.endDate ?? l.expiresAt ?? null;
              const daysToExpiry = endDate
                ? Math.max(0, Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
                : null;
              return {
                license_id: l.id,
                tenant_id: l.tenantId,
                vendor_id: l.vendorId,
                license_type_id: l.licenseTypeId || 3,
                license_name: l.name || l.licenseKey,
                license_key: l.licenseKey ? `••••••••-${String(l.licenseKey).slice(-4)}` : '••••••••-KEY',
                vendor_name: vendor?.name || 'Enterprise Vendor',
                license_type: licType?.name || l.type || 'SEAT_BASED',
                total_seats: totalSeats,
                used_seats: usedSeats,
                available_seats: Math.max(0, totalSeats - usedSeats),
                utilization_pct: Math.round((usedSeats / Math.max(1, totalSeats)) * 100),
                days_to_expiry: daysToExpiry,
                status: l.status || 'ACTIVE',
                start_date: l.startDate || l.createdAt,
                end_date: endDate,
                cost: l.cost ?? 0,
                currency: l.currency || 'USD',
              };
            });
          }

          if (sqlText.includes('v_expiring_licenses')) {
            return mockStore.state.licenses
              .filter((l) => l.expiresAt || l.endDate)
              .map((l) => {
                const expDate = l.endDate || l.expiresAt;
                return {
                  license_id: l.id,
                  tenant_id: l.tenantId,
                  license_name: l.name || l.licenseKey,
                  vendor_name: 'Enterprise Vendor',
                  total_seats: l.totalSeats,
                  active_allocations: l.allocatedSeats ?? 0,
                  start_date: l.startDate || l.createdAt,
                  end_date: expDate,
                  days_left: Math.max(1, Math.round(((new Date(expDate as any).getTime() - Date.now()) / (24 * 3600 * 1000)))),
                  urgency_bucket: '60_DAYS',
                  cost: l.cost,
                  currency: l.currency || 'USD',
                  auto_renew: l.autoRenew,
                };
              });
          }

          if (sqlText.includes('v_vendor_spend')) {
            return mockStore.state.vendors.map((v) => ({
              vendor_id: v.id,
              vendor_name: v.name,
              contact_email: v.supportEmail || v.contactEmail,
              license_count: 1,
              total_initial_cost: 750,
              total_renewal_cost: 0,
              grand_total_spend: 750,
              total_seats_contracted: 35,
              avg_cost_per_seat: 21.43,
            }));
          }

          if (sqlText.includes('v_tenant_summary')) {
            return mockStore.state.tenants.map((t) => {
              const plan = mockStore.state.plans.find((p) => p.id === t.planId) || mockStore.state.plans[0];
              return {
                tenant_id: t.id,
                tenant_name: t.name,
                slug: t.slug,
                plan_name: plan?.name || 'Enterprise',
                tenant_status: t.status || 'ACTIVE',
                user_count: mockStore.state.users.filter((u) => u.tenantId === t.id).length,
                max_users: plan?.maxUsers || 250,
                asset_count: mockStore.state.assets.filter((a) => a.tenantId === t.id).length,
                max_assets: plan?.maxAssets || 5000,
                license_count: mockStore.state.licenses.filter((l) => l.tenantId === t.id).length,
                active_seats_count: 6,
                total_license_spend: 3598,
                onboarded_at: t.createdAt,
              };
            });
          }

          if (sqlText.includes('SELECT 1')) {
            return [{ '?column?': 1, '1': 1 }];
          }

          return [];
        };
      }
      if (prop === '$executeRaw') {
        return async (queryObj: any) => {
          const sqlText =
            typeof queryObj === 'string'
              ? queryObj
              : Array.isArray(queryObj?.strings)
              ? queryObj.strings.join(' ')
              : String(queryObj || '');

          if (sqlText.includes('sp_release_license_seat')) {
            const values = Array.isArray(queryObj?.values) ? queryObj.values : [];
            const [allocationId, revokedBy, reason] = values;
            const alloc = mockStore.state.allocations.find((a) => a.id === allocationId);
            if (alloc && alloc.status === 'ACTIVE') {
              alloc.status = 'REVOKED';
              alloc.revokedAt = new Date();
              alloc.revokedBy = revokedBy || null;
              alloc.revokeReason = reason || 'Administrative seat release';
              const lic = mockStore.state.licenses.find((l) => l.id === alloc.licenseId);
              if (lic) {
                const remainingActive = mockStore.state.allocations.filter(
                  (a) => a.licenseId === lic.id && a.status === 'ACTIVE'
                ).length;
                lic.allocatedSeats = remainingActive;
                lic.usedSeats = remainingActive;
              }
              mockStore.saveState();
            }
          }
          return 1;
        };
      }
      if (prop === '$extends') {
        return () => createMockPrismaClient();
      }
      if (prop.startsWith('$')) {
        return async () => {};
      }
      return createMockModelClient(prop);
    },
  };

  return new Proxy({}, handler);
}
