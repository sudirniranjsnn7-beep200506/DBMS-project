// ==============================================================================
// AssetVault: Modern LicenseListPage Unit Test Suite
// ==============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LicenseListPage } from '../pages/licenses/LicenseListPage';

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

const mockLicenses = [
  {
    license_id: 'lic-001',
    id: 'lic-001',
    license_name: 'JetBrains All Products Pack',
    name: 'JetBrains All Products Pack',
    vendor_name: 'JetBrains s.r.o.',
    vendor: { id: 'v-1', name: 'JetBrains s.r.o.' },
    license_type: 'SEAT_BASED',
    licenseType: { id: 3, name: 'SEAT_BASED', isSeatBased: true },
    license_key: '••••••••-9821',
    licenseKey: 'JB-ENT-2026-9821',
    total_seats: 30,
    totalSeats: 30,
    used_seats: 25,
    usedSeats: 25,
    available_seats: 5,
    availableSeats: 5,
    utilization_pct: 83.3, // amber 70-90%
    days_to_expiry: 45,
    status: 'ACTIVE',
    start_date: '2026-01-01T00:00:00Z',
    end_date: '2026-12-31T23:59:59Z',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    cost: 4890.0,
    currency: 'USD',
  },
  {
    license_id: 'lic-002',
    id: 'lic-002',
    license_name: 'Figma Enterprise Workspace',
    name: 'Figma Enterprise Workspace',
    vendor_name: 'Figma Inc',
    vendor: { id: 'v-2', name: 'Figma Inc' },
    license_type: 'SUBSCRIPTION',
    licenseType: { id: 2, name: 'SUBSCRIPTION', isSeatBased: true },
    license_key: '••••••••-4412',
    licenseKey: 'FIG-SUB-2026-4412',
    total_seats: 20,
    totalSeats: 20,
    used_seats: 20,
    usedSeats: 20,
    available_seats: 0,
    availableSeats: 0,
    utilization_pct: 100.0, // red >90% & at capacity
    days_to_expiry: 12, // red <30 days
    status: 'ACTIVE',
    start_date: '2026-02-01T00:00:00Z',
    end_date: '2026-11-02T23:59:59Z',
    startDate: '2026-02-01',
    endDate: '2026-11-02',
    cost: 3200.0,
    currency: 'USD',
  },
  {
    license_id: 'lic-003',
    id: 'lic-003',
    license_name: 'PostgreSQL Enterprise Support',
    name: 'PostgreSQL Enterprise Support',
    vendor_name: 'EnterpriseDB',
    vendor: { id: 'v-3', name: 'EnterpriseDB' },
    license_type: 'PERPETUAL',
    licenseType: { id: 1, name: 'PERPETUAL', isSeatBased: true },
    license_key: '••••••••-7731',
    licenseKey: 'EDB-PERP-2026-7731',
    total_seats: 50,
    totalSeats: 50,
    used_seats: 15,
    usedSeats: 15,
    available_seats: 35,
    availableSeats: 35,
    utilization_pct: 30.0, // green <70%
    days_to_expiry: null, // perpetual
    status: 'ACTIVE',
    start_date: '2025-01-01T00:00:00Z',
    end_date: null,
    startDate: '2025-01-01',
    endDate: null,
    cost: 8500.0,
    currency: 'USD',
  },
];

const mockVendors = [
  { id: 'v-1', name: 'JetBrains s.r.o.' },
  { id: 'v-2', name: 'Figma Inc' },
  { id: 'v-3', name: 'EnterpriseDB' },
];

const mockUsers = [
  { id: 'usr-1', fullName: 'Sarah Connor', email: 'sarah@example.com' },
  { id: 'usr-2', fullName: 'John Connor', email: 'john@example.com' },
];

// Mock API
vi.mock('../services/api', () => ({
  api: {
    get: vi.fn((url: string) => {
      if (url === '/licenses') {
        return Promise.resolve({
          data: mockLicenses,
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
      if (url === '/vendors') {
        return Promise.resolve({ data: mockVendors });
      }
      if (url === '/users') {
        return Promise.resolve({ data: mockUsers });
      }
      return Promise.resolve({ data: [] });
    }),
    post: vi.fn().mockResolvedValue({ data: { success: true } }),
    delete: vi.fn().mockResolvedValue({ data: { message: 'Deleted' } }),
  },
  apiClient: {
    get: vi.fn().mockResolvedValue({ data: new Blob(['pdf-data']) }),
  },
  getAccessToken: vi.fn().mockReturnValue('mock-jwt-token'),
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

  queryClient.setQueryData(
    ['licenses', '', 1, 12, '', 'ACTIVE', '', '', 'endDate', 'asc'],
    {
      data: mockLicenses,
      meta: {
        page: 1,
        limit: 12,
        total: 3,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    }
  );
  queryClient.setQueryData(['vendors-dropdown'], { data: mockVendors });
  queryClient.setQueryData(['users-dropdown'], { data: mockUsers });

  return queryClient;
}

describe('LicenseListPage Redesign Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. renders header, action button and utilization summary banner', () => {
    const qc = createTestQueryClient();
    const html = renderToStaticMarkup(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/licenses']}>
          <LicenseListPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(html).toContain('Software &amp; Asset Licenses');
    expect(html).toContain('Create License');

    // Utilization Summary Banner
    expect(html).toContain('License Capacity &amp; Renewals');
    expect(html).toContain('1 license at capacity');
    expect(html).toContain('1 expiring this month');
    expect(html).toContain('Active Contracts');
    expect(html).toContain('At Seat Limit');
    expect(html).toContain('Expiring (30d)');
  });

  it('2. renders filter bar with status, vendor, license type, expiry schedule and sort options', () => {
    const qc = createTestQueryClient();
    const html = renderToStaticMarkup(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/licenses']}>
          <LicenseListPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Search input
    expect(html).toContain('Search licenses or vendors...');

    // Filters
    expect(html).toContain('All Statuses');
    expect(html).toContain('Active Licenses');
    expect(html).toContain('All Vendors');
    expect(html).toContain('JetBrains s.r.o.');
    expect(html).toContain('Figma Inc');
    expect(html).toContain('All License Types');
    expect(html).toContain('Seat-Based Commercial');
    expect(html).toContain('Any Expiration');
    expect(html).toContain('Expiring in 30 Days');

    // Sort options: by expiry date, utilization %, cost, name
    expect(html).toContain('Expiry Date');
    expect(html).toContain('Utilization %');
    expect(html).toContain('Contract Cost');
    expect(html).toContain('License Name');
  });

  it('3. renders license cards with vendor logo initials, masked keys, progress bars, and badges', () => {
    const qc = createTestQueryClient();
    const html = renderToStaticMarkup(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/licenses']}>
          <LicenseListPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // License names
    expect(html).toContain('JetBrains All Products Pack');
    expect(html).toContain('Figma Enterprise Workspace');
    expect(html).toContain('PostgreSQL Enterprise Support');

    // Vendor logo initials ("JS" for JetBrains s.r.o., "FI" for Figma Inc, "EN" for EnterpriseDB)
    expect(html).toContain('JS');
    expect(html).toContain('FI');
    expect(html).toContain('EN');

    // Masked license keys (••••••••-XXXX)
    expect(html).toContain('••••••••-9821');
    expect(html).toContain('••••••••-4412');
    expect(html).toContain('••••••••-7731');

    // Seat utilization progress: used/total seats
    expect(html).toContain('25 / 30 seats (83%)');
    expect(html).toContain('20 / 20 seats (100%)');
    expect(html).toContain('15 / 50 seats (30%)');

    // Utilization bar colors (green <70%, amber 70-90%, red >90%)
    expect(html).toContain('bg-amber-500'); // 83.3%
    expect(html).toContain('bg-rose-500'); // 100%
    expect(html).toContain('bg-emerald-500'); // 30%

    // Status badges
    expect(html).toContain('ACTIVE');

    // Expiry countdown chips (red if <30 days, perpetual for null)
    expect(html).toContain('Expires in 12d'); // red <30d
    expect(html).toContain('45d remaining'); // >30d
    expect(html).toContain('Perpetual'); // null end date

    // Context menu trigger (3-dot)
    expect(html).toContain('Actions for JetBrains All Products Pack');
  });

  it('4. renders pagination at the bottom with result counts', () => {
    const qc = createTestQueryClient();
    const html = renderToStaticMarkup(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/licenses']}>
          <LicenseListPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(html).toContain('Showing');
    expect(html).toContain('results');
    expect(html).toContain('Page 1 of 1');
  });
});
