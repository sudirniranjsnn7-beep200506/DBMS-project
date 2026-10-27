// ==============================================================================
// AssetVault: Modern AssetListPage Unit Test Suite
// ==============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AssetListPage } from '../pages/assets/AssetListPage';

// Mock Auth Context
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'usr-admin-1',
      fullName: 'Sarah Connor',
      email: 'sarah@example.com',
      role: 'TENANT_ADMIN',
      isSuperAdmin: false,
    },
    tenant: { id: 't-1', name: 'Cyberdyne Systems', status: 'ACTIVE' },
    hasPermission: () => true,
    hasRole: () => true,
    logout: vi.fn(),
  }),
}));

// Mock Toast Context
vi.mock('../context/ToastContext', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}));

const mockAssets = [
  {
    asset_id: 'ast-001',
    id: 'ast-001',
    asset_name: 'Core Design Tokens & CSS Variables',
    name: 'Core Design Tokens & CSS Variables',
    asset_code: 'AST-TOKENS-01',
    assetCode: 'AST-TOKENS-01',
    asset_type: 'SOFTWARE',
    assetType: 'SOFTWARE',
    asset_status: 'ACTIVE',
    status: 'ACTIVE',
    compliance_status: 'COMPLIANT',
    complianceStatus: 'COMPLIANT',
    category_name: 'Design Systems',
    owner_name: 'Sarah Connor',
    owner: { fullName: 'Sarah Connor', email: 'sarah@example.com' },
    created_at: '2026-03-15T10:00:00Z',
    createdAt: '2026-03-15T10:00:00Z',
    latest_version_no: 2,
    description: 'Design tokens and fluid typography styling primitives',
    tags: ['design-system', 'tokens', 'v2'],
  },
  {
    asset_id: 'ast-002',
    id: 'ast-002',
    asset_name: 'Database Architecture ERD Diagram',
    name: 'Database Architecture ERD Diagram',
    asset_code: 'AST-ARCH-ERD',
    assetCode: 'AST-ARCH-ERD',
    asset_type: 'DOCUMENT',
    assetType: 'DOCUMENT',
    asset_status: 'ACTIVE',
    status: 'ACTIVE',
    compliance_status: 'UNLICENSED',
    complianceStatus: 'UNLICENSED',
    category_name: 'Engineering Specs',
    owner_name: 'John Connor',
    owner: { fullName: 'John Connor', email: 'john@example.com' },
    created_at: '2026-03-20T14:30:00Z',
    createdAt: '2026-03-20T14:30:00Z',
    latest_version_no: 1,
    description: 'Multi-tenant relational database entity schema documentation',
    tags: ['postgres', 'prisma'],
  },
  {
    asset_id: 'ast-003',
    id: 'ast-003',
    asset_name: 'Enterprise Brand Identity Package',
    name: 'Enterprise Brand Identity Package',
    asset_code: 'AST-BRAND-PKG',
    assetCode: 'AST-BRAND-PKG',
    asset_type: 'IMAGE',
    assetType: 'IMAGE',
    asset_status: 'ACTIVE',
    status: 'ACTIVE',
    compliance_status: 'EXPIRED_LICENSE',
    complianceStatus: 'EXPIRED_LICENSE',
    category_name: 'Branding',
    owner_name: 'Sarah Connor',
    owner: { fullName: 'Sarah Connor', email: 'sarah@example.com' },
    created_at: '2026-03-22T09:15:00Z',
    createdAt: '2026-03-22T09:15:00Z',
    latest_version_no: 3,
    description: 'High-res vector logos, markdowns, and brand badges',
    tags: ['branding', 'vector'],
  },
];

const mockCategoryTree = [
  {
    id: 'cat-1',
    name: 'Engineering',
    parentId: null,
    assetCount: 15,
    children: [
      {
        id: 'cat-1-1',
        name: 'Design Systems',
        parentId: 'cat-1',
        assetCount: 8,
        children: [],
      },
      {
        id: 'cat-1-2',
        name: 'Engineering Specs',
        parentId: 'cat-1',
        assetCount: 7,
        children: [],
      },
    ],
  },
  {
    id: 'cat-2',
    name: 'Branding',
    parentId: null,
    assetCount: 4,
    children: [],
  },
];

// Mock API endpoints
vi.mock('../services/api', () => ({
  api: {
    get: vi.fn((url: string) => {
      if (url === '/assets') {
        return Promise.resolve({
          data: mockAssets,
          meta: {
            page: 1,
            limit: 12,
            total: 3,
            totalPages: 1,
            hasNext: false,
            hasPrev: false,
          },
        });
      }
      if (url === '/categories/tree') {
        return Promise.resolve({
          data: mockCategoryTree,
        });
      }
      if (url === '/categories') {
        return Promise.resolve({
          data: [
            { id: 'cat-1-1', name: 'Design Systems' },
            { id: 'cat-1-2', name: 'Engineering Specs' },
            { id: 'cat-2', name: 'Branding' },
          ],
        });
      }
      return Promise.resolve({ data: [] });
    }),
    post: vi.fn().mockResolvedValue({ data: { id: 'new-id' } }),
    delete: vi.fn().mockResolvedValue({ data: { message: 'Deleted' } }),
  },
  apiClient: {
    get: vi.fn().mockResolvedValue({ data: 'csv,data' }),
  },
  getAccessToken: vi.fn().mockReturnValue('mock-token'),
}));

function createTestQueryClient() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
    },
  });
  queryClient.setQueryData(['assets', '', undefined, 'ACTIVE', 'ALL', '', '', 1, 12, 'created_at', 'desc'], {
    data: mockAssets,
    meta: {
      page: 1,
      limit: 12,
      total: 3,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    },
  });
  queryClient.setQueryData(['categories', 'tree'], mockCategoryTree);
  queryClient.setQueryData(['categories', 'flat'], {
    data: [
      { id: 'cat-1-1', name: 'Design Systems' },
      { id: 'cat-1-2', name: 'Engineering Specs' },
      { id: 'cat-2', name: 'Branding' },
    ],
  });
  return queryClient;
}

describe('AssetListPage Redesign Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. renders header, action buttons and view mode controls', () => {
    const qc = createTestQueryClient();
    const html = renderToStaticMarkup(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/assets']}>
          <AssetListPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(html).toContain('Digital Asset Repository');
    expect(html).toContain('Add Asset');
    expect(html).toContain('Import CSV');
    expect(html).toContain('Export CSV');
    expect(html).toContain('Grid View');
    expect(html).toContain('Table View');
  });

  it('2. renders filter sidebar with asset types, status, compliance, category tree and owner search', () => {
    const qc = createTestQueryClient();
    const html = renderToStaticMarkup(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/assets']}>
          <AssetListPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Filter section headings
    expect(html).toContain('Filters');
    expect(html).toContain('Asset Types');
    expect(html).toContain('Catalog Status');
    expect(html).toContain('Compliance Status');
    expect(html).toContain('Category Hierarchy');
    expect(html).toContain('Owner Filter');

    // Asset types
    expect(html).toContain('Software');
    expect(html).toContain('Document');
    expect(html).toContain('Image');
    expect(html).toContain('Video');
    expect(html).toContain('Dataset');
    expect(html).toContain('Font');

    // Status radios
    expect(html).toContain('Active Assets');
    expect(html).toContain('Trash / Archived');
    expect(html).toContain('All Catalog');

    // Compliance options
    expect(html).toContain('Compliant');
    expect(html).toContain('Unlicensed');
    expect(html).toContain('Expired');

    // Category tree nodes
    expect(html).toContain('All Categories');
    expect(html).toContain('Engineering');
    expect(html).toContain('Branding');
  });

  it('3. renders Grid view by default with asset cards, codes, badges and owner avatars', () => {
    const qc = createTestQueryClient();
    const html = renderToStaticMarkup(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/assets?view=grid']}>
          <AssetListPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Asset names
    expect(html).toContain('Core Design Tokens &amp; CSS Variables');
    expect(html).toContain('Database Architecture ERD Diagram');
    expect(html).toContain('Enterprise Brand Identity Package');

    // Asset SKU codes
    expect(html).toContain('AST-TOKENS-01');
    expect(html).toContain('AST-ARCH-ERD');
    expect(html).toContain('AST-BRAND-PKG');

    // Compliance status badges
    expect(html).toContain('COMPLIANT');
    expect(html).toContain('UNLICENSED');
    expect(html).toContain('EXPIRED');

    // Owner avatars
    expect(html).toContain('Sarah Connor');
    expect(html).toContain('John Connor');

    // Tag chips
    expect(html).toContain('#design-system');
    expect(html).toContain('#postgres');
  });

  it('4. renders Table view when view=table with sticky header and sortable columns', () => {
    const qc = createTestQueryClient();
    const html = renderToStaticMarkup(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/assets?view=table']}>
          <AssetListPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Table elements
    expect(html).toContain('<table');
    expect(html).toContain('Asset Details');
    expect(html).toContain('Type');
    expect(html).toContain('Compliance');
    expect(html).toContain('Category');
    expect(html).toContain('Owner');
    expect(html).toContain('Created Date');

    // Rows content
    expect(html).toContain('AST-TOKENS-01');
    expect(html).toContain('Design Systems');
    expect(html).toContain('Engineering Specs');
    expect(html).toContain('Branding');
  });

  it('5. renders pagination at the bottom with results summary', () => {
    const qc = createTestQueryClient();
    const html = renderToStaticMarkup(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/assets']}>
          <AssetListPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(html).toContain('Showing');
    expect(html).toContain('results');
    expect(html).toContain('Page 1 of 1');
  });
});
