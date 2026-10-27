import { describe, it, expect } from 'vitest';
import { parseAuthProfile } from '../utils/auth.util';

describe('Frontend parseAuthProfile Unified Normalizer', () => {
  it('correctly parses flat GET /auth/me response and maps name to fullName', () => {
    const flatMeResponse = {
      status: 'success',
      data: {
        id: 'user-uuid-1',
        name: 'Alex Johnson',
        email: 'alex@techcorp.io',
        avatarUrl: 'https://example.com/avatar.png',
        role: 'TENANT_ADMIN',
        isSuperAdmin: false,
        tenant: {
          id: 'tenant-uuid-1',
          name: 'TechCorp',
          slug: 'techcorp',
          status: 'ACTIVE',
        },
        plan: {
          id: 1,
          name: 'Enterprise',
          maxUsers: 100,
          maxAssets: 5000,
        },
        permissions: ['ASSETS_VIEW', 'ASSETS_CREATE', 'LICENSES_VIEW'],
      },
    };

    const session = parseAuthProfile(flatMeResponse);

    expect(session.user).toBeDefined();
    expect(session.user.id).toBe('user-uuid-1');
    expect(session.user.email).toBe('alex@techcorp.io');
    // Verifies name is mapped to fullName
    expect(session.user.fullName).toBe('Alex Johnson');
    expect(session.user.role).toBe('TENANT_ADMIN');
    expect(session.tenant).toBeDefined();
    expect(session.tenant?.slug).toBe('techcorp');
    expect(session.permissions).toEqual(['ASSETS_VIEW', 'ASSETS_CREATE', 'LICENSES_VIEW']);
  });

  it('correctly parses flat GET /auth/me response when tenant is null (e.g. SUPER_ADMIN)', () => {
    const flatSuperAdminMe = {
      status: 'success',
      data: {
        id: 'super-admin-uuid',
        name: 'Platform Root',
        email: 'root@assetvault.internal',
        role: 'SUPER_ADMIN',
        isSuperAdmin: true,
        tenant: null,
        plan: null,
        permissions: ['*'],
      },
    };

    // Before the fix, refreshProfile threw TypeError: Cannot read properties of undefined (reading 'tenant')
    const session = parseAuthProfile(flatSuperAdminMe);

    expect(session.user.id).toBe('super-admin-uuid');
    expect(session.user.fullName).toBe('Platform Root');
    expect(session.user.role).toBe('SUPER_ADMIN');
    expect(session.tenant).toBeNull();
    expect(session.permissions).toEqual(['*']);
  });

  it('correctly parses nested /auth/login envelope with user and tenant objects', () => {
    const nestedLoginResponse = {
      data: {
        accessToken: 'mock-jwt-token',
        user: {
          id: 'user-uuid-2',
          email: 'sarah@innovatelabs.io',
          fullName: 'Sarah Connor',
          tenantId: 'tenant-uuid-2',
          role: 'ASSET_MANAGER',
          isSuperAdmin: false,
          permissions: ['ASSETS_VIEW', 'ASSETS_DOWNLOAD'],
          tenant: {
            id: 'tenant-uuid-2',
            name: 'InnovateLabs',
            slug: 'innovatelabs',
            status: 'ACTIVE',
          },
        },
        tenant: {
          id: 'tenant-uuid-2',
          name: 'InnovateLabs',
          slug: 'innovatelabs',
          status: 'ACTIVE',
        },
      },
    };

    const session = parseAuthProfile(nestedLoginResponse);

    expect(session.user.id).toBe('user-uuid-2');
    expect(session.user.fullName).toBe('Sarah Connor');
    expect(session.user.role).toBe('ASSET_MANAGER');
    expect(session.tenant?.slug).toBe('innovatelabs');
    expect(session.permissions).toContain('ASSETS_DOWNLOAD');
  });

  it('throws an informative error for invalid or empty response payload', () => {
    expect(() => parseAuthProfile(null)).toThrow(/empty or invalid/i);
    expect(() => parseAuthProfile({})).toThrow(/missing required user id/i);
    expect(() => parseAuthProfile({ data: { unexpected: true } })).toThrow(/missing required user id/i);
  });
});
