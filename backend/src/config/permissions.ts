// ==============================================================================
// AssetVault: Single Source of Truth for Role-Based Access Control (RBAC)
// Course: BCSE307L Database Systems (Fall 2026-27)
// Matches /docs/rbac-matrix.md strictly
// ==============================================================================

export type RoleName = 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'ASSET_MANAGER' | 'MEMBER';

export const PERMISSIONS = [
  // Platform Administration
  'tenants:read_platform',
  'tenants:manage_platform',
  'tenants:read_own',
  'tenants:update_own',
  'plans:read',
  'plans:manage',
  'analytics:platform_read',

  // Tenant Organization Users
  'users:read',
  'users:manage',

  // Vendors & Taxonomy
  'vendors:read',
  'vendors:manage',
  'categories:read',
  'categories:manage',
  'tags:read',
  'tags:manage',

  // Digital Assets & Versions
  'assets:read',
  'assets:create',
  'assets:update',
  'assets:delete',
  'assets:download',
  'versions:read',
  'versions:create',

  // Licenses & Contracts
  'licenses:read',
  'licenses:create',
  'licenses:update',
  'licenses:delete',
  'licenses:renew',
  'licenses:link_asset',

  // Seat Allocations
  'allocations:read',
  'allocations:manage_all',
  'allocations:checkout_self',
  'allocations:release_self',

  // Governance & Notifications
  'audit:read',
  'notifications:read',
  'notifications:manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<RoleName, readonly Permission[]> = {
  SUPER_ADMIN: [
    'tenants:read_platform',
    'tenants:manage_platform',
    'plans:read',
    'plans:manage',
    'analytics:platform_read',
    'notifications:read',
    'notifications:manage',
  ],

  TENANT_ADMIN: [
    'tenants:read_own',
    'tenants:update_own',
    'plans:read',
    'users:read',
    'users:manage',
    'vendors:read',
    'vendors:manage',
    'categories:read',
    'categories:manage',
    'tags:read',
    'tags:manage',
    'assets:read',
    'assets:create',
    'assets:update',
    'assets:delete',
    'assets:download',
    'versions:read',
    'versions:create',
    'licenses:read',
    'licenses:create',
    'licenses:update',
    'licenses:delete',
    'licenses:renew',
    'licenses:link_asset',
    'allocations:read',
    'allocations:manage_all',
    'allocations:checkout_self',
    'allocations:release_self',
    'audit:read',
    'notifications:read',
    'notifications:manage',
  ],

  ASSET_MANAGER: [
    'tenants:read_own',
    'plans:read',
    'vendors:read',
    'vendors:manage',
    'categories:read',
    'categories:manage',
    'tags:read',
    'tags:manage',
    'assets:read',
    'assets:create',
    'assets:update',
    'assets:download',
    'versions:read',
    'versions:create',
    'licenses:read',
    'licenses:create',
    'licenses:update',
    'licenses:renew',
    'licenses:link_asset',
    'allocations:read',
    'allocations:manage_all',
    'allocations:checkout_self',
    'allocations:release_self',
    'notifications:read',
    'notifications:manage',
  ],

  MEMBER: [
    'tenants:read_own',
    'plans:read',
    'categories:read',
    'tags:read',
    'assets:read',
    'assets:download',
    'versions:read',
    'licenses:read',
    'allocations:read',
    'allocations:checkout_self',
    'allocations:release_self',
    'notifications:read',
  ],
};

export function hasPermission(role: RoleName, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  return permissions ? permissions.includes(permission) : false;
}

export function getPermissionsForRole(role: RoleName): Permission[] {
  return [...(ROLE_PERMISSIONS[role] || [])];
}

export interface MenuItem {
  key: string;
  label: string;
  path: string;
  icon: string;
  requiredPermission?: Permission;
  requiredRole?: RoleName[];
}

export const ALL_MENU_ITEMS: MenuItem[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    path: '/',
    icon: 'LayoutDashboard',
    requiredPermission: 'tenants:read_own',
  },
  {
    key: 'assets',
    label: 'Asset Catalog',
    path: '/assets',
    icon: 'FolderGit2',
    requiredPermission: 'assets:read',
  },
  {
    key: 'licenses',
    label: 'Licenses',
    path: '/licenses',
    icon: 'KeyRound',
    requiredPermission: 'licenses:read',
  },
  {
    key: 'allocations',
    label: 'Seat Allocations',
    path: '/allocations',
    icon: 'UserCheck',
    requiredPermission: 'allocations:read',
  },
  {
    key: 'vendors',
    label: 'Vendors',
    path: '/vendors',
    icon: 'Building2',
    requiredPermission: 'vendors:read',
  },
  {
    key: 'team',
    label: 'Team Members',
    path: '/users',
    icon: 'Users',
    requiredPermission: 'users:read',
  },
  {
    key: 'audit',
    label: 'Audit Ledger',
    path: '/audit-logs',
    icon: 'ShieldCheck',
    requiredPermission: 'audit:read',
  },
  {
    key: 'tenants',
    label: 'Tenant Governance',
    path: '/platform/tenants',
    icon: 'Server',
    requiredPermission: 'tenants:manage_platform',
  },
  {
    key: 'plans',
    label: 'Subscription Plans',
    path: '/platform/plans',
    icon: 'CreditCard',
    requiredPermission: 'plans:manage',
  },
];

export function getMenuItemsForRole(role: RoleName): MenuItem[] {
  const userPermissions = ROLE_PERMISSIONS[role] || [];
  return ALL_MENU_ITEMS.filter((item) => {
    if (item.requiredPermission && !userPermissions.includes(item.requiredPermission)) {
      return false;
    }
    if (item.requiredRole && !item.requiredRole.includes(role)) {
      return false;
    }
    return true;
  });
}
