// ==============================================================================
// AssetVault: Modern ReportsPage Unit Test Suite
// Course: BCSE307L Database Systems (Fall 2026-27)
// Comprehensive test suite for 5-Tab Analytics Suite:
// Overview, License Health, Cost Analysis, Asset Compliance, and Access Trends.
// ==============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReportsPage } from '../pages/reports/ReportsPage';

// Mock contexts
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'usr-admin-1',
      fullName: 'Chief Data Officer',
      email: 'cdo@enterprise.com',
      role: 'TENANT_ADMIN',
      isSuperAdmin: false,
    },
    tenant: { id: 't-corp', name: 'Acme Enterprise', status: 'ACTIVE' },
    hasPermission: () => true,
    hasRole: () => true,
    logout: vi.fn(),
  }),
}));

const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
};

vi.mock('../context/ToastContext', () => ({
  useToast: () => mockToast,
}));

// Mock Data
const mockDashboardData = {
  tenant: { id: 't-corp', name: 'Acme Enterprise' },
  stats: {
    asset_count: 342,
    license_count: 24,
    active_allocated_seats: 185,
    total_contracted_seats: 250,
    expiring_licenses_30d: 4,
    total_license_spend: 125400,
    complianceScore: 94,
  },
};

const mockUtilizationData = [
  {
    license_id: 'lic-1',
    license_name: 'JetBrains All Products',
    vendor_name: 'JetBrains',
    total_seats: 50,
    used_seats: 48,
    available_seats: 2,
    utilization_pct: 96,
  },
  {
    license_id: 'lic-2',
    license_name: 'Figma Organization',
    vendor_name: 'Figma',
    total_seats: 40,
    used_seats: 32,
    available_seats: 8,
    utilization_pct: 80,
  },
  {
    license_id: 'lic-3',
    license_name: 'GitHub Enterprise',
    vendor_name: 'GitHub',
    total_seats: 60,
    used_seats: 35,
    available_seats: 25,
    utilization_pct: 58,
  },
];

const mockExpiringLicenses = [
  {
    license_id: 'lic-exp-1',
    license_name: 'Adobe Creative Cloud',
    vendor_name: 'Adobe Systems',
    total_seats: 30,
    active_allocations: 28,
    days_left: 4,
    urgency_bucket: 'CRITICAL',
    cost: 18000,
    auto_renew: true,
  },
  {
    license_id: 'lic-exp-2',
    license_name: 'Slack Enterprise Grid',
    vendor_name: 'Salesforce',
    total_seats: 100,
    active_allocations: 95,
    days_left: 22,
    urgency_bucket: 'WARNING',
    cost: 24000,
    auto_renew: false,
  },
  {
    license_id: 'lic-exp-3',
    license_name: 'Docker Business',
    vendor_name: 'Docker Inc',
    total_seats: 25,
    active_allocations: 20,
    days_left: 45,
    urgency_bucket: 'NOTICE',
    cost: 7500,
    auto_renew: true,
  },
];

const mockVendorSpend = [
  {
    vendor_id: 'v-1',
    vendor_name: 'Microsoft Corporation',
    contact_email: 'procurement@microsoft.com',
    license_count: 5,
    grand_total_spend: 64000,
    total_renewal_cost: 58000,
    avg_cost_per_seat: 420.5,
  },
  {
    vendor_id: 'v-2',
    vendor_name: 'Adobe Systems',
    contact_email: 'enterprise@adobe.com',
    license_count: 3,
    grand_total_spend: 36000,
    total_renewal_cost: 32000,
    avg_cost_per_seat: 600.0,
  },
  {
    vendor_id: 'v-3',
    vendor_name: 'JetBrains',
    contact_email: 'sales@jetbrains.com',
    license_count: 4,
    grand_total_spend: 25400,
    total_renewal_cost: 21000,
    avg_cost_per_seat: 340.0,
  },
];

const mockSpendByMonth = [
  {
    month_year: '2026-06',
    monthly_spend: 14000,
    running_total_spend: 14000,
  },
  {
    month_year: '2026-07',
    monthly_spend: 22000,
    running_total_spend: 36000,
  },
  {
    month_year: '2026-08',
    monthly_spend: 18000,
    running_total_spend: 54000,
  },
];

const mockTopAssets = [
  {
    asset_id: 'ast-1',
    asset_name: 'AssetVault UI Kit',
    asset_code: 'UIK-2026',
    asset_type: 'IMAGE',
    download_count: 485,
    rank: 1,
  },
  {
    asset_id: 'ast-2',
    asset_name: 'Helvetica Now Pro Font Package',
    asset_code: 'FNT-009',
    asset_type: 'FONT',
    download_count: 312,
    rank: 2,
  },
  {
    asset_id: 'ast-3',
    asset_name: 'PostgreSQL Advanced Driver Suite',
    asset_code: 'SFT-104',
    asset_type: 'SOFTWARE',
    download_count: 198,
    rank: 3,
  },
];

const mockUnlicensedAssets = [
  {
    asset_id: 'ast-un-1',
    asset_name: 'Oracle JDBC Enterprise Driver',
    asset_code: 'AST-901',
    asset_type: 'SOFTWARE',
    category_name: 'Database Connectors',
    owner_name: 'DevOps Lead',
    compliance_status: 'UNLICENSED',
  },
  {
    asset_id: 'ast-un-2',
    asset_name: 'Brand Video 4K Master',
    asset_code: 'AST-902',
    asset_type: 'VIDEO',
    category_name: 'Marketing Assets',
    owner_name: 'Design Director',
    compliance_status: 'EXPIRED_LICENSE',
  },
];

const mockAccessTrend = [
  {
    month_year: '2026-06',
    downloads: 140,
    download_count: 140,
    checkouts: 65,
    checkout_count: 65,
    checkins: 55,
    checkin_count: 55,
    total_access_events: 260,
  },
  {
    month_year: '2026-07',
    downloads: 210,
    download_count: 210,
    checkouts: 80,
    checkout_count: 80,
    checkins: 75,
    checkin_count: 75,
    total_access_events: 365,
  },
];

const mockComplianceData = {
  score: 94,
  grade: 'A',
  stats: {
    compliantAssets: 340,
    unlicensedAssets: 2,
    expiredLicenseAssets: 0,
  },
};

const mockCostOptData = {
  summary: {
    totalUnusedSeats: 12,
    potentialMonthlySavings: 2400,
    potentialAnnualSavings: 28800,
    averageCostPerSeat: 200,
  },
  reclaimCandidates: [
    {
      allocationId: 'alloc-1',
      licenseName: 'JetBrains All Products',
      userName: 'Inactive Engineer',
      userEmail: 'inactive@example.com',
      inactiveDays: 45,
      monthlyCostPerSeat: 50,
      potentialAnnualSaving: 600,
    },
  ],
};

// Mock API endpoints
vi.mock('../services/api', () => ({
  api: {
    get: vi.fn((url: string) => {
      if (url === '/reports/dashboard') return Promise.resolve(mockDashboardData);
      if (url === '/reports/license-utilization') return Promise.resolve(mockUtilizationData);
      if (url === '/reports/expiring-licenses') return Promise.resolve(mockExpiringLicenses);
      if (url === '/reports/vendor-spend') return Promise.resolve(mockVendorSpend);
      if (url === '/reports/spend-by-month') return Promise.resolve(mockSpendByMonth);
      if (url === '/reports/top-assets') return Promise.resolve(mockTopAssets);
      if (url === '/reports/unlicensed-assets') return Promise.resolve(mockUnlicensedAssets);
      if (url === '/reports/access-trend') return Promise.resolve(mockAccessTrend);
      if (url === '/reports/compliance') return Promise.resolve(mockComplianceData);
      if (url === '/reports/unused-seats') return Promise.resolve(mockCostOptData);
      if (url === '/licenses') return Promise.resolve({ data: { items: [] } });
      return Promise.resolve({ data: [] });
    }),
    post: vi.fn(() => Promise.resolve({ success: true })),
  },
  apiClient: {
    get: vi.fn(() => Promise.resolve({ data: 'col1,col2\nval1,val2' })),
  },
  getAccessToken: () => 'mock-jwt-token',
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const populateQueryCache = () => {
  const defaultParams = { range: '30d' };
  queryClient.setQueryData(['reports', 'dashboard', defaultParams], mockDashboardData);
  queryClient.setQueryData(['reports', 'license-utilization', defaultParams], mockUtilizationData);
  queryClient.setQueryData(['reports', 'expiring-licenses', defaultParams], mockExpiringLicenses);
  queryClient.setQueryData(['reports', 'vendor-spend', defaultParams], mockVendorSpend);
  queryClient.setQueryData(['reports', 'spend-by-month', defaultParams], mockSpendByMonth);
  queryClient.setQueryData(['reports', 'top-assets', defaultParams], mockTopAssets);
  queryClient.setQueryData(['reports', 'unlicensed-assets', defaultParams], mockUnlicensedAssets);
  queryClient.setQueryData(['reports', 'access-trend', defaultParams], mockAccessTrend);
  queryClient.setQueryData(['reports', 'compliance', defaultParams], mockComplianceData);
  queryClient.setQueryData(['reports', 'unused-seats', defaultParams], mockCostOptData);
};

const renderWithRouter = (initialUrl = '/reports') => {
  populateQueryCache();
  return renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialUrl]}>
        <ReportsPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('ReportsPage Modern Analytics Dashboard Test Suite', () => {
  beforeEach(() => {
    queryClient.clear();
    vi.clearAllMocks();
  });

  // ============================================================================
  // 1. Header & Controls
  // ============================================================================
  it('renders page header with live PostgreSQL badge and Export Tab CSV button', () => {
    const html = renderWithRouter();
    expect(html).toContain('Analytics &amp; Reporting');
    expect(html).toContain('PostgreSQL Engine');
    expect(html).toContain('Refresh');
    expect(html).toContain('Export Tab CSV');
  });

  it('renders preset date range buttons (30D, 90D, YTD, 12M, All, Custom)', () => {
    const html = renderWithRouter();
    expect(html).toContain('30D');
    expect(html).toContain('90D');
    expect(html).toContain('YTD');
    expect(html).toContain('12M');
    expect(html).toContain('All');
    expect(html).toContain('Custom');
  });

  // ============================================================================
  // 2. Tab Navigation Layout
  // ============================================================================
  it('renders all 5 tab navigation items with badge indicators', () => {
    const html = renderWithRouter();
    expect(html).toContain('Overview');
    expect(html).toContain('License Health');
    expect(html).toContain('Cost Analysis');
    expect(html).toContain('Asset Compliance');
    expect(html).toContain('Access Trends');
  });

  // ============================================================================
  // 3. Tab 1: Overview
  // ============================================================================
  it('renders grid of 6 metric tiles with values and sparkline containers', () => {
    const html = renderWithRouter('/reports?tab=overview');
    expect(html).toContain('Total Digital Assets');
    expect(html).toContain('342');

    expect(html).toContain('Active Licenses');
    expect(html).toContain('24');

    expect(html).toContain('Seat Utilization Rate');
    expect(html).toContain('74%'); // 185 / 250 = 74%

    expect(html).toContain('Expiring in 30 Days');
    expect(html).toContain('4');

    expect(html).toContain('Total License Spend');
    expect(html).toContain('$125,400');

    expect(html).toContain('Compliance Score');
    expect(html).toContain('94%');
    expect(html).toContain('Grade A');

    // Mini sparkline SVGs
    expect(html).toContain('spark-grad-assets');
    expect(html).toContain('spark-grad-licenses');
    expect(html).toContain('spark-grad-seats');
    expect(html).toContain('spark-grad-expiring');
    expect(html).toContain('spark-grad-spend');
    expect(html).toContain('spark-grad-compliance');
  });

  it('renders executive summary cards on Overview tab', () => {
    const html = renderWithRouter('/reports?tab=overview');
    expect(html).toContain('License Utilization Snapshot');
    expect(html).toContain('Asset Compliance &amp; Risk Status');
    expect(html).toContain('Enterprise Compliance Score');
  });

  // ============================================================================
  // 4. Tab 2: License Health
  // ============================================================================
  it('renders License Health tab with utilization chart and urgency heatmap rows', () => {
    const html = renderWithRouter('/reports?tab=health');
    expect(html).toContain('License Seat Utilization Matrix');
    expect(html).toContain('Expiring Licenses Alert Matrix (Urgency Heatmap)');

    // Licenses in expiring table
    expect(html).toContain('Adobe Creative Cloud');
    expect(html).toContain('CRITICAL');
    expect(html).toContain('Slack Enterprise Grid');
    expect(html).toContain('WARNING');
    expect(html).toContain('Docker Business');
    expect(html).toContain('NOTICE');

    // Heatmap urgency classes
    expect(html).toContain('border-l-rose-500');
    expect(html).toContain('border-l-amber-500');
    expect(html).toContain('border-l-indigo-500');
  });

  // ============================================================================
  // 5. Tab 3: Cost Analysis
  // ============================================================================
  it('renders Cost Analysis tab with ComposedChart, vendor spend, and top 5 cards', () => {
    const html = renderWithRouter('/reports?tab=cost');
    expect(html).toContain('Monthly Spend &amp; Cumulative Running Total');
    expect(html).toContain('Vendor Procurement &amp; Renewal Volume');
    expect(html).toContain('Top 5 Most Expensive Vendors');

    // Vendor Cards
    expect(html).toContain('Microsoft Corporation');
    expect(html).toContain('$64,000');
    expect(html).toContain('Adobe Systems');
    expect(html).toContain('$36,000');
    expect(html).toContain('JetBrains');
    expect(html).toContain('$25,400');

    // Dormant seat reclamation section
    expect(html).toContain('Dormant Seat Reclamation Candidates');
    expect(html).toContain('Inactive Engineer');
    expect(html).toContain('Release Seat');
  });

  // ============================================================================
  // 6. Tab 4: Asset Compliance
  // ============================================================================
  it('renders Asset Compliance tab with donut distribution, guard cards, and Assign License quick actions', () => {
    const html = renderWithRouter('/reports?tab=compliance');
    expect(html).toContain('Asset Compliance Distribution');
    expect(html).toContain('PostgreSQL Automated Compliance Guard');
    expect(html).toContain('Unlicensed &amp; Expired Digital Assets');

    // Unlicensed table rows
    expect(html).toContain('Oracle JDBC Enterprise Driver');
    expect(html).toContain('AST-901');
    expect(html).toContain('Brand Video 4K Master');
    expect(html).toContain('AST-902');

    // Quick Action button
    expect(html).toContain('Assign License');
  });

  // ============================================================================
  // 7. Tab 5: Access Trends
  // ============================================================================
  it('renders Access Trends tab with stacked area chart and top 10 ranked assets', () => {
    const html = renderWithRouter('/reports?tab=trends');
    expect(html).toContain('Monthly Access Activity');
    expect(html).toContain('Top 10 Most Downloaded Assets');

    // Top ranked assets
    expect(html).toContain('AssetVault UI Kit');
    expect(html).toContain('UIK-2026');
    expect(html).toContain('485 Downloads');
    expect(html).toContain('#1');

    expect(html).toContain('Helvetica Now Pro Font Package');
    expect(html).toContain('FNT-009');
    expect(html).toContain('312 Downloads');
    expect(html).toContain('#2');

    expect(html).toContain('PostgreSQL Advanced Driver Suite');
    expect(html).toContain('SFT-104');
    expect(html).toContain('198 Downloads');
    expect(html).toContain('#3');
  });
});
