// ==============================================================================
// AssetVault: Express TypeScript Definitions Extension
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { RoleName, Permission } from '../config/permissions';
import { PrismaClient } from '@prisma/client';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  tenantId: string | null;
  roleId: number;
  role: RoleName;
  isSuperAdmin: boolean;
  permissions: Permission[];
  tenant?: {
    id: string;
    name: string;
    slug: string;
    status: string;
    plan?: {
      id: number;
      name: string;
      maxUsers: number;
      maxAssets: number;
    } | null;
  } | null;
}

export interface TenantContext {
  id: string;
  name: string;
  slug: string;
}

declare global {
  namespace Express {
    interface User extends AuthUser {}
    interface Request {
      user?: AuthUser;
      jwtUser?: {
        sub: string;
        email: string;
        role: RoleName;
        tenantId: string | null;
        isSuperAdmin?: boolean;
      };
      tenant?: TenantContext;
      prisma?: any;
      file?: any;
      files?: any;
    }
  }
}
