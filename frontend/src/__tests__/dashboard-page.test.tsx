// ==============================================================================
// AssetVault: Modern DashboardPage Unit Test Suite
// ==============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardPage } from '../pages/dashboard/DashboardPage';

// Mock contexts
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'usr-1',
      fullName: 'Alex Admin',
      email: 'alex@example.com',
      role: 'TENANT_ADMIN',
      isSuperAdmin: false,
    },
    tenant: { id: 't-1', name: 'TechCorp', status: 'ACTIVE' },
    hasPermission: () => true,
    hasRole: () => true,
    logout: vi.fn(),
  }),
}));

// Mock API endpoints
vi.mock('../services/api', () => ({
  api: {
    get: vi.fn((url: string) => {
      if (url === '/reports/dashboard') {
        return Promise.resolve({
          data: {
            tenant: { id: 't-1', name: 'TechCorp' },
            stats: {
              asset_count: 142,
              license_count: 18,
              user_count: 35,
              active_allocated_seats: 86,
              total_contracted_seats: 120,
              expiring_licenses_30d: 3,
              unlicensed_assets_count: 2,
              total_license_spend: 48500,
            },
          },
        });
      }
      if (url === '/reports/license-utilization') {
        return Promise.resolve({
          data: [
            {
              license_id: 'lic-1',
              license_name: 'JetBrains All Products',
              vendor_name: 'JetBrains',
              total_seats: 30,
              used_seats: 25,
              available_seats: 5,
              utilization_pct: 83.3,
            },
            {
              license_id: 'lic-2',
              license_name: 'Figma Enterprise',
              vendor_name: 'Figma Inc',
              total_seats: 20,
              used_seats: 18,
              available_seats: 2,
              utilization_pct: 90.0,
            },
          ],
        });
      }
      if (url === '/reports/expiring-licenses') {
        return Promise.resolve({
          data: [
            {
              license_id: 'lic-exp-1',
              license_name: 'Adobe Creative Cloud',
              vendor_name: 'Adobe',
              total_seats: 25,
              days_left: 12,
              urgency_bucket: 'WARNING',
              auto_renew: true,
            },
            {
              license_id: 'lic-exp-2',
              license_name: 'GitHub Enterprise',
              vendor_name: 'GitHub',
              total_seats: 50,
              days_left: 4,
              urgency_bucket: 'CRITICAL',
              auto_renew: false,
            },
          ],
        });
      }
      if (url === '/reports/access-trend') {
        return Promise.resolve({
          data: [
            {
              month_year: '2026-08',
              download_count: 45,
              checkout_count: 18,
              total_access_events: 63,
            },
            {
              month_year: '2026-09',
              download_count: 62,
              checkout_count: 24,
              total_access_events: 86,
            },
          ],
        });
      }
      if (url === '/reports/compliance') {
        return Promise.resolve({
          score: 92,
          grade: 'A',
          summary: 'All digital assets and seat allocations are in good standing.',
          factors: [
            { name: 'Asset License Coverage', earned: 38, weight: 40, status: 'OPTIMAL' },
            { name: 'Seat Over-Allocation Guard', earned: 25, weight: 25, status: 'OPTIMAL' },
          ],
          remediationItems: [],
        });
      }
      return Promise.resolve({ data: [] });
    }),
    patch: vi.fn(() => Promise.resolve({ success: true })),
  },
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const renderWithProviders = (ui: React.ReactElement) => {
  return renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/']}>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
};

describe('DashboardPage Modern Analytics Layout Suite', () => {
  beforeEach(() => {
    queryClient.clear();
    vi.clearAllMocks();
  });

  it('renders page header with live sync badge and Refresh button', () => {
    const html = renderWithProviders(<DashboardPage />);
    expect(html).toContain('Operational Analytics');
    expect(html).toContain('Live Sync');
    expect(html).toContain('Refresh');
  });

  it('renders 4 KPI stat cards (Total Assets, Active Licenses, Seats Used, Expiring in 30d)', () => {
    // Pre-populate query cache
    queryClient.setQueryData(['reports', 'dashboard'], {
      stats: {
        asset_count: 142,
        license_count: 18,
        active_allocated_seats: 86,
        total_contracted_seats: 120,
        expiring_licenses_30d: 3,
      },
    });

    const html = renderWithProviders(<DashboardPage />);
    expect(html).toContain('Total Assets');
    expect(html).toContain('142');
    expect(html).toContain('+12.4%');

    expect(html).toContain('Active Licenses');
    expect(html).toContain('18');
    expect(html).toContain('+8.5%');

    expect(html).toContain('Seats Used');
    expect(html).toContain('86');
    expect(html).toContain('/ 120');

    expect(html).toContain('Expiring in 30d');
    expect(html).toContain('Action req');
  });

  it('renders License Seat Utilization and Compliance Health semi-circle gauge', () => {
    queryClient.setQueryData(['reports', 'dashboard'], { stats: {} });
    queryClient.setQueryData(['reports', 'license-utilization'], [
      {
        license_id: 'lic-1',
        license_name: 'JetBrains All Products',
        vendor_name: 'JetBrains',
        used_seats: 25,
        available_seats: 5,
      },
    ]);
    queryClient.setQueryData(['reports', 'compliance'], {
      score: 92,
      grade: 'A',
      summary: 'All assets in good standing',
      factors: [],
    });

    const html = renderWithProviders(<DashboardPage />);
    expect(html).toContain('License Seat Utilization');
    expect(html).toContain('Used seats vs available seats');
    expect(html).toContain('Compliance Health');
    expect(html).toContain('Grade A');
    expect(html).toContain('92%');
  });

  it('renders Expiring Licenses watchlist table with auto-renew toggle chips', () => {
    queryClient.setQueryData(['reports', 'dashboard'], { stats: {} });
    queryClient.setQueryData(['reports', 'expiring-licenses'], [
      {
        license_id: 'lic-exp-1',
        license_name: 'Adobe Creative Cloud',
        vendor_name: 'Adobe',
        days_left: 12,
        auto_renew: true,
      },
      {
        license_id: 'lic-exp-2',
        license_name: 'GitHub Enterprise',
        vendor_name: 'GitHub',
        days_left: 4,
        auto_renew: false,
      },
    ]);

    const html = renderWithProviders(<DashboardPage />);
    expect(html).toContain('Expiring Licenses Watchlist');
    expect(html).toContain('Adobe Creative Cloud');
    expect(html).toContain('12d left');
    expect(html).toContain('Auto-renew ON');
    expect(html).toContain('GitHub Enterprise');
    expect(html).toContain('4d left');
    expect(html).toContain('Auto-renew OFF');
  });

  it('renders Asset Access Activity Trend area chart section', () => {
    queryClient.setQueryData(['reports', 'dashboard'], { stats: {} });
    queryClient.setQueryData(['reports', 'access-trend'], [
      {
        month_year: '2026-08',
        download_count: 45,
        checkout_count: 18,
      },
    ]);

    const html = renderWithProviders(<DashboardPage />);
    expect(html).toContain('Asset Access Activity Trend');
    expect(html).toContain('Monthly DOWNLOAD and CHECKOUT events');
  });
});
