// ==============================================================================
// AssetVault: Modern UserListPage Unit Test Suite
// Requirements:
// - Table with columns: Avatar + Name, Email, Role badge (color-coded per role),
//   Status toggle (active/inactive switch), Last Login relative time, Actions
// - Role badge colors: SUPER_ADMIN=purple, TENANT_ADMIN=indigo, ASSET_MANAGER=blue, MEMBER=slate
// - Inline role change: clicking the role badge opens dropdown to change role
// - Inline status toggle: switch calls PATCH /users/:id/status with optimistic update
// - Invite User slide-over: form with email, fullName, role select, triggers POST /users
// - Bulk select + bulk deactivate action
// - Search bar filters by name/email in real-time
// - Empty state with illustration and "Invite your first team member" CTA
// ==============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  UserListPage,
  ROLE_CONFIG,
  formatRelativeTime,
  generateSecurePassword,
} from '../pages/users/UserListPage';
import { User } from '../types';

// Mock Auth Context
const mockCurrentUser = {
  id: 'usr-admin-01',
  fullName: 'Sarah Connor',
  email: 'sarah.connor@cyberdyne.internal',
  role: 'TENANT_ADMIN',
  isSuperAdmin: false,
};

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: mockCurrentUser,
    tenant: { id: 't-cyberdyne', name: 'Cyberdyne Systems', status: 'ACTIVE' },
    hasPermission: () => true,
    hasRole: () => true,
    logout: vi.fn(),
  }),
}));

// Mock Toast Context
vi.mock('../context/ToastContext', () => ({
  useToast: () => ({
    toast: {
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warning: vi.fn(),
    },
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}));

const mockUsers: User[] = [
  {
    id: 'usr-admin-01',
    fullName: 'Sarah Connor',
    email: 'sarah.connor@cyberdyne.internal',
    roleId: 2,
    role: 'TENANT_ADMIN',
    isActive: true,
    avatarUrl: null,
    lastLoginAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30m ago
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'usr-mgr-02',
    fullName: 'John Connor',
    email: 'john.connor@cyberdyne.internal',
    roleId: 3,
    role: 'ASSET_MANAGER',
    isActive: true,
    avatarUrl: null,
    lastLoginAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), // 5h ago
    createdAt: '2026-01-05T12:00:00Z',
  },
  {
    id: 'usr-mem-03',
    fullName: 'Kyle Reese',
    email: 'kyle.reese@cyberdyne.internal',
    roleId: 4,
    role: 'MEMBER',
    isActive: false,
    avatarUrl: null,
    lastLoginAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(), // 3d ago
    createdAt: '2026-02-01T09:00:00Z',
  },
  {
    id: 'usr-sup-04',
    fullName: 'Miles Dyson',
    email: 'miles.dyson@cyberdyne.internal',
    roleId: 1,
    role: 'SUPER_ADMIN',
    isActive: true,
    avatarUrl: null,
    lastLoginAt: null, // Never
    createdAt: '2025-12-01T00:00:00Z',
  },
];

// Mock API
vi.mock('../services/api', () => ({
  api: {
    get: vi.fn((url: string) => {
      if (url === '/users') {
        return Promise.resolve({
          data: mockUsers,
          meta: {
            page: 1,
            limit: 10,
            total: 4,
            totalPages: 1,
            hasNext: false,
            hasPrev: false,
          },
        });
      }
      return Promise.resolve({ data: [] });
    }),
    post: vi.fn().mockResolvedValue({ data: { success: true } }),
    patch: vi.fn().mockResolvedValue({ data: { success: true } }),
    delete: vi.fn().mockResolvedValue({ data: { success: true } }),
  },
}));

function createTestQueryClient(usersList: User[] = mockUsers) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
    },
  });

  queryClient.setQueryData(['users', 1, 10, '', '', ''], {
    data: usersList,
    meta: {
      page: 1,
      limit: 10,
      total: usersList.length,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    },
  });

  return queryClient;
}

describe('UserListPage Modern Team Management Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. formatRelativeTime returns human-readable relative time expressions', () => {
    expect(formatRelativeTime(null)).toBe('Never');
    expect(formatRelativeTime(undefined)).toBe('Never');
    expect(formatRelativeTime('invalid-date')).toBe('Never');

    const now = Date.now();
    expect(formatRelativeTime(new Date(now - 1000 * 20).toISOString())).toBe('Just now');
    expect(formatRelativeTime(new Date(now - 1000 * 60 * 15).toISOString())).toBe('15m ago');
    expect(formatRelativeTime(new Date(now - 1000 * 60 * 60 * 4).toISOString())).toBe('4h ago');
    expect(formatRelativeTime(new Date(now - 1000 * 60 * 60 * 25).toISOString())).toBe('Yesterday');
    expect(formatRelativeTime(new Date(now - 1000 * 60 * 60 * 24 * 4).toISOString())).toBe('4d ago');
    expect(formatRelativeTime(new Date(now - 1000 * 60 * 60 * 24 * 14).toISOString())).toBe('2w ago');
  });

  it('2. generateSecurePassword generates strong >=10 char passwords with upper, lower, digit and symbol', () => {
    for (let i = 0; i < 5; i++) {
      const pwd = generateSecurePassword();
      expect(pwd.length).toBeGreaterThanOrEqual(10);
      expect(/[A-Z]/.test(pwd)).toBe(true);
      expect(/[a-z]/.test(pwd)).toBe(true);
      expect(/[0-9]/.test(pwd)).toBe(true);
      expect(/[^A-Za-z0-9]/.test(pwd)).toBe(true);
    }
  });

  it('3. role configuration tokens map required colors: SUPER_ADMIN=purple, TENANT_ADMIN=indigo, ASSET_MANAGER=blue, MEMBER=slate', () => {
    expect(ROLE_CONFIG.SUPER_ADMIN.badgeClass).toContain('purple');
    expect(ROLE_CONFIG.TENANT_ADMIN.badgeClass).toContain('indigo');
    expect(ROLE_CONFIG.ASSET_MANAGER.badgeClass).toContain('blue');
    expect(ROLE_CONFIG.MEMBER.badgeClass).toContain('slate');
  });

  it('4. renders header with title and Invite Team Member action button', () => {
    const qc = createTestQueryClient();
    const html = renderToStaticMarkup(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <UserListPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(html).toContain('Team &amp; Access Management');
    expect(html).toContain('Invite Team Member');
  });

  it('5. renders table with required columns: Avatar + Name, Email, Role, Status, Last Login, Actions', () => {
    const qc = createTestQueryClient();
    const html = renderToStaticMarkup(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <UserListPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Columns
    expect(html).toContain('Avatar + Name');
    expect(html).toContain('Email');
    expect(html).toContain('Role');
    expect(html).toContain('Status');
    expect(html).toContain('Last Login');
    expect(html).toContain('Actions');

    // Users Rendered
    expect(html).toContain('Sarah Connor');
    expect(html).toContain('sarah.connor@cyberdyne.internal');
    expect(html).toContain('John Connor');
    expect(html).toContain('john.connor@cyberdyne.internal');
    expect(html).toContain('Kyle Reese');
    expect(html).toContain('kyle.reese@cyberdyne.internal');
    expect(html).toContain('Miles Dyson');
    expect(html).toContain('miles.dyson@cyberdyne.internal');
  });

  it('6. renders color-coded role badges with dot indicators and dropdown chevron', () => {
    const qc = createTestQueryClient();
    const html = renderToStaticMarkup(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <UserListPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(html).toContain('Tenant Admin');
    expect(html).toContain('Asset Manager');
    expect(html).toContain('Member');
    expect(html).toContain('Super Admin');

    // Color classes present in DOM
    expect(html).toContain('text-indigo-300');
    expect(html).toContain('text-blue-300');
    expect(html).toContain('text-slate-300');
    expect(html).toContain('text-purple-300');
  });

  it('7. renders status switches with accessible role="switch" and aria-checked states', () => {
    const qc = createTestQueryClient();
    const html = renderToStaticMarkup(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <UserListPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain('aria-checked="false"');
    expect(html).toContain('Active');
    expect(html).toContain('Inactive');
  });

  it('8. renders relative login times and search input placeholder', () => {
    const qc = createTestQueryClient();
    const html = renderToStaticMarkup(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <UserListPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(html).toContain('Never');
    expect(html).toContain('Search by name or email in real-time...');
  });

  it('9. renders empty state with illustration and "Invite your first team member" CTA when no users exist', () => {
    const emptyQc = createTestQueryClient([]);
    const html = renderToStaticMarkup(
      <QueryClientProvider client={emptyQc}>
        <MemoryRouter>
          <UserListPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(html).toContain('No Team Members Yet');
    expect(html).toContain('Invite your first team member');
  });
});
