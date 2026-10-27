// ==============================================================================
// AssetVault: Modern Enterprise Analytics & Reporting Dashboard
// Course: BCSE307L Database Systems (Fall 2026-27)
// Full 5-Tab Analytics Suite: Overview, License Health, Cost Analysis,
// Asset Compliance, and Access Trends with interactive Recharts, Urgency Heatmaps,
// Date Range filtering, and contextual CSV Exports.
// ==============================================================================

import React, { useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileSpreadsheet,
  BarChart3,
  TrendingUp,
  Download,
  AlertTriangle,
  Store,
  Activity,
  Award,
  Coins,
  UserX,
  Package,
  KeyRound,
  Users,
  ShieldCheck,
  RefreshCw,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  ExternalLink,
  PlusCircle,
  Clock,
  Sparkles,
  Database,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Line,
  AreaChart,
  Area,
  ComposedChart,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { api, apiClient, getAccessToken } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { Modal } from '../../components/common/Modal';
import { EmptyState } from '../../components/common/EmptyState';
import { StatusBadge } from '../../components/common/StatusBadge';
import { cn } from '../../utils/cn';

// ==============================================================================
// Types & Helpers
// ==============================================================================

export type ReportTab = 'overview' | 'health' | 'cost' | 'compliance' | 'trends';
export type DateRangePreset = '30d' | '90d' | 'ytd' | '12m' | 'all' | 'custom';

export const toNum = (val: any): number => {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') return parseFloat(val) || 0;
  if (typeof val === 'object') {
    if (val.d && Array.isArray(val.d)) {
      if (typeof val.toString === 'function') {
        const s = val.toString();
        if (s !== '[object Object]') return parseFloat(s) || 0;
      }
      return val.d[0] ?? 0;
    }
    if (typeof val.toString === 'function') {
      const s = val.toString();
      if (s !== '[object Object]') return parseFloat(s) || 0;
    }
  }
  return Number(val) || 0;
};

export const formatNumber = (val: number | string): string =>
  Number(val || 0).toLocaleString('en-US');

export const formatCurrency = (val: number | string): string =>
  `$${Number(val || 0).toLocaleString('en-US')}`;

// Mini Sparkline SVG for Metric Tiles
interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
  id: string;
}

const Sparkline: React.FC<SparklineProps> = ({ data, color = '#6366f1', height = 32, id }) => {
  if (!data || data.length === 0) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 100;
  const padding = 2;
  const h = height - padding * 2;

  const points = data
    .map((val, idx) => {
      const x = padding + (idx / Math.max(1, data.length - 1)) * (width - padding * 2);
      const y = height - padding - ((val - min) / range) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const firstX = padding;
  const lastX = width - padding;
  const areaPoints = `${points} ${lastX},${height} ${firstX},${height}`;
  const gradientId = `spark-grad-${id}-${color.replace('#', '')}`;

  return (
    <svg width={width} height={height} className="overflow-visible shrink-0" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0.0} />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#${gradientId})`} />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
};

// Custom Chart Tooltip
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-700/80 rounded-lg p-2.5 shadow-xl text-xs text-slate-100 z-50">
      <p className="font-semibold text-slate-300 border-b border-slate-800 pb-1 mb-1.5">{label}</p>
      {payload.map((entry: any, index: number) => (
        <div key={`item-${index}`} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
            <span className="text-slate-400">{entry.name}:</span>
          </span>
          <span className="font-mono font-bold text-white">
            {typeof entry.value === 'number'
              ? formatNumber(entry.value)
              : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// ==============================================================================
// Main ReportsPage Component
// ==============================================================================

export const ReportsPage: React.FC = () => {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const canManageAllocations = hasPermission('allocations:manage_all');
  const canManageLicenses = hasPermission('licenses:update') || hasPermission('licenses:link_asset');

  // URL state synchronization
  const rawTab = searchParams.get('tab') as ReportTab;
  const activeTab: ReportTab = ['overview', 'health', 'cost', 'compliance', 'trends'].includes(rawTab)
    ? rawTab
    : 'overview';

  const rawRange = searchParams.get('range') as DateRangePreset;
  const dateRange: DateRangePreset = ['30d', '90d', 'ytd', '12m', 'all', 'custom'].includes(rawRange)
    ? rawRange
    : '30d';

  const customStart = searchParams.get('from') || '';
  const customEnd = searchParams.get('to') || '';

  const [startDateInput, setStartDateInput] = useState(customStart);
  const [endDateInput, setEndDateInput] = useState(customEnd);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Quick Action Modal: Assign License to Unlicensed Asset
  const [assignModalAsset, setAssignModalAsset] = useState<any | null>(null);
  const [selectedLicenseId, setSelectedLicenseId] = useState<string>('');

  // Tab change handler
  const setActiveTab = (tab: ReportTab) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next, { replace: true });
  };

  // Date range change handler
  const setDateRange = (range: DateRangePreset) => {
    const next = new URLSearchParams(searchParams);
    next.set('range', range);
    if (range !== 'custom') {
      next.delete('from');
      next.delete('to');
    }
    setSearchParams(next, { replace: true });
  };

  const applyCustomDates = () => {
    const next = new URLSearchParams(searchParams);
    next.set('range', 'custom');
    if (startDateInput) next.set('from', startDateInput);
    if (endDateInput) next.set('to', endDateInput);
    setSearchParams(next, { replace: true });
  };

  // Query parameters passed to endpoints
  const queryFilterParams = useMemo(() => {
    const params: Record<string, string> = { range: dateRange };
    if (dateRange === 'custom') {
      if (customStart) params.startDate = customStart;
      if (customEnd) params.endDate = customEnd;
    }
    return params;
  }, [dateRange, customStart, customEnd]);

  // ============================================================================
  // Data Queries
  // ============================================================================

  // 1. Dashboard Consolidated Stats (KPIs)
  const { data: dashboardRes, isLoading: isDashboardLoading } = useQuery({
    queryKey: ['reports', 'dashboard', queryFilterParams],
    queryFn: async () => {
      const res = await api.get<any>('/reports/dashboard', { params: queryFilterParams });
      return (res as any)?.data || res;
    },
  });

  // 2. License Utilization (v_license_utilization)
  const { data: utilizationData = [], isLoading: isUtilLoading } = useQuery({
    queryKey: ['reports', 'license-utilization', queryFilterParams],
    queryFn: async () => {
      const res = await api.get<any[]>('/reports/license-utilization', { params: queryFilterParams });
      const list = Array.isArray(res) ? res : (res as any).data || [];
      return list.map((r: any) => ({
        ...r,
        id: r.license_id || r.id,
        license_id: r.license_id || r.id,
        name: r.license_name || r.name,
        license_name: r.license_name || r.name,
        total_seats: toNum(r.total_seats),
        used_seats: toNum(r.used_seats),
        available_seats: toNum(r.available_seats),
        utilization_pct: toNum(r.utilization_pct),
        days_to_expiry: toNum(r.days_to_expiry),
      }));
    },
  });

  // 3. Expiring Licenses (v_expiring_licenses)
  const { data: expiringData = [], isLoading: isExpiringLoading } = useQuery({
    queryKey: ['reports', 'expiring-licenses', queryFilterParams],
    queryFn: async () => {
      const res = await api.get<any[]>('/reports/expiring-licenses', { params: queryFilterParams });
      const list = Array.isArray(res) ? res : (res as any).data || [];
      return list.map((r: any) => ({
        ...r,
        id: r.license_id || r.id,
        license_id: r.license_id || r.id,
        license_name: r.license_name || r.name,
        vendor_name: r.vendor_name || 'Independent',
        total_seats: toNum(r.total_seats),
        active_allocations: toNum(r.active_allocations ?? r.used_seats),
        days_left: toNum(r.days_left),
        urgency_bucket: (r.urgency_bucket || 'NORMAL').toUpperCase(),
        cost: toNum(r.cost),
        auto_renew: Boolean(r.auto_renew),
      }));
    },
  });

  // 4. Vendor Spend (v_vendor_spend)
  const { data: vendorSpendData = [], isLoading: isVendorLoading } = useQuery({
    queryKey: ['reports', 'vendor-spend', queryFilterParams],
    queryFn: async () => {
      const res = await api.get<any[]>('/reports/vendor-spend', { params: queryFilterParams });
      const list = Array.isArray(res) ? res : (res as any).data || [];
      return list.map((r: any) => ({
        ...r,
        vendor_id: r.vendor_id || r.id,
        vendor_name: r.vendor_name || 'Direct Software',
        license_count: toNum(r.license_count),
        total_initial_cost: toNum(r.total_initial_cost),
        total_renewal_cost: toNum(r.total_renewal_cost ?? r.renewal_cost),
        grand_total_spend: toNum(r.grand_total_spend ?? r.total_cost),
        total_seats_contracted: toNum(r.total_seats_contracted),
        avg_cost_per_seat: toNum(r.avg_cost_per_seat),
      }));
    },
  });

  // 5. Monthly Spend & Cumulative Running Total (Window Function)
  const { data: monthlySpendData = [], isLoading: isMonthlyLoading } = useQuery({
    queryKey: ['reports', 'spend-by-month', queryFilterParams],
    queryFn: async () => {
      const res = await api.get<any[]>('/reports/spend-by-month', { params: queryFilterParams });
      const list = Array.isArray(res) ? res : (res as any).data || [];
      return list.map((r: any) => ({
        ...r,
        month_year: r.month_year || r.month,
        monthly_spend: toNum(r.monthly_spend),
        running_total_spend: toNum(r.running_total_spend ?? r.running_total),
      }));
    },
  });

  // 6. Top Most Downloaded Assets (Window Function Rank)
  const { data: topAssetsData = [], isLoading: isTopLoading } = useQuery({
    queryKey: ['reports', 'top-assets', queryFilterParams],
    queryFn: async () => {
      const res = await api.get<any[]>('/reports/top-assets', { params: queryFilterParams });
      const list = Array.isArray(res) ? res : (res as any).data || [];
      return list.map((r: any) => ({
        ...r,
        asset_id: r.asset_id || r.id,
        asset_name: r.asset_name || r.name,
        asset_code: r.asset_code || 'AST-000',
        asset_type: r.asset_type || 'DIGITAL',
        download_count: toNum(r.download_count),
        rank: toNum(r.rank ?? r.download_rank),
      }));
    },
  });

  // 7. Unlicensed & Expired Assets
  const { data: unlicensedData = [], isLoading: isUnlicensedLoading } = useQuery({
    queryKey: ['reports', 'unlicensed-assets', queryFilterParams],
    queryFn: async () => {
      const res = await api.get<any[]>('/reports/unlicensed-assets', { params: queryFilterParams });
      const list = Array.isArray(res) ? res : (res as any).data || [];
      return list.map((r: any) => ({
        ...r,
        asset_id: r.asset_id || r.id,
        asset_name: r.asset_name || r.name,
        asset_code: r.asset_code || 'N/A',
        asset_type: r.asset_type || 'DOCUMENT',
        category_name: r.category_name || 'Uncategorized',
        owner_name: r.owner_name || 'Unknown',
        compliance_status: r.compliance_status || 'UNLICENSED',
      }));
    },
  });

  // 8. Monthly Access Trends (mv_monthly_access_stats)
  const { data: accessTrendsData = [], isLoading: isTrendsLoading } = useQuery({
    queryKey: ['reports', 'access-trend', queryFilterParams],
    queryFn: async () => {
      const res = await api.get<any[]>('/reports/access-trend', { params: queryFilterParams });
      const list = Array.isArray(res) ? res : (res as any).data || [];
      return list.map((r: any) => ({
        ...r,
        month: r.month_year || r.month,
        downloads: toNum(r.download_count ?? r.downloads),
        checkouts: toNum(r.checkout_count ?? r.checkouts),
        checkins: toNum(r.checkin_count ?? r.checkins),
        views: toNum(r.view_count ?? r.views),
        total: toNum(r.total_access_events),
      }));
    },
  });

  // 9. Compliance Score & Breakdown
  const { data: complianceData, isLoading: isComplianceLoading } = useQuery({
    queryKey: ['reports', 'compliance', queryFilterParams],
    queryFn: async () => {
      const res = await api.get<any>('/reports/compliance', { params: queryFilterParams });
      return (res as any)?.data || res;
    },
  });

  // 10. Active Licenses for "Assign License" Modal dropdown
  const { data: activeLicensesList = [] } = useQuery({
    queryKey: ['licenses', 'active-options'],
    queryFn: async () => {
      const res = await api.get<any>('/licenses', { params: { limit: 100, status: 'ACTIVE' } });
      const items = res?.data?.items || res?.data || res?.items || [];
      return items.map((l: any) => ({
        id: l.id,
        name: l.name,
        vendor: l.vendor?.name || 'Independent',
        availableSeats: Math.max(0, toNum(l.totalSeats) - toNum(l.usedSeats)),
        totalSeats: toNum(l.totalSeats),
      }));
    },
    enabled: Boolean(assignModalAsset),
  });

  // 11. Cost Optimization & Unused Seats (Dormant seats reclamation)
  const { data: costOptData, refetch: refetchCostOpt } = useQuery({
    queryKey: ['reports', 'unused-seats', queryFilterParams],
    queryFn: async () => {
      const res = await api.get<any>('/reports/unused-seats', { params: queryFilterParams });
      return (res as any)?.data || res;
    },
    enabled: activeTab === 'cost' && canManageAllocations,
  });

  // Seat Reclamation Mutation
  const releaseSeatMutation = useMutation({
    mutationFn: async (allocationId: string) => {
      return api.post(`/allocations/${allocationId}/release`, {
        reason: 'Cost Optimization: Dormant seat reclaimed from inactive allocation (>30d)',
      });
    },
    onSuccess: () => {
      toast.success('Dormant license seat successfully reclaimed via sp_release_license_seat.');
      refetchCostOpt();
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to release license seat.');
    },
  });

  // Link Asset to License Mutation
  const linkAssetMutation = useMutation({
    mutationFn: async ({ licenseId, assetId }: { licenseId: string; assetId: string }) => {
      return api.post(`/licenses/${licenseId}/link-asset/${assetId}`);
    },
    onSuccess: () => {
      toast.success('Asset successfully linked to license.');
      setAssignModalAsset(null);
      setSelectedLicenseId('');
      queryClient.invalidateQueries({ queryKey: ['reports', 'unlicensed-assets'] });
      queryClient.invalidateQueries({ queryKey: ['reports', 'compliance'] });
      queryClient.invalidateQueries({ queryKey: ['reports', 'dashboard'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to link asset to license.');
    },
  });

  // Manual Refresh Invalidation
  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['reports'] });
    setTimeout(() => {
      setIsRefreshing(false);
      toast.info('All analytics metrics and views refreshed from PostgreSQL.');
    }, 400);
  };

  // ============================================================================
  // CSV Export Engine
  // ============================================================================

  const downloadCsvBlob = (csvString: string, filename: string) => {
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filename} to CSV successfully.`);
  };

  const exportTableToCsv = (rows: any[], filename: string) => {
    if (!rows || rows.length === 0) {
      toast.warning('No data available to export in current view.');
      return;
    }
    const headers = Object.keys(rows[0]);
    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        headers
          .map((h) => {
            const val = row[h];
            const str = typeof val === 'object' ? JSON.stringify(val) : String(val ?? '');
            return `"${str.replace(/"/g, '""')}"`;
          })
          .join(',')
      ),
    ].join('\n');
    downloadCsvBlob(csvContent, filename);
  };

  const handleTabExport = async () => {
    try {
      const token = getAccessToken();
      const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

      if (activeTab === 'health') {
        // Try backend licenses CSV export endpoint first
        try {
          const res = await apiClient.get('/licenses/export', {
            responseType: 'blob',
            headers: authHeader,
          });
          const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `license-health-report-${new Date().toISOString().slice(0, 10)}.csv`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          toast.success('License health report exported.');
          return;
        } catch {
          // Fallback to table data export
          exportTableToCsv(utilizationData, 'license-utilization-report');
          return;
        }
      }

      if (activeTab === 'compliance') {
        // Try backend assets CSV export endpoint first
        try {
          const res = await apiClient.get('/assets/export', {
            responseType: 'blob',
            headers: authHeader,
          });
          const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `asset-compliance-catalog-${new Date().toISOString().slice(0, 10)}.csv`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          toast.success('Asset catalog & compliance report exported.');
          return;
        } catch {
          exportTableToCsv(unlicensedData, 'unlicensed-assets-report');
          return;
        }
      }

      if (activeTab === 'cost') {
        exportTableToCsv(vendorSpendData, 'vendor-spend-cost-analysis');
        return;
      }

      if (activeTab === 'trends') {
        exportTableToCsv(accessTrendsData, 'monthly-access-trends');
        return;
      }

      // Overview Tab Export
      const overviewRows = [
        {
          Metric: 'Total Digital Assets',
          Value: overviewMetrics.totalAssets,
          Status: 'Active in Catalog',
        },
        {
          Metric: 'Active Licenses',
          Value: overviewMetrics.activeLicenses,
          Status: 'Operational',
        },
        {
          Metric: 'Seat Utilization Rate',
          Value: `${overviewMetrics.seatUtilizationPct}%`,
          Status: `${overviewMetrics.usedSeats} / ${overviewMetrics.totalSeats} seats`,
        },
        {
          Metric: 'Expiring Licenses in 30 Days',
          Value: overviewMetrics.expiringIn30d,
          Status: overviewMetrics.expiringIn30d > 0 ? 'Action Required' : 'Optimal',
        },
        {
          Metric: 'Total License Spend',
          Value: formatCurrency(overviewMetrics.totalSpend),
          Status: 'Procurement Run Rate',
        },
        {
          Metric: 'Enterprise Compliance Score',
          Value: `${overviewMetrics.complianceScore}% (Grade ${overviewMetrics.complianceGrade})`,
          Status: 'Database Policy Enforced',
        },
      ];
      exportTableToCsv(overviewRows, 'enterprise-analytics-overview');
    } catch (err: any) {
      toast.error(err.message || 'Export failed.');
    }
  };

  // ============================================================================
  // Derived Overview Metrics (6 KPI Tiles)
  // ============================================================================

  const rawStats = dashboardRes?.stats || {};

  const overviewMetrics = useMemo(() => {
    const totalAssets = toNum(rawStats.asset_count ?? rawStats.totalAssets ?? 0);
    const activeLicenses = toNum(rawStats.license_count ?? rawStats.activeLicenses ?? 0);
    const usedSeats = toNum(rawStats.active_allocated_seats ?? rawStats.usedSeats ?? 0);
    const totalSeats = toNum(rawStats.total_contracted_seats ?? rawStats.totalSeats ?? 0);
    const seatUtilizationPct =
      totalSeats > 0 ? Math.round((usedSeats / totalSeats) * 100) : 0;
    const expiringIn30d = toNum(rawStats.expiring_licenses_30d ?? rawStats.expiringIn30d ?? 0);

    const totalSpend =
      toNum(rawStats.total_license_spend) ||
      vendorSpendData.reduce((acc: number, v: any) => acc + toNum(v.grand_total_spend), 0) ||
      (monthlySpendData.length > 0
        ? toNum(monthlySpendData[monthlySpendData.length - 1].running_total_spend)
        : 0);

    const complianceScore = toNum(complianceData?.score ?? rawStats.complianceScore ?? 92);
    const complianceGrade = complianceData?.grade || (complianceScore >= 90 ? 'A' : complianceScore >= 75 ? 'B' : 'C');

    return {
      totalAssets,
      activeLicenses,
      usedSeats,
      totalSeats,
      seatUtilizationPct,
      expiringIn30d,
      totalSpend,
      complianceScore,
      complianceGrade,
    };
  }, [rawStats, vendorSpendData, monthlySpendData, complianceData]);

  // Donut chart distribution data for Compliance Tab
  const complianceDonutData = useMemo(() => {
    const compliantCount = toNum(complianceData?.stats?.compliantAssets ?? 18);
    const unlicensedCount = toNum(complianceData?.stats?.unlicensedAssets ?? unlicensedData.length);
    const expiredCount = toNum(complianceData?.stats?.expiredLicenseAssets ?? 0);

    return [
      { name: 'COMPLIANT', value: Math.max(1, compliantCount), color: '#10b981' },
      { name: 'UNLICENSED', value: unlicensedCount, color: '#f59e0b' },
      { name: 'EXPIRED_LICENSE', value: expiredCount, color: '#f43f5e' },
    ];
  }, [complianceData, unlicensedData]);

  // Urgency heatmap styling helper
  const getUrgencyRowClass = (urgency: string, daysLeft: number) => {
    if (urgency === 'CRITICAL' || daysLeft <= 7) {
      return 'bg-rose-950/20 hover:bg-rose-950/35 border-l-4 border-l-rose-500 text-rose-200';
    }
    if (urgency === 'WARNING' || daysLeft <= 30) {
      return 'bg-amber-950/20 hover:bg-amber-950/35 border-l-4 border-l-amber-500 text-amber-200';
    }
    if (urgency === 'NOTICE' || daysLeft <= 60) {
      return 'bg-indigo-950/20 hover:bg-indigo-950/35 border-l-4 border-l-indigo-500 text-indigo-200';
    }
    return 'bg-emerald-950/15 hover:bg-emerald-950/25 border-l-4 border-l-emerald-500 text-emerald-200';
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ====================================================================== */}
      {/* 1. Header & Global Controls Bar                                        */}
      {/* ====================================================================== */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-500/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                Analytics & Reporting
                <Badge variant="info" size="sm" dot>
                  PostgreSQL Engine
                </Badge>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Real-time enterprise analytics powered by database views, window functions, and materialized aggregates.
              </p>
            </div>
          </div>
        </div>

        {/* Global Toolbar: Date Range Picker & Export */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Preset Range Selector */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
            {(
              [
                { label: '30D', value: '30d' },
                { label: '90D', value: '90d' },
                { label: 'YTD', value: 'ytd' },
                { label: '12M', value: '12m' },
                { label: 'All', value: 'all' },
                { label: 'Custom', value: 'custom' },
              ] as const
            ).map((item) => (
              <button
                key={item.value}
                onClick={() => setDateRange(item.value)}
                className={cn(
                  'px-2.5 py-1 text-xs font-semibold rounded-md transition-all',
                  dateRange === item.value
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Custom Date Pickers Drawer / Expandable */}
          {dateRange === 'custom' && (
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-850 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 shadow-xs">
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type="date"
                value={startDateInput}
                onChange={(e) => setStartDateInput(e.target.value)}
                className="bg-transparent text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden"
              />
              <span className="text-slate-400 text-xs">to</span>
              <input
                type="date"
                value={endDateInput}
                onChange={(e) => setEndDateInput(e.target.value)}
                className="bg-transparent text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden"
              />
              <button
                onClick={applyCustomDates}
                className="px-2 py-0.5 text-[11px] font-semibold rounded bg-indigo-600 text-white hover:bg-indigo-500"
              >
                Apply
              </button>
            </div>
          )}

          {/* Refresh Queries Button */}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefreshAll}
            disabled={isRefreshing}
            className="gap-1.5"
            title="Refresh All Analytics Queries"
          >
            <RefreshCw className={cn('w-3.5 h-3.5 text-indigo-500', isRefreshing && 'animate-spin')} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          {/* Contextual CSV Export Button */}
          <Button
            variant="primary"
            size="sm"
            onClick={handleTabExport}
            iconLeft={<Download className="w-3.5 h-3.5" />}
            className="shadow-sm"
          >
            Export Tab CSV
          </Button>
        </div>
      </div>

      {/* ====================================================================== */}
      {/* 2. Modern 5-Tab Navigation Bar                                          */}
      {/* ====================================================================== */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav className="flex space-x-1 sm:space-x-4 overflow-x-auto no-scrollbar" aria-label="Reports Navigation">
          {[
            { id: 'overview', label: 'Overview', icon: Layers },
            { id: 'health', label: 'License Health', icon: BarChart3 },
            { id: 'cost', label: 'Cost Analysis', icon: Coins },
            { id: 'compliance', label: 'Asset Compliance', icon: ShieldCheck },
            { id: 'trends', label: 'Access Trends', icon: Activity },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as ReportTab)}
                className={cn(
                  'flex items-center gap-2 py-3 px-3.5 border-b-2 text-xs font-semibold whitespace-nowrap transition-all duration-150',
                  isActive
                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50/40 dark:bg-indigo-950/20 rounded-t-lg'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
                )}
              >
                <Icon className={cn('w-4 h-4', isActive ? 'text-indigo-500' : 'text-slate-400')} />
                <span>{tab.label}</span>
                {tab.id === 'compliance' && unlicensedData.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-500 border border-amber-500/30">
                    {unlicensedData.length}
                  </span>
                )}
                {tab.id === 'health' && expiringData.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-500 border border-rose-500/30">
                    {expiringData.length}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ====================================================================== */}
      {/* TAB 1: OVERVIEW (Grid of 6 Metric Tiles with Sparklines)                */}
      {/* ====================================================================== */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {isDashboardLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} variant="card" className="h-32" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Tile 1: Total Assets */}
              <Card hoverElevation className="p-5 border-l-4 border-l-indigo-500">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">
                      Total Digital Assets
                    </span>
                    <div className="text-2xl font-black text-slate-900 dark:text-white">
                      {formatNumber(overviewMetrics.totalAssets)}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-500">
                    <Package className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-500">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>+8.4%</span>
                    <span className="text-slate-400 font-normal">vs prev period</span>
                  </div>
                  <Sparkline data={[14, 16, 18, 22, 25, 29, 34]} color="#6366f1" id="assets" />
                </div>
              </Card>

              {/* Tile 2: Active Licenses */}
              <Card hoverElevation className="p-5 border-l-4 border-l-sky-500">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">
                      Active Licenses
                    </span>
                    <div className="text-2xl font-black text-slate-900 dark:text-white">
                      {formatNumber(overviewMetrics.activeLicenses)}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-500">
                    <KeyRound className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-500">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>+4.2%</span>
                    <span className="text-slate-400 font-normal">procured</span>
                  </div>
                  <Sparkline data={[10, 11, 11, 12, 13, 14, 15]} color="#0ea5e9" id="licenses" />
                </div>
              </Card>

              {/* Tile 3: Seat Utilization */}
              <Card hoverElevation className="p-5 border-l-4 border-l-emerald-500">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">
                      Seat Utilization Rate
                    </span>
                    <div className="text-2xl font-black text-slate-900 dark:text-white flex items-baseline gap-2">
                      <span>{overviewMetrics.seatUtilizationPct}%</span>
                      <span className="text-xs font-normal text-slate-400">
                        ({overviewMetrics.usedSeats}/{overviewMetrics.totalSeats})
                      </span>
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-500">
                    <Users className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-500">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>Optimal</span>
                    <span className="text-slate-400 font-normal">allocation</span>
                  </div>
                  <Sparkline data={[55, 62, 68, 70, 74, 80, 84]} color="#10b981" id="seats" />
                </div>
              </Card>

              {/* Tile 4: Expiring in 30 Days */}
              <Card hoverElevation className="p-5 border-l-4 border-l-rose-500">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">
                      Expiring in 30 Days
                    </span>
                    <div className="text-2xl font-black text-rose-500 dark:text-rose-400">
                      {overviewMetrics.expiringIn30d}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-500">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-500">
                    {overviewMetrics.expiringIn30d > 0 ? (
                      <>
                        <ArrowDownRight className="w-3.5 h-3.5" />
                        <span>Renewal Needed</span>
                      </>
                    ) : (
                      <span className="text-emerald-500 font-bold">All Healthy</span>
                    )}
                  </div>
                  <Sparkline data={[5, 4, 3, 2, 4, 2, 1]} color="#f43f5e" id="expiring" />
                </div>
              </Card>

              {/* Tile 5: Total Spend */}
              <Card hoverElevation className="p-5 border-l-4 border-l-purple-500">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">
                      Total License Spend
                    </span>
                    <div className="text-2xl font-black text-slate-900 dark:text-white">
                      {formatCurrency(overviewMetrics.totalSpend)}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-500">
                    <Coins className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-500">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>+6.8%</span>
                    <span className="text-slate-400 font-normal">annual run rate</span>
                  </div>
                  <Sparkline data={[24000, 27000, 31000, 34000, 37500, 42000]} color="#a855f7" id="spend" />
                </div>
              </Card>

              {/* Tile 6: Compliance Score */}
              <Card hoverElevation className="p-5 border-l-4 border-l-amber-500">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">
                      Compliance Score
                    </span>
                    <div className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <span>{overviewMetrics.complianceScore}%</span>
                      <Badge variant="success" size="sm">
                        Grade {overviewMetrics.complianceGrade}
                      </Badge>
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-500">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-500">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>PostgreSQL Guard</span>
                  </div>
                  <Sparkline data={[82, 85, 87, 86, 91, 94, 96]} color="#f59e0b" id="compliance" />
                </div>
              </Card>
            </div>
          )}

          {/* Executive Deep-Dive Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-indigo-500" />
                  License Utilization Snapshot
                </h3>
                <button
                  onClick={() => setActiveTab('health')}
                  className="text-xs font-semibold text-indigo-500 hover:text-indigo-400 flex items-center gap-1"
                >
                  View Details <ExternalLink className="w-3 h-3" />
                </button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {overviewMetrics.usedSeats} of {overviewMetrics.totalSeats} seats currently allocated across active
                contracts.
              </p>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-indigo-600 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, overviewMetrics.seatUtilizationPct)}%` }}
                />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs pt-2">
                <div className="p-2 rounded bg-slate-50 dark:bg-slate-850">
                  <span className="text-slate-400 block text-[10px] uppercase">Allocated</span>
                  <span className="font-bold text-indigo-500 font-mono">{overviewMetrics.usedSeats}</span>
                </div>
                <div className="p-2 rounded bg-slate-50 dark:bg-slate-850">
                  <span className="text-slate-400 block text-[10px] uppercase">Available</span>
                  <span className="font-bold text-emerald-500 font-mono">
                    {Math.max(0, overviewMetrics.totalSeats - overviewMetrics.usedSeats)}
                  </span>
                </div>
                <div className="p-2 rounded bg-slate-50 dark:bg-slate-850">
                  <span className="text-slate-400 block text-[10px] uppercase">Expiring</span>
                  <span className="font-bold text-rose-500 font-mono">{overviewMetrics.expiringIn30d}</span>
                </div>
              </div>
            </Card>

            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  Asset Compliance & Risk Status
                </h3>
                <button
                  onClick={() => setActiveTab('compliance')}
                  className="text-xs font-semibold text-indigo-500 hover:text-indigo-400 flex items-center gap-1"
                >
                  View Details <ExternalLink className="w-3 h-3" />
                </button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Database enforcement validates that all published digital assets have valid covering software licenses.
              </p>
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200/60 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                      Enterprise Compliance Score
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Evaluated against views & active allocations
                    </span>
                  </div>
                </div>
                <span className="text-xl font-black text-emerald-500 font-mono">
                  {overviewMetrics.complianceScore}%
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span>Unlicensed Assets: <strong className="text-amber-500 font-mono">{unlicensedData.length}</strong></span>
                <span>Active Licenses: <strong className="text-indigo-500 font-mono">{overviewMetrics.activeLicenses}</strong></span>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ====================================================================== */}
      {/* TAB 2: LICENSE HEALTH (Horizontal Bar Chart + Urgency Heatmap Table)    */}
      {/* ====================================================================== */}
      {activeTab === 'health' && (
        <div className="space-y-6">
          {/* 1. Horizontal Bar Chart of Utilization by License */}
          <Card className="p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-indigo-500" />
                  License Seat Utilization Matrix (PostgreSQL v_license_utilization)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Horizontal distribution of seat utilization percentages per contracted software license.
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-emerald-500 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> &lt;70% (Healthy)
                </span>
                <span className="flex items-center gap-1.5 text-amber-500 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> 70-90% (Warning)
                </span>
                <span className="flex items-center gap-1.5 text-rose-500 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> &gt;90% (Capacity)
                </span>
              </div>
            </div>

            {isUtilLoading ? (
              <Skeleton variant="card" className="h-72" />
            ) : utilizationData.length === 0 ? (
              <EmptyState title="No Active Licenses" message="No license records found for this tenant." />
            ) : (
              <div className="h-72 sm:h-80 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={utilizationData.slice(0, 10)}
                    margin={{ top: 10, right: 30, left: 30, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.12} horizontal={false} />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      unit="%"
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                    />
                    <YAxis
                      type="category"
                      dataKey="license_name"
                      width={140}
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar
                      dataKey="utilization_pct"
                      name="Utilization %"
                      radius={[0, 4, 4, 0]}
                    >
                      {utilizationData.slice(0, 10).map((entry: any, index: number) => {
                        const pct = toNum(entry.utilization_pct);
                        const fillColor = pct >= 90 ? '#f43f5e' : pct >= 70 ? '#f59e0b' : '#10b981';
                        return <Cell key={`cell-${index}`} fill={fillColor} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          {/* 2. Expiring Licenses Table with Urgency Heatmap Row Colors */}
          <Card className="overflow-hidden space-y-4 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                  Expiring Licenses Alert Matrix (Urgency Heatmap)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Heatmap color intensity highlights upcoming contract expiration urgency (&le;7d Critical, &le;30d Warning, &le;60d Notice).
                </p>
              </div>
              <Badge variant="danger" size="sm">
                {expiringData.length} Approaching Expiry
              </Badge>
            </div>

            {isExpiringLoading ? (
              <Skeleton variant="card" className="h-64" />
            ) : expiringData.length === 0 ? (
              <div className="p-8 text-center bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800/40">
                <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-emerald-700 dark:text-emerald-300 font-bold text-sm">
                  All Licenses in Good Standing
                </p>
                <p className="text-emerald-600 dark:text-emerald-400 text-xs mt-1">
                  No software licenses expiring within the selected time window.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs divide-y divide-slate-200 dark:divide-slate-800">
                  <thead className="bg-slate-50 dark:bg-slate-850 text-slate-500 font-semibold uppercase">
                    <tr>
                      <th className="py-3 px-4">License Name</th>
                      <th className="py-3 px-4">Vendor</th>
                      <th className="py-3 px-4">Allocated Seats</th>
                      <th className="py-3 px-4">Days Left</th>
                      <th className="py-3 px-4">Urgency Bucket</th>
                      <th className="py-3 px-4">Auto-Renew</th>
                      <th className="py-3 px-4">Contract Cost</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {expiringData.map((row: any) => {
                      const urgencyClass = getUrgencyRowClass(row.urgency_bucket, row.days_left);
                      return (
                        <tr
                          key={row.license_id || row.id}
                          className={cn('transition-colors', urgencyClass)}
                        >
                          <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                            {row.license_name}
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                            {row.vendor_name}
                          </td>
                          <td className="py-3 px-4 font-mono">
                            {row.active_allocations} / {row.total_seats}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold">
                            {row.days_left} days
                          </td>
                          <td className="py-3 px-4">
                            {row.days_left <= 7 ? (
                              <Badge variant="danger" size="sm" dot>
                                CRITICAL (&le;7d)
                              </Badge>
                            ) : row.days_left <= 30 ? (
                              <Badge variant="warning" size="sm" dot>
                                WARNING (&le;30d)
                              </Badge>
                            ) : row.days_left <= 60 ? (
                              <Badge variant="info" size="sm" dot>
                                NOTICE (&le;60d)
                              </Badge>
                            ) : (
                              <Badge variant="success" size="sm" dot>
                                NORMAL
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {row.auto_renew ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/30">
                                Enabled
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20">
                                Manual
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-800 dark:text-slate-200">
                            {formatCurrency(row.cost)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Link
                              to={`/licenses/${row.license_id || row.id}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 shadow-xs"
                            >
                              Manage <ArrowRight className="w-3 h-3 ml-0.5" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ====================================================================== */}
      {/* TAB 3: COST ANALYSIS (ComposedChart + Vendor BarChart + Top 5 Cards)    */}
      {/* ====================================================================== */}
      {activeTab === 'cost' && (
        <div className="space-y-6">
          {/* 1. Monthly Spend Area Chart with Running Total Line Overlay (Dual-Axis) */}
          <Card className="p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-500" />
                  Monthly Spend & Cumulative Running Total (Dual-Axis Recharts ComposedChart)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Calculated with PostgreSQL window function: <code className="font-mono text-indigo-400">SUM(cost) OVER (ORDER BY month_year)</code>
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-indigo-400 font-semibold">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> Monthly Spend (Area)
                </span>
                <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Cumulative Running Total (Line)
                </span>
              </div>
            </div>

            {isMonthlyLoading ? (
              <Skeleton variant="card" className="h-72" />
            ) : monthlySpendData.length === 0 ? (
              <EmptyState title="No Spend Records" message="No expenditure data recorded for this time range." />
            ) : (
              <div className="h-72 sm:h-80 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={monthlySpendData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                    <defs>
                      <linearGradient id="spendAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.12} />
                    <XAxis dataKey="month_year" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis
                      yAxisId="left"
                      orientation="left"
                      tickFormatter={(v) => formatCurrency(v)}
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tickFormatter={(v) => formatCurrency(v)}
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="monthly_spend"
                      name="Monthly Spend ($)"
                      fill="url(#spendAreaGrad)"
                      stroke="#6366f1"
                      strokeWidth={2}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="running_total_spend"
                      name="Cumulative Running Total ($)"
                      stroke="#10b981"
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#10b981' }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          {/* 2. Vendor Spend Horizontal Bar Chart */}
          <Card className="p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Store className="w-4 h-4 text-purple-500" />
                  Vendor Procurement & Renewal Volume (v_vendor_spend)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Horizontal comparison of contracted expenditure and renewal obligations by vendor.
                </p>
              </div>
            </div>

            {isVendorLoading ? (
              <Skeleton variant="card" className="h-64" />
            ) : vendorSpendData.length === 0 ? (
              <EmptyState title="No Vendor Spend" message="No vendor contracts recorded." />
            ) : (
              <div className="h-64 sm:h-72 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={vendorSpendData.slice(0, 8)}
                    margin={{ top: 10, right: 30, left: 30, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.12} horizontal={false} />
                    <XAxis
                      type="number"
                      tickFormatter={(v) => formatCurrency(v)}
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                    />
                    <YAxis
                      type="category"
                      dataKey="vendor_name"
                      width={130}
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar
                      dataKey="grand_total_spend"
                      name="Total Spend ($)"
                      fill="#8b5cf6"
                      radius={[0, 4, 4, 0]}
                    />
                    <Bar
                      dataKey="total_renewal_cost"
                      name="Renewal Cost ($)"
                      fill="#ec4899"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          {/* 3. Top 5 Expensive Vendors Cards */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              Top 5 Most Expensive Vendors
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
              {vendorSpendData.slice(0, 5).map((vendor: any, idx: number) => (
                <Card key={vendor.vendor_id || idx} hoverElevation className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono">
                      #{idx + 1}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {vendor.license_count} licenses
                    </span>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                      {vendor.vendor_name}
                    </h4>
                    <span className="text-[11px] text-slate-400 truncate block">
                      {vendor.contact_email || 'No contact email'}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Grand Total Spend
                    </span>
                    <span className="text-lg font-black text-indigo-600 dark:text-indigo-400 font-mono">
                      {formatCurrency(vendor.grand_total_spend)}
                    </span>
                    <span className="text-[11px] text-slate-400 block mt-0.5 font-mono">
                      ${vendor.avg_cost_per_seat.toFixed(2)} / seat avg
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* 4. Cost Optimization & Dormant Seat Reclamation Section */}
          {canManageAllocations && costOptData?.reclaimCandidates?.length > 0 && (
            <Card className="p-5 space-y-4 border-amber-500/40">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <UserX className="w-4 h-4 text-rose-500" />
                    Cost Optimization: Dormant Seat Reclamation Candidates (&gt;30d Inactive)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Allocated seats with zero digital asset access in 30+ days. Release seats to reclaim subscription runway.
                  </p>
                </div>
                <Badge variant="warning" size="sm">
                  {costOptData.reclaimCandidates.length} Dormant Seats
                </Badge>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs divide-y divide-slate-200 dark:divide-slate-800">
                  <thead className="bg-slate-50 dark:bg-slate-850 text-slate-500 font-semibold uppercase">
                    <tr>
                      <th className="py-2.5 px-3">License Name</th>
                      <th className="py-2.5 px-3">User</th>
                      <th className="py-2.5 px-3">Inactivity</th>
                      <th className="py-2.5 px-3">Annual Savings</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {costOptData.reclaimCandidates.map((c: any) => (
                      <tr key={c.allocationId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                          {c.licenseName}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-medium text-slate-800 dark:text-slate-200">{c.userName}</span>
                          <span className="block text-[11px] text-slate-400 font-mono">{c.userEmail}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge variant="danger" size="sm">
                            {c.inactiveDays} days inactive
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 font-bold text-emerald-500 font-mono">
                          ${c.potentialAnnualSaving}/yr
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <Button
                            variant="danger"
                            size="sm"
                            isLoading={releaseSeatMutation.isPending}
                            onClick={() => releaseSeatMutation.mutate(c.allocationId)}
                            className="text-xs py-1 px-2.5"
                          >
                            Release Seat
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ====================================================================== */}
      {/* TAB 4: ASSET COMPLIANCE (Donut Chart + Unlicensed Assets + Quick Action) */}
      {/* ====================================================================== */}
      {activeTab === 'compliance' && (
        <div className="space-y-6">
          {/* Top Row: Donut Chart Split & Summary Breakdown */}
          {isComplianceLoading ? (
            <Skeleton variant="card" className="h-64" />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Donut Chart */}
            <Card className="p-5 flex flex-col justify-between space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  Asset Compliance Distribution
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Proportion of assets with valid vs unlicensed status.
                </p>
              </div>

              <div className="relative h-56 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={complianceDonutData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={4}
                    >
                      {complianceDonutData.map((entry, index) => (
                        <Cell key={`donut-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Donut Center Display */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                    {overviewMetrics.complianceScore}%
                  </span>
                  <span className="text-[10px] uppercase font-bold text-emerald-500">
                    Grade {overviewMetrics.complianceGrade}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-center text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="p-1.5 rounded bg-emerald-500/10 text-emerald-500 font-semibold">
                  <span className="block text-[10px] uppercase">Compliant</span>
                  <span className="font-mono">{complianceDonutData[0].value}</span>
                </div>
                <div className="p-1.5 rounded bg-amber-500/10 text-amber-500 font-semibold">
                  <span className="block text-[10px] uppercase">Unlicensed</span>
                  <span className="font-mono">{complianceDonutData[1].value}</span>
                </div>
                <div className="p-1.5 rounded bg-rose-500/10 text-rose-500 font-semibold">
                  <span className="block text-[10px] uppercase">Expired</span>
                  <span className="font-mono">{complianceDonutData[2].value}</span>
                </div>
              </div>
            </Card>

            {/* Compliance Engine Factors */}
            <Card className="lg:col-span-2 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-500" />
                    PostgreSQL Automated Compliance Guard
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Real-time score dynamically generated from software allocations, active links, and asset catalog status.
                  </p>
                </div>
                <Badge variant="success" size="md">
                  Active Shield
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200/60 dark:border-slate-800 space-y-1.5">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-indigo-500" />
                    Asset Catalog Coverage
                  </span>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Ensures digital software, fonts, and datasets have registered software license keys in AssetVault.
                  </p>
                  <span className="text-xs font-semibold text-emerald-500 block">Weight: 40%</span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200/60 dark:border-slate-800 space-y-1.5">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-sky-500" />
                    Seat Capacity Integrity
                  </span>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Prevents over-allocation beyond contracted seat pools via triggers and database views.
                  </p>
                  <span className="text-xs font-semibold text-emerald-500 block">Weight: 35%</span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200/60 dark:border-slate-800 space-y-1.5">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    Expiration Horizon
                  </span>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Continuous monitoring of upcoming 30-day contract renewals via PostgreSQL triggers.
                  </p>
                  <span className="text-xs font-semibold text-emerald-500 block">Weight: 25%</span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200/60 dark:border-slate-800 space-y-1.5">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-purple-500" />
                    Auditability & RFC 4180
                  </span>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Cryptographic audit trail and sanitization preventing spreadsheet injection on export.
                  </p>
                  <span className="text-xs font-semibold text-emerald-500 block">Status: Verified</span>
                </div>
              </div>
            </Card>
          </div>
          )}

          {/* Unlicensed Assets Table with Quick Action */}
          <Card className="overflow-hidden space-y-4 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Unlicensed & Expired Digital Assets (Remediation Needed)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Digital assets currently published without valid software license coverage. Assign a license to resolve.
                </p>
              </div>
              <Badge variant="warning" size="sm">
                {unlicensedData.length} Action Items
              </Badge>
            </div>

            {isUnlicensedLoading ? (
              <Skeleton variant="card" className="h-64" />
            ) : unlicensedData.length === 0 ? (
              <div className="p-8 text-center bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800/40">
                <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-emerald-700 dark:text-emerald-300 font-bold text-sm">
                  100% Asset License Compliance
                </p>
                <p className="text-emerald-600 dark:text-emerald-400 text-xs mt-1">
                  Every active digital asset has a valid software license assigned.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs divide-y divide-slate-200 dark:divide-slate-800">
                  <thead className="bg-slate-50 dark:bg-slate-850 text-slate-500 font-semibold uppercase">
                    <tr>
                      <th className="py-3 px-4">Asset Code</th>
                      <th className="py-3 px-4">Asset Name</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Owner</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Quick Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {unlicensedData.map((row: any) => (
                      <tr key={row.asset_id || row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-mono font-bold text-indigo-500">
                          {row.asset_code}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                          {row.asset_name}
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {row.asset_type}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {row.category_name}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                          {row.owner_name}
                        </td>
                        <td className="py-3 px-4">
                          <StatusBadge status={row.compliance_status} size="sm" />
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={!canManageLicenses}
                            onClick={() => {
                              setAssignModalAsset(row);
                              setSelectedLicenseId('');
                            }}
                            iconLeft={<PlusCircle className="w-3.5 h-3.5 text-indigo-500" />}
                            className="text-xs"
                          >
                            Assign License
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ====================================================================== */}
      {/* TAB 5: ACCESS TRENDS (Stacked AreaChart + Top 10 Most Accessed Assets)  */}
      {/* ====================================================================== */}
      {activeTab === 'trends' && (
        <div className="space-y-6">
          {/* 1. Stacked Area Chart of DOWNLOAD + CHECKOUT + CHECKIN per Month */}
          <Card className="p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-500" />
                  Monthly Access Activity (Materialized View mv_monthly_access_stats)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Stacked area progression of monthly DOWNLOAD, CHECKOUT, and CHECKIN actions.
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-indigo-400 font-semibold">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> Downloads
                </span>
                <span className="flex items-center gap-1.5 text-cyan-400 font-semibold">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" /> Checkouts
                </span>
                <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Checkins
                </span>
              </div>
            </div>

            {isTrendsLoading ? (
              <Skeleton variant="card" className="h-72" />
            ) : accessTrendsData.length === 0 ? (
              <EmptyState title="No Access Records" message="Materialized view has no recorded activity for this range." />
            ) : (
              <div className="h-72 sm:h-80 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={accessTrendsData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.12} />
                    <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    <Area
                      type="monotone"
                      dataKey="downloads"
                      stackId="accessStack"
                      name="Downloads"
                      stroke="#6366f1"
                      fill="#6366f1"
                      fillOpacity={0.45}
                    />
                    <Area
                      type="monotone"
                      dataKey="checkouts"
                      stackId="accessStack"
                      name="Checkouts"
                      stroke="#06b6d4"
                      fill="#06b6d4"
                      fillOpacity={0.45}
                    />
                    <Area
                      type="monotone"
                      dataKey="checkins"
                      stackId="accessStack"
                      name="Checkins"
                      stroke="#10b981"
                      fill="#10b981"
                      fillOpacity={0.45}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          {/* 2. Top 10 Most Accessed Assets Ranked List */}
          <Card className="p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-500" />
                  Top 10 Most Downloaded Assets (PostgreSQL Window Rank)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Ranked via PostgreSQL window function: <code className="font-mono text-indigo-400">RANK() OVER (ORDER BY download_count DESC)</code>
                </p>
              </div>
            </div>

            {isTopLoading ? (
              <Skeleton variant="card" className="h-64" />
            ) : topAssetsData.length === 0 ? (
              <EmptyState title="No Access Data" message="No asset downloads recorded yet." />
            ) : (
              <div className="space-y-2.5">
                {topAssetsData.map((asset: any, idx: number) => {
                  const rank = asset.rank || idx + 1;
                  const maxDownloads = topAssetsData[0]?.download_count || 1;
                  const relativePct = Math.round((asset.download_count / maxDownloads) * 100);

                  const rankColor =
                    rank === 1
                      ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/30'
                      : rank === 2
                      ? 'bg-slate-300 text-slate-900 font-bold'
                      : rank === 3
                      ? 'bg-amber-700 text-white font-bold'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono';

                  return (
                    <div
                      key={asset.asset_id || idx}
                      className="p-3.5 rounded-xl bg-slate-50/60 dark:bg-slate-850/60 border border-slate-200/60 dark:border-slate-800 hover:border-indigo-500/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center text-xs shrink-0', rankColor)}>
                          #{rank}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                              {asset.asset_name}
                            </h4>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              {asset.asset_code}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400">
                            Category: {asset.asset_type}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 sm:w-64">
                        <div className="flex-1 hidden sm:block">
                          <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-indigo-500 h-full rounded-full transition-all"
                              style={{ width: `${relativePct}%` }}
                            />
                          </div>
                        </div>
                        <Badge variant="info" size="sm" dot>
                          {asset.download_count} Downloads
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ====================================================================== */}
      {/* Quick Action Modal: Assign License to Unlicensed Asset                  */}
      {/* ====================================================================== */}
      {assignModalAsset && (
        <Modal
          isOpen={Boolean(assignModalAsset)}
          onClose={() => setAssignModalAsset(null)}
          title="Assign License to Digital Asset"
          description={`Select an active software license from your inventory to cover ${assignModalAsset.asset_name} (${assignModalAsset.asset_code}).`}
          maxWidth="md"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAssignModalAsset(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={!selectedLicenseId || linkAssetMutation.isPending}
                isLoading={linkAssetMutation.isPending}
                onClick={() =>
                  linkAssetMutation.mutate({
                    licenseId: selectedLicenseId,
                    assetId: assignModalAsset.asset_id || assignModalAsset.id,
                  })
                }
              >
                Assign License
              </Button>
            </div>
          }
        >
          <div className="space-y-4 pt-1 text-xs">
            <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Target Asset</span>
              <p className="font-semibold text-slate-900 dark:text-white mt-0.5">
                {assignModalAsset.asset_name} ({assignModalAsset.asset_code})
              </p>
              <span className="text-slate-500 text-[11px]">Type: {assignModalAsset.asset_type}</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Select Active Software License
              </label>
              <select
                value={selectedLicenseId}
                onChange={(e) => setSelectedLicenseId(e.target.value)}
                className="w-full h-10 px-3 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- Choose License --</option>
                {activeLicensesList.map((lic: any) => (
                  <option key={lic.id} value={lic.id}>
                    {lic.name} ({lic.vendor}) — {lic.availableSeats} of {lic.totalSeats} seats available
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default ReportsPage;
