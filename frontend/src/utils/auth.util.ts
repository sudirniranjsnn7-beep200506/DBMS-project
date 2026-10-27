// ==============================================================================
// AssetVault: Frontend Auth Profile & Session Response Normalizer
// Course: BCSE307L Database Systems (Fall 2026-27)
// Unifies parsing of /auth/me, /auth/login, and /auth/register-tenant payloads.
// Maps backend `name` / `fullName` to User.fullName per frontend/src/types/index.ts.
// ==============================================================================

import { User, Tenant, RoleName } from '../types';

export interface ParsedAuthSession {
  user: User;
  tenant: Tenant | null;
  permissions: string[];
}

/**
 * Normalizes authentication payloads across flat (`/auth/me`) and nested (`/auth/login`)
 * API response envelopes into a typed `ParsedAuthSession`.
 *
 * Guarantees that `user.fullName` is consistently resolved from either `fullName` or `name`,
 * conforming to `frontend/src/types/index.ts`.
 */
export function parseAuthProfile(rawResponse: any): ParsedAuthSession {
  if (!rawResponse) {
    throw new Error('Authentication payload is empty or invalid.');
  }

  // Handle Axios response envelope (.data) if raw response was passed
  const payload = rawResponse.data !== undefined ? rawResponse.data : rawResponse;

  if (!payload || typeof payload !== 'object') {
    throw new Error('Malformed authentication response: expected an object.');
  }

  // Support both wrapped ({ user: { ... }, tenant: { ... } }) and flat profile structures ({ id: ..., name: ... })
  const userCandidate =
    payload.user && typeof payload.user === 'object' ? payload.user : payload;

  if (!userCandidate || !userCandidate.id) {
    throw new Error('Invalid user profile: missing required user id.');
  }

  // Ensure `fullName` is populated from `fullName` or `name`
  const fullName = userCandidate.fullName || userCandidate.name || '';
  const email = userCandidate.email || '';
  const id = userCandidate.id;
  const role: RoleName =
    typeof userCandidate.role === 'object' && userCandidate.role?.name
      ? userCandidate.role.name
      : userCandidate.role || 'MEMBER';
  const roleId: number =
    userCandidate.roleId ?? (typeof userCandidate.role === 'object' ? userCandidate.role.id : 0);
  const isActive: boolean = userCandidate.isActive ?? true;
  const isSuperAdmin: boolean = userCandidate.isSuperAdmin ?? (role === 'SUPER_ADMIN');
  const avatarUrl: string | null = userCandidate.avatarUrl ?? null;

  // Resolve tenant: look at payload.tenant first, then nested userCandidate.tenant
  const tenant: Tenant | null = payload.tenant || userCandidate.tenant || null;
  const tenantId: string | null = userCandidate.tenantId ?? tenant?.id ?? null;

  // Resolve permissions array
  const permissions: string[] = Array.isArray(userCandidate.permissions)
    ? userCandidate.permissions
    : Array.isArray(payload.permissions)
    ? payload.permissions
    : [];

  const user: User = {
    ...userCandidate,
    id,
    email,
    fullName,
    roleId,
    role,
    isActive,
    isSuperAdmin,
    avatarUrl,
    tenantId,
    tenant,
    permissions,
  };

  return {
    user,
    tenant,
    permissions,
  };
}
