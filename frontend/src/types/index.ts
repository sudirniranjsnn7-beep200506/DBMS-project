// ==============================================================================
// AssetVault: Frontend TypeScript Domain Definitions
// Course: BCSE307L Database Systems (Fall 2026-27)
// Matches Backend Domain Schema & OpenAPI Contract
// ==============================================================================

export type RoleName = 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'ASSET_MANAGER' | 'MEMBER';

export type TenantStatus = 'TRIAL' | 'ACTIVE' | 'SUSPENDED';

export type AssetType = 'FONT' | 'IMAGE' | 'SOFTWARE' | 'DATASET' | 'VIDEO' | 'DOCUMENT' | 'AUDIO' | 'OTHER';

export type AssetStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export type LicenseStatus = 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'CANCELLED';

export type AllocationStatus = 'ACTIVE' | 'RELEASED' | 'REVOKED';

export type AccessAction = 'VIEW' | 'DOWNLOAD' | 'CHECKOUT' | 'CHECKIN';

export type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE' | 'TRUNCATE';

export type NotificationType =
  | 'EXPIRY_30'
  | 'EXPIRY_15'
  | 'EXPIRY_7'
  | 'EXPIRED'
  | 'OVER_ALLOCATION'
  | 'SYSTEM'
  | 'LICENSE_EXPIRY'
  | 'SEAT_LIMIT';

export interface Plan {
  id: number;
  name: string;
  maxUsers: number;
  maxAssets: number;
  monthlyPrice: number | string;
  isActive: boolean;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  contactEmail?: string | null;
  planId: number;
  plan?: Plan;
  createdAt?: string;
  updatedAt?: string;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string | null;
  roleId: number;
  role: RoleName | { id: number; name: RoleName; description?: string };
  isActive: boolean;
  isSuperAdmin?: boolean;
  tenantId?: string | null;
  tenant?: Tenant | null;
  permissions?: string[];
  lastLoginAt?: string | null;
  createdAt?: string;
}

export interface Category {
  id: string;
  tenantId: string;
  parentId?: string | null;
  name: string;
  description?: string | null;
  parent?: Category | null;
  children?: Category[];
  _count?: { assets: number };
}

export interface Tag {
  id: string;
  tenantId: string;
  name: string;
  color: string;
  _count?: { assetTags: number };
}

export interface Vendor {
  id: string;
  tenantId: string;
  name: string;
  contactEmail?: string | null;
  website?: string | null;
  supportPhone?: string | null;
  licenses?: License[];
  _count?: { licenses: number };
}

export interface AssetVersion {
  id: string;
  assetId: string;
  versionNo: number;
  fileUrl: string;
  fileSizeBytes: number | string;
  checksumSha256: string;
  changeNotes?: string | null;
  uploadedBy?: string | null;
  uploader?: { id: string; fullName: string; email: string } | null;
  createdAt: string;
}

export interface Asset {
  id: string;
  tenantId: string;
  ownerId: string;
  categoryId?: string | null;
  assetCode: string;
  name: string;
  description?: string | null;
  assetType: AssetType;
  status: AssetStatus;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  category?: Category | null;
  owner?: { id: string; fullName: string; email: string } | null;
  versions?: AssetVersion[];
  tags?: { tag: Tag }[] | Tag[];
  assetLicenses?: { license: License }[];
  complianceStatus?: 'COMPLIANT' | 'UNLICENSED' | 'EXPIRED_LICENSE';
}

export interface LicenseType {
  id: number;
  name: string;
  isSeatBased: boolean;
  isExpirable: boolean;
  description?: string | null;
}

export interface License {
  id: string;
  tenantId: string;
  vendorId: string;
  licenseTypeId: number;
  name: string;
  licenseKey: string;
  totalSeats: number;
  startDate: string;
  endDate?: string | null;
  cost: number | string;
  currency: string;
  autoRenew: boolean;
  status: LicenseStatus;
  terms?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  vendor?: Vendor;
  licenseType?: LicenseType;
  allocations?: LicenseAllocation[];
  renewals?: LicenseRenewal[];
  assetLicenses?: { asset: Asset }[];
  usedSeats?: number;
  availableSeats?: number;
  utilizationPct?: number;
  daysToExpiry?: number | null;
}

export interface LicenseAllocation {
  id: string;
  licenseId: string;
  userId: string;
  allocatedBy?: string | null;
  allocatedAt: string;
  releasedAt?: string | null;
  status: AllocationStatus;
  notes?: string | null;
  user?: { id: string; fullName: string; email: string; avatarUrl?: string | null };
  allocator?: { id: string; fullName: string; email: string } | null;
  license?: License;
}

export interface LicenseRenewal {
  id: string;
  licenseId: string;
  renewedBy?: string | null;
  oldEndDate: string;
  newEndDate: string;
  cost: number | string;
  notes?: string | null;
  renewedAt: string;
  renewer?: { id: string; fullName: string } | null;
}

export interface AssetAccessLog {
  id: string | number;
  assetId: string;
  userId?: string | null;
  licenseId?: string | null;
  action: AccessAction;
  ipAddress?: string | null;
  accessedAt: string;
  asset?: Asset;
  user?: { id: string; fullName: string; email: string } | null;
  license?: License | null;
}

export interface Notification {
  id: string;
  tenantId: string;
  userId?: string | null;
  licenseId?: string | null;
  type: NotificationType;
  title?: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string | number;
  tenantId?: string | null;
  userId?: string | null;
  tableName: string;
  recordId: string;
  action: AuditAction;
  oldData?: Record<string, any> | null;
  newData?: Record<string, any> | null;
  performedAt: string;
  user?: { id: string; fullName: string; email: string } | null;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ApiResponse<T> {
  status: 'success' | 'error';
  data: T;
  meta?: PaginationMeta;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface MenuItem {
  id: string;
  label: string;
  path: string;
  icon: string;
  badge?: number | string | null;
}
