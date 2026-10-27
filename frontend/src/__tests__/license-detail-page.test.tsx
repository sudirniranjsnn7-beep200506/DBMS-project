// ==============================================================================
// AssetVault: LicenseDetailPage Unit Test Suite
// Multi-tab layout: Overview, Allocations, Covered Assets, Renewals, Audit Trail
// ==============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LicenseDetailPage } from '../pages/licenses/LicenseDetailPage';

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

const mockLicense = {
  id: 'lic-jetbrains-01',
  license_id: 'lic-jetbrains-01',
  name: 'JetBrains All Products Pack',
  license_name: 'JetBrains All Products Pack',
  licenseKey: 'JB-ENT-2026-X992-8812',
  license_key: 'JB-ENT-2026-X992-8812',
  vendor: { id: 'v-1', name: 'JetBrains s.r.o.' },
  vendor_name: 'JetBrains s.r.o.',
  licenseType: { id: 3, name: 'SEAT_BASED', isSeatBased: true },
  license_type: 'SEAT_BASED',
  totalSeats: 50,
  total_seats: 50,
  usedSeats: 35,
  used_seats: 35,
  availableSeats: 15,
  available_seats: 15,
  utilization_pct: 70.0,
  days_to_expiry: 45,
  status: 'ACTIVE',
  startDate: '2026-01-01T00:00:00Z',
  start_date: '2026-01-01T00:00:00Z',
  endDate: '2026-12-31T23:59:59Z',
  end_date: '2026-12-31T23:59:59Z',
  cost: 12500.0,
  currency: 'USD',
  autoRenew: true,
  auto_renew: true,
  notes: 'Enterprise developer suite for all product engineering teams.',
};

const mockAllocations = [
  {
    id: 'alloc-01',
    allocation_id: 'alloc-01',
    licenseId: 'lic-jetbrains-01',
    userId: 'usr-101',
    allocatedAt: '2026-02-15T10:00:00Z',
    allocated_at: '2026-02-15T10:00:00Z',
    status: 'ACTIVE',
    notes: 'Primary dev machine',
    user: {
      id: 'usr-101',
      fullName: 'Alex Vance',
      email: 'alex.vance@blackmesa.internal',
      department: 'Engineering',
      avatarUrl: null,
    },
  },
  {
    id: 'alloc-02',
    allocation_id: 'alloc-02',
    licenseId: 'lic-jetbrains-01',
    userId: 'usr-102',
    allocatedAt: '2026-03-01T14:30:00Z',
    allocated_at: '2026-03-01T14:30:00Z',
    status: 'ACTIVE',
    notes: 'Secondary workstation',
    user: {
      id: 'usr-102',
      fullName: 'Gordon Freeman',
      email: 'gordon.freeman@blackmesa.internal',
      department: 'Research & Development',
      avatarUrl: null,
    },
  },
];

const mockCoveredAssets = [
  {
    id: 'ast-intellij-01',
    name: 'IntelliJ IDEA Ultimate 2026.2',
    assetCode: 'AST-SW-0081',
    type: 'SOFTWARE',
    assetType: 'SOFTWARE',
    complianceStatus: 'COMPLIANT',
    description: 'Lead IDE for backend JVM microservices development.',
    fileUrl: 'https://storage.blackmesa.internal/bin/intellij-2026.2.dmg',
    createdAt: '2026-01-10T09:00:00Z',
    owner: {
      id: 'usr-101',
      fullName: 'Alex Vance',
      avatarUrl: null,
    },
  },
  {
    id: 'ast-pycharm-02',
    name: 'PyCharm Professional 2026.1',
    assetCode: 'AST-SW-0082',
    type: 'SOFTWARE',
    assetType: 'SOFTWARE',
    complianceStatus: 'COMPLIANT',
    description: 'Python AI & ML modeling IDE suite.',
    fileUrl: 'https://storage.blackmesa.internal/bin/pycharm-2026.1.dmg',
    createdAt: '2026-01-12T11:00:00Z',
    owner: {
      id: 'usr-102',
      fullName: 'Gordon Freeman',
      avatarUrl: null,
    },
  },
];

const mockRenewals = [
  {
    id: 'rnw-01',
    renewal_id: 'rnw-01',
    licenseId: 'lic-jetbrains-01',
    oldEndDate: '2025-12-31T23:59:59Z',
    newEndDate: '2026-12-31T23:59:59Z',
    cost: 12500.0,
    currency: 'USD',
    notes: 'Annual renewal approved by Procurement Committee for FY2026',
    createdAt: '2025-12-15T10:00:00Z',
    renewedAt: '2025-12-15T10:00:00Z',
  },
  {
    id: 'rnw-00',
    renewal_id: 'rnw-00',
    licenseId: 'lic-jetbrains-01',
    oldEndDate: '2024-12-31T23:59:59Z',
    newEndDate: '2025-12-31T23:59:59Z',
    cost: 11000.0,
    currency: 'USD',
    notes: 'Original contract extension from FY2024 to FY2025',
    createdAt: '2024-12-20T14:15:00Z',
    renewedAt: '2024-12-20T14:15:00Z',
  },
];

const mockAuditLogs = [
  {
    id: 'aud-001',
    action: 'UPDATE',
    tableName: 'licenses',
    recordId: 'lic-jetbrains-01',
    performedAt: '2026-03-10T12:00:00Z',
    user: {
      fullName: 'Sarah Connor',
      email: 'sarah@example.com',
    },
    oldData: { totalSeats: 40, cost: 10000.0 },
    newData: { totalSeats: 50, cost: 12500.0 },
  },
  {
    id: 'aud-002',
    action: 'INSERT',
    tableName: 'licenses',
    recordId: 'lic-jetbrains-01',
    performedAt: '2026-03-01T14:30:00Z',
    user: {
      fullName: 'Sarah Connor',
      email: 'sarah@example.com',
    },
    oldData: null,
    newData: { totalSeats: 40, cost: 10000.0 },
  },
];

// Mock API
vi.mock('../services/api', () => ({
  api: {
    get: vi.fn((url: string) => {
      if (url === '/licenses/lic-jetbrains-01') {
        return Promise.resolve({ data: mockLicense });
      }
      if (url === '/licenses/lic-jetbrains-01/allocations') {
        return Promise.resolve({ data: mockAllocations, meta: { total: 2 } });
      }
      if (url === '/licenses/lic-jetbrains-01/assets') {
        return Promise.resolve({ data: mockCoveredAssets });
      }
      if (url === '/licenses/lic-jetbrains-01/renewals') {
        return Promise.resolve({ data: mockRenewals });
      }
      if (url.startsWith('/audit-logs')) {
        return Promise.resolve({ data: mockAuditLogs, meta: { total: 2 } });
      }
      if (url === '/users') {
        return Promise.resolve({ data: [{ id: 'usr-3', fullName: 'Eli Vance', email: 'eli@example.com' }] });
      }
      if (url === '/assets') {
        return Promise.resolve({ data: mockCoveredAssets });
      }
      if (url === '/vendors') {
        return Promise.resolve({ data: [{ id: 'v-1', name: 'JetBrains s.r.o.' }] });
      }
      return Promise.resolve({ data: [] });
    }),
    post: vi.fn().mockResolvedValue({ data: { success: true } }),
    patch: vi.fn().mockResolvedValue({ data: { success: true } }),
    delete: vi.fn().mockResolvedValue({ data: { success: true } }),
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

  queryClient.setQueryData(['license', 'lic-jetbrains-01'], { data: mockLicense });
  queryClient.setQueryData(['license', 'lic-jetbrains-01', 'allocations'], {
    data: mockAllocations,
    meta: { total: 2 },
  });
  queryClient.setQueryData(['license', 'lic-jetbrains-01', 'assets'], {
    data: mockCoveredAssets,
  });
  queryClient.setQueryData(['license', 'lic-jetbrains-01', 'renewals'], {
    data: mockRenewals,
  });
  queryClient.setQueryData(['audit-logs', 'license', 'lic-jetbrains-01', 1], {
    data: mockAuditLogs,
    meta: { total: 2 },
  });

  return queryClient;
}

describe('LicenseDetailPage Unit Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. renders header with license name, vendor chip, active status, contract info and action buttons', () => {
    const qc = createTestQueryClient();
    const html = renderToStaticMarkup(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/licenses/lic-jetbrains-01']}>
          <Routes>
            <Route path="/licenses/:id" element={<LicenseDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Header Details
    expect(html).toContain('JetBrains All Products Pack');
    expect(html).toContain('JetBrains s.r.o.');
    expect(html).toContain('ACTIVE');
    expect(html).toContain('Contract ID:');
    expect(html).toContain('SEAT_BASED');
    expect(html).toContain('USD');

    // Header Action Buttons
    expect(html).toContain('Renew');
    expect(html).toContain('Export PDF');
    expect(html).toContain('Edit');
    expect(html).toContain('Delete');
  });

  it('2. renders 5 tab navigation items with correct tab labels and badges', () => {
    const qc = createTestQueryClient();
    const html = renderToStaticMarkup(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/licenses/lic-jetbrains-01']}>
          <Routes>
            <Route path="/licenses/:id" element={<LicenseDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(html).toContain('Overview');
    expect(html).toContain('Allocations (2)');
    expect(html).toContain('Covered Assets (2)');
    expect(html).toContain('Renewals (2)');
    expect(html).toContain('Audit Trail');
  });

  it('3. renders Overview tab: masked key card, validity dates, cost, auto-renew, and donut utilization chart', () => {
    const qc = createTestQueryClient();
    const html = renderToStaticMarkup(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/licenses/lic-jetbrains-01']}>
          <Routes>
            <Route path="/licenses/:id" element={<LicenseDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Left Column: Credentials & Key info
    expect(html).toContain('License Key &amp; Credentials');
    expect(html).toContain('Audited Access');
    expect(html).toContain('Reveal');
    expect(html).toContain('Copy');

    // Left Column: Contract Dates
    expect(html).toContain('Contract Terms &amp; Schedule');
    expect(html).toContain('Effective Start Date');
    expect(html).toContain('Expiration Date');
    expect(html).toContain('Auto-Renewal Schedule');
    expect(html).toContain('Auto-Renew Enabled');

    // Left Column: Cost & Model
    expect(html).toContain('Financials &amp; Commercial Pricing');
    expect(html).toContain('Total Contract Cost');
    expect(html).toContain('$12500.00 USD');
    expect(html).toContain('Cost per Contracted Seat');
    expect(html).toContain('$250.00 / seat');
    expect(html).toContain('Licensing Model');

    // Right Column: Donut chart & Seat metrics
    expect(html).toContain('Seat Utilization Donut');
    expect(html).toContain('70% Utilized');
    expect(html).toContain('Allocated (35)');
    expect(html).toContain('Available (15)');
    expect(html).toContain('Compliance Summary');
    expect(html).toContain('COMPLIANT');
    expect(html).toContain('Quota Allocation Advisory');
    expect(html).toContain('15 seats remain available');
    expect(html).toContain('Asset Attachment Status');
    expect(html).toContain('Covering 2 enterprise repository assets');
  });

  it('4. renders Allocations tab with active seat holders table and Allocate Seat button', () => {
    const qc = createTestQueryClient();
    const html = renderToStaticMarkup(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/licenses/lic-jetbrains-01?tab=allocations']}>
          <Routes>
            <Route path="/licenses/:id" element={<LicenseDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(html).toContain('Seat Allocations Ledger');
    expect(html).toContain('sp_allocate_license_seat');
    expect(html).toContain('Allocate Seat');
    expect(html).toContain('Alex Vance');
    expect(html).toContain('alex.vance@blackmesa.internal');
    expect(html).toContain('Gordon Freeman');
    expect(html).toContain('gordon.freeman@blackmesa.internal');
    expect(html).toContain('Primary dev machine');
    expect(html).toContain('Secondary workstation');
    expect(html).toContain('Release');
  });

  it('5. renders Covered Assets tab with linked asset cards and Link Asset button', () => {
    const qc = createTestQueryClient();
    const html = renderToStaticMarkup(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/licenses/lic-jetbrains-01?tab=assets']}>
          <Routes>
            <Route path="/licenses/:id" element={<LicenseDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(html).toContain('Covered Digital Assets');
    expect(html).toContain('Link Asset');
    expect(html).toContain('AST-SW-0081');
    expect(html).toContain('IntelliJ IDEA Ultimate 2026.2');
    expect(html).toContain('AST-SW-0082');
    expect(html).toContain('PyCharm Professional 2026.1');
    expect(html).toContain('COMPLIANT');
    expect(html).toContain('View Asset');
  });

  it('6. renders Renewals tab with timeline cards, previous/new dates, and cost', () => {
    const qc = createTestQueryClient();
    const html = renderToStaticMarkup(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/licenses/lic-jetbrains-01?tab=renewals']}>
          <Routes>
            <Route path="/licenses/:id" element={<LicenseDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(html).toContain('Renewal Term Timeline');
    expect(html).toContain('sp_renew_license');
    expect(html).toContain('Renew Contract');
    expect(html).toContain('Contract Extension');
    expect(html).toContain('Previous End Date');
    expect(html).toContain('Extended End Date');
    expect(html).toContain('$12500.00 USD');
    expect(html).toContain('Annual renewal approved by Procurement Committee for FY2026');
  });

  it('7. renders Audit Trail tab with immutable ledger records and diffs', () => {
    const qc = createTestQueryClient();
    const html = renderToStaticMarkup(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/licenses/lic-jetbrains-01?tab=audit']}>
          <Routes>
            <Route path="/licenses/:id" element={<LicenseDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(html).toContain('Immutable Audit Trail');
    expect(html).toContain('audit_logs');
    expect(html).toContain('Sarah Connor');
    expect(html).toContain('sarah@example.com');
    expect(html).toContain('UPDATE');
    expect(html).toContain('INSERT');
  });

  it('8. renders not-found state when license does not exist or fetch fails', () => {
    const emptyQc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    emptyQc.setQueryData(['license', 'lic-missing'], null);

    const html = renderToStaticMarkup(
      <QueryClientProvider client={emptyQc}>
        <MemoryRouter initialEntries={['/licenses/lic-missing']}>
          <Routes>
            <Route path="/licenses/:id" element={<LicenseDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(html).toContain('License Not Found');
    expect(html).toContain('Back to Licenses');
  });
});
