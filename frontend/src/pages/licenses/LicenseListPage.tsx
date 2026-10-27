// ==============================================================================
// AssetVault: Modern License Registry & Quota Management
// Course: BCSE307L Database Systems (Fall 2026-27)
// Cards view, masked key, utilization progress, multi-step creation, 3-dot menu
// ==============================================================================

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiClient, getAccessToken } from '../../services/api';
import { License, Vendor, User } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  Card,
  Badge,
  Button,
  Input,
  Select,
  Skeleton,
} from '../../components/ui';
import { Pagination } from '../../components/common/Pagination';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { DatePicker } from '../../components/common/DatePicker';
import {
  KeyRound,
  Plus,
  Users2,
  Trash2,
  DollarSign,
  X,
  Building,
  ExternalLink,
  MoreVertical,
  FileDown,
  RotateCcw,
  Copy,
  Check,
  Search,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';

// ==============================================================================
// 1. Helper Utilities: Vendor Logo, Masking & Colors
// ==============================================================================

const VENDOR_COLOR_PALETTES = [
  { bg: 'from-indigo-600 to-indigo-800', text: 'text-indigo-100', border: 'border-indigo-500/40' },
  { bg: 'from-emerald-600 to-emerald-800', text: 'text-emerald-100', border: 'border-emerald-500/40' },
  { bg: 'from-amber-600 to-amber-800', text: 'text-amber-100', border: 'border-amber-500/40' },
  { bg: 'from-rose-600 to-rose-800', text: 'text-rose-100', border: 'border-rose-500/40' },
  { bg: 'from-cyan-600 to-cyan-800', text: 'text-cyan-100', border: 'border-cyan-500/40' },
  { bg: 'from-purple-600 to-purple-800', text: 'text-purple-100', border: 'border-purple-500/40' },
];

function getVendorLogoMeta(vendorName?: string) {
  const clean = (vendorName || 'Vendor').trim();
  const words = clean.split(/\s+/);
  const initials =
    words.length > 1
      ? (words[0][0] + words[1][0]).toUpperCase()
      : clean.slice(0, 2).toUpperCase();

  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = clean.charCodeAt(i) + ((hash << 5) - hash);
  }
  const palette = VENDOR_COLOR_PALETTES[Math.abs(hash) % VENDOR_COLOR_PALETTES.length];

  return { initials, palette };
}

function maskLicenseKey(key?: string): string {
  if (!key) return '••••••••-••••';
  if (key.startsWith('••••')) return key;
  const last4 = key.slice(-4);
  return `••••••••-${last4}`;
}

// Seat utilization progress bar color: green <70%, amber 70-90%, red >90%
function getUtilizationColor(pct: number) {
  if (pct > 90) {
    return {
      bar: 'bg-rose-500',
      text: 'text-rose-400',
      badge: 'danger' as const,
    };
  }
  if (pct >= 70) {
    return {
      bar: 'bg-amber-500',
      text: 'text-amber-400',
      badge: 'warning' as const,
    };
  }
  return {
    bar: 'bg-emerald-500',
    text: 'text-emerald-400',
    badge: 'success' as const,
  };
}

// ==============================================================================
// 2. Main LicenseListPage Component
// ==============================================================================

export const LicenseListPage: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL state synchronization
  const searchTerm = searchParams.get('q') || '';
  const vendorFilter = searchParams.get('vendorId') || '';
  const statusFilter = searchParams.get('status') || 'ACTIVE';
  const licenseTypeFilter = searchParams.get('licenseTypeId') || '';
  const expiringFilter = searchParams.get('expiringWithinDays') || '';
  const sortBy = searchParams.get('sort') || 'endDate';
  const sortOrder = (searchParams.get('order') || 'asc') as 'asc' | 'desc';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '12', 10);

  // Search input local state for smooth typing
  const [searchInput, setSearchInput] = useState(searchTerm);
  useEffect(() => {
    setSearchInput(searchTerm);
  }, [searchTerm]);

  // Context Menu State
  const [activeMenuLicenseId, setActiveMenuLicenseId] = useState<string | null>(null);
  const menuContainerRef = useRef<HTMLDivElement | null>(null);

  // Modals & Action Targets
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createStep, setCreateStep] = useState<1 | 2 | 3>(1);
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [selectedLicense, setSelectedLicense] = useState<any | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [allocationNotes, setAllocationNotes] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  // Renewal form state
  const [renewalForm, setRenewalForm] = useState({
    newEndDate: '',
    cost: 0,
    notes: '',
  });

  // Creation form state matching backend multi-step requirements
  const [createForm, setCreateForm] = useState({
    // Step 1: Basic info
    name: '',
    licenseKey: '',
    vendorId: '',
    licenseTypeId: 3,
    // Step 2: Seats & dates
    totalSeats: 10,
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    autoRenew: true,
    // Step 3: Cost & currency
    cost: 499.0,
    currency: 'USD',
  });
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});

  // URL State Updater Helper
  const updateParams = (updates: Record<string, string | number | undefined | null>, resetPage = true) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, val]) => {
      if (val === undefined || val === null || val === '' || val === 'ALL') {
        next.delete(key);
      } else {
        next.set(key, String(val));
      }
    });

    if (resetPage && !('page' in updates)) {
      next.set('page', '1');
    }

    setSearchParams(next);
  };

  // Close context menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (activeMenuLicenseId && !menuContainerRef.current?.contains(e.target as Node)) {
        setActiveMenuLicenseId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeMenuLicenseId]);

  // Roles & Permissions check
  const roleName =
    typeof user?.role === 'object' && user?.role !== null
      ? (user.role as any).name
      : user?.role;

  const canManage =
    roleName === 'TENANT_ADMIN' ||
    roleName === 'ASSET_MANAGER' ||
    roleName === 'SUPER_ADMIN' ||
    Boolean(user?.isSuperAdmin);

  // ============================================================================
  // Data Queries
  // ============================================================================

  const {
    data: licensesData,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery<{ data: License[]; meta: any }>({
    queryKey: [
      'licenses',
      searchTerm,
      page,
      limit,
      vendorFilter,
      statusFilter,
      licenseTypeFilter,
      expiringFilter,
      sortBy,
      sortOrder,
    ],
    queryFn: () =>
      api.get('/licenses', {
        params: {
          page,
          limit,
          q: searchTerm || undefined,
          vendorId: vendorFilter || undefined,
          status: statusFilter === 'ALL' ? undefined : statusFilter,
          licenseTypeId: licenseTypeFilter || undefined,
          expiringWithinDays: expiringFilter || undefined,
          sort: sortBy,
          order: sortOrder,
        },
      }),
  });

  const { data: vendorsData } = useQuery<{ data: Vendor[] }>({
    queryKey: ['vendors-dropdown'],
    queryFn: () => api.get('/vendors'),
  });

  const { data: usersData } = useQuery<{ data: User[] }>({
    queryKey: ['users-dropdown'],
    queryFn: () => api.get('/users', { params: { limit: 100 } }),
  });

  const rawLicenses = licensesData?.data || [];
  const vendors = vendorsData?.data || [];
  const members = usersData?.data || [];

  // Client-side sorting enhancement for responsiveness & computed percentages
  const licenses = useMemo(() => {
    const list = [...rawLicenses];
    list.sort((a: any, b: any) => {
      let aVal: any;
      let bVal: any;

      if (sortBy === 'endDate' || sortBy === 'expiryDate') {
        const aDate = a.endDate || a.end_date;
        const bDate = b.endDate || b.end_date;
        aVal = aDate ? new Date(aDate).getTime() : Infinity;
        bVal = bDate ? new Date(bDate).getTime() : Infinity;
      } else if (sortBy === 'utilization' || sortBy === 'utilization_pct') {
        const aUsed = Number(a.usedSeats ?? a.used_seats ?? 0);
        const aTotal = Math.max(1, Number(a.totalSeats ?? a.total_seats ?? 1));
        const bUsed = Number(b.usedSeats ?? b.used_seats ?? 0);
        const bTotal = Math.max(1, Number(b.totalSeats ?? b.total_seats ?? 1));
        aVal = a.utilization_pct !== undefined ? Number(a.utilization_pct) : (aUsed / aTotal) * 100;
        bVal = b.utilization_pct !== undefined ? Number(b.utilization_pct) : (bUsed / bTotal) * 100;
      } else if (sortBy === 'cost') {
        aVal = typeof a.cost === 'object' && a.cost?.d ? Number(a.cost.d[0]) : Number(a.cost || 0);
        bVal = typeof b.cost === 'object' && b.cost?.d ? Number(b.cost.d[0]) : Number(b.cost || 0);
      } else {
        aVal = (a.name || a.license_name || '').toLowerCase();
        bVal = (b.name || b.license_name || '').toLowerCase();
      }

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      } else {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
      }
    });
    return list;
  }, [rawLicenses, sortBy, sortOrder]);

  // ============================================================================
  // Utilization Summary Banner Stats
  // ============================================================================

  const { licensesAtCapacity, expiringThisMonth, totalActiveCount } = useMemo(() => {
    let atCapacity = 0;
    let expiringSoon = 0;
    let activeCount = 0;

    rawLicenses.forEach((lic: any) => {
      const isAct = lic.status === 'ACTIVE';
      if (isAct) activeCount++;

      const used = Number(lic.used_seats ?? lic.usedSeats ?? 0);
      const total = Number(lic.total_seats ?? lic.totalSeats ?? 1);
      const pct =
        lic.utilization_pct !== undefined
          ? Number(lic.utilization_pct)
          : Math.round((used / Math.max(1, total)) * 100);

      if (pct >= 100 || (lic.available_seats !== undefined && lic.available_seats <= 0)) {
        atCapacity++;
      }

      const daysToExpiry = lic.days_to_expiry !== undefined ? lic.days_to_expiry : null;
      if (daysToExpiry !== null && daysToExpiry <= 30 && daysToExpiry >= 0) {
        expiringSoon++;
      } else if (lic.endDate || lic.end_date) {
        const diff = Math.ceil(
          (new Date(lic.endDate || lic.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        if (diff <= 30 && diff >= 0) {
          expiringSoon++;
        }
      }
    });

    return {
      licensesAtCapacity: atCapacity,
      expiringThisMonth: expiringSoon,
      totalActiveCount: activeCount,
    };
  }, [rawLicenses]);

  // ============================================================================
  // Mutations
  // ============================================================================

  // 1. Allocate Seat Mutation
  const allocateSeatMutation = useMutation({
    mutationFn: (payload: { licenseId: string; userId: string; notes?: string }) =>
      api.post(`/licenses/${payload.licenseId}/allocate`, {
        userId: payload.userId,
        notes: payload.notes,
      }),
    onSuccess: () => {
      setShowAllocateModal(false);
      setSelectedUserId('');
      setAllocationNotes('');
      toast.success('License seat allocated successfully via sp_allocate_license_seat');
      queryClient.invalidateQueries({ queryKey: ['licenses'] });
      queryClient.invalidateQueries({ queryKey: ['allocations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Seat allocation failed');
    },
  });

  // 2. Create License Mutation
  const createLicenseMutation = useMutation({
    mutationFn: (newLicense: typeof createForm) => api.post('/licenses', newLicense),
    onSuccess: () => {
      setShowCreateModal(false);
      setCreateStep(1);
      queryClient.invalidateQueries({ queryKey: ['licenses'] });
      toast.success('License contract successfully registered');
      setCreateForm({
        name: '',
        vendorId: '',
        licenseTypeId: 3,
        licenseKey: '',
        totalSeats: 10,
        cost: 499.0,
        currency: 'USD',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        autoRenew: true,
      });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create license');
    },
  });

  // 3. Renew License Mutation
  const renewLicenseMutation = useMutation({
    mutationFn: (payload: { licenseId: string; newEndDate: string; cost: number; notes?: string }) =>
      api.post(`/licenses/${payload.licenseId}/renew`, {
        newEndDate: payload.newEndDate,
        cost: payload.cost,
        notes: payload.notes,
      }),
    onSuccess: () => {
      setShowRenewModal(false);
      queryClient.invalidateQueries({ queryKey: ['licenses'] });
      toast.success('License contract successfully renewed via sp_renew_license');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to renew license');
    },
  });

  // 4. Soft Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/licenses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['licenses'] });
      setDeleteTarget(null);
      toast.success('License moved to Trash (soft-deleted)');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete license');
    },
  });

  // ============================================================================
  // Action Handlers
  // ============================================================================

  const handleCopyKey = (key: string, licId: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKeyId(licId);
    toast.info('License key copied to clipboard');
    setTimeout(() => setCopiedKeyId(null), 2500);
  };

  const handleExportPdf = async (licenseId: string, licenseName: string) => {
    try {
      toast.info(`Generating official PDF report for "${licenseName}"...`);
      const token = getAccessToken();
      const response = await apiClient.get(`/licenses/${licenseId}/pdf`, {
        responseType: 'blob',
        params: token ? { token } : undefined,
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `license-report-${licenseName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('License PDF report downloaded successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to export license PDF');
    }
  };

  const openAllocateModalFor = (lic: any) => {
    setSelectedLicense(lic);
    setShowAllocateModal(true);
    setActiveMenuLicenseId(null);
  };

  const openRenewModalFor = (lic: any) => {
    setSelectedLicense(lic);
    const currentEnd = lic.endDate || lic.end_date;
    const baseDate = currentEnd ? new Date(currentEnd) : new Date();
    const futureEnd = new Date(baseDate.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const licCost = typeof lic.cost === 'object' && lic.cost?.d ? Number(lic.cost.d[0]) : Number(lic.cost || 0);

    setRenewalForm({
      newEndDate: futureEnd,
      cost: licCost,
      notes: '',
    });
    setShowRenewModal(true);
    setActiveMenuLicenseId(null);
  };

  // Step 1 -> Step 2 validation
  const validateStep1 = () => {
    const errors: Record<string, string> = {};
    if (!createForm.name.trim() || createForm.name.trim().length < 2) {
      errors.name = 'License name must be at least 2 characters.';
    }
    if (!createForm.licenseKey.trim() || createForm.licenseKey.trim().length < 4) {
      errors.licenseKey = 'License key / secret code must be at least 4 characters.';
    }
    if (!createForm.vendorId) {
      errors.vendorId = 'Please select a vendor.';
    }
    if (!createForm.licenseTypeId) {
      errors.licenseTypeId = 'Please select a license type.';
    }
    setCreateErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Step 2 -> Step 3 validation
  const validateStep2 = () => {
    const errors: Record<string, string> = {};
    if (!createForm.totalSeats || createForm.totalSeats < 1) {
      errors.totalSeats = 'Total seats must be at least 1.';
    }
    if (!createForm.startDate) {
      errors.startDate = 'Start date is required.';
    }
    if (createForm.startDate && createForm.endDate && createForm.endDate <= createForm.startDate) {
      errors.endDate = 'End date must be strictly after start date.';
    }
    setCreateErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Final submission on Step 3
  const handleFinalCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (createForm.cost < 0 || isNaN(createForm.cost)) {
      errors.cost = 'Cost cannot be negative.';
    }
    if (!createForm.currency) {
      errors.currency = 'Currency is required.';
    }
    if (Object.keys(errors).length > 0) {
      setCreateErrors(errors);
      return;
    }
    setCreateErrors({});
    createLicenseMutation.mutate(createForm);
  };

  // ============================================================================
  // Expiry Countdown Chip Renderer
  // ============================================================================

  const renderExpiryCountdownChip = (lic: any) => {
    const days = lic.days_to_expiry !== undefined ? lic.days_to_expiry : null;
    const end = lic.endDate || lic.end_date;

    if (days === null && !end) {
      return (
        <Badge variant="outline" size="sm" className="font-mono text-[10px] bg-slate-900/60">
          Perpetual
        </Badge>
      );
    }

    const calculatedDays =
      days !== null
        ? days
        : Math.ceil((new Date(end).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    if (calculatedDays < 0) {
      return (
        <Badge variant="danger" dot size="sm" className="font-semibold">
          Expired ({Math.abs(calculatedDays)}d ago)
        </Badge>
      );
    }

    if (calculatedDays < 30) {
      return (
        <Badge variant="danger" dot size="sm" className="font-semibold shadow-xs animate-pulse">
          Expires in {calculatedDays}d
        </Badge>
      );
    }

    if (calculatedDays <= 60) {
      return (
        <Badge variant="warning" size="sm">
          {calculatedDays}d remaining
        </Badge>
      );
    }

    return (
      <Badge variant="default" size="sm">
        {calculatedDays}d remaining
      </Badge>
    );
  };

  return (
    <div className="space-y-6 pb-20">
      {/* ====================================================================== */}
      {/* Top Header & Action Controls                                           */}
      {/* ====================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">
              Software & Asset Licenses
            </h1>
            {isFetching && <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Contract quotas, seat allocations, real-time utilization & auto-renewal schedules
          </p>
        </div>

        {canManage && (
          <Button
            variant="primary"
            size="sm"
            iconLeft={<Plus className="w-4 h-4" />}
            onClick={() => {
              setShowCreateModal(true);
              setCreateStep(1);
              setCreateErrors({});
            }}
          >
            Create License
          </Button>
        )}
      </div>

      {/* ====================================================================== */}
      {/* Utilization Summary Banner: "X licenses at capacity · Y expiring"      */}
      {/* ====================================================================== */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 p-5 shadow-lg relative overflow-hidden backdrop-blur-md">
        <div className="absolute top-0 right-0 w-96 h-full bg-gradient-to-l from-indigo-500/10 to-transparent pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-400" />
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-indigo-300">
                License Capacity & Renewals
              </h2>
            </div>
            <p className="text-lg sm:text-xl font-bold text-slate-100">
              <span className={licensesAtCapacity > 0 ? 'text-rose-400' : 'text-slate-100'}>
                {licensesAtCapacity} {licensesAtCapacity === 1 ? 'license' : 'licenses'} at capacity
              </span>
              <span className="text-slate-500 mx-2">&bull;</span>
              <span className={expiringThisMonth > 0 ? 'text-amber-400' : 'text-slate-100'}>
                {expiringThisMonth} expiring this month
              </span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-3.5 py-2 rounded-xl bg-slate-950/60 border border-slate-800 text-center min-w-[100px]">
              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block">
                Active Contracts
              </span>
              <span className="text-base font-bold text-slate-100 font-mono">
                {totalActiveCount}
              </span>
            </div>

            <div className="px-3.5 py-2 rounded-xl bg-slate-950/60 border border-slate-800 text-center min-w-[100px]">
              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block">
                At Seat Limit
              </span>
              <span className="text-base font-bold text-rose-400 font-mono">
                {licensesAtCapacity}
              </span>
            </div>

            <div className="px-3.5 py-2 rounded-xl bg-slate-950/60 border border-slate-800 text-center min-w-[100px]">
              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block">
                Expiring (30d)
              </span>
              <span className="text-base font-bold text-amber-400 font-mono">
                {expiringThisMonth}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ====================================================================== */}
      {/* Filter and Sort Bar                                                    */}
      {/* ====================================================================== */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm backdrop-blur-xs">
        {/* Search Input */}
        <div className="w-full md:w-64">
          <Input
            inputSize="sm"
            placeholder="Search licenses or vendors..."
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              updateParams({ q: e.target.value || undefined });
            }}
            iconLeft={<Search className="w-4 h-4 text-slate-500" />}
            rightAction={
              searchInput ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput('');
                    updateParams({ q: undefined });
                  }}
                  className="p-1 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : undefined
            }
          />
        </div>

        {/* Filters Grid */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => updateParams({ status: e.target.value })}
            aria-label="Filter by status"
            className="py-1.5 px-3 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-300 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Licenses</option>
            <option value="EXPIRED">Expired</option>
            <option value="ARCHIVED">Trash / Archived</option>
            <option value="SUSPENDED">Suspended</option>
          </select>

          {/* Vendor Filter */}
          <select
            value={vendorFilter}
            onChange={(e) => updateParams({ vendorId: e.target.value || undefined })}
            aria-label="Filter by vendor"
            className="py-1.5 px-3 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-300 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer max-w-[150px] truncate"
          >
            <option value="">All Vendors</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>

          {/* License Type Filter */}
          <select
            value={licenseTypeFilter}
            onChange={(e) => updateParams({ licenseTypeId: e.target.value || undefined })}
            aria-label="Filter by license type"
            className="py-1.5 px-3 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-300 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="">All License Types</option>
            <option value="3">Seat-Based Commercial</option>
            <option value="2">SaaS Subscription</option>
            <option value="1">Perpetual License</option>
            <option value="4">Usage-Based / Metered</option>
            <option value="5">Open Source</option>
          </select>

          {/* Expiring Within N Days Dropdown */}
          <select
            value={expiringFilter}
            onChange={(e) => updateParams({ expiringWithinDays: e.target.value || undefined })}
            aria-label="Filter by expiry schedule"
            className="py-1.5 px-3 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-300 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="">Any Expiration</option>
            <option value="7">Expiring in 7 Days</option>
            <option value="15">Expiring in 15 Days</option>
            <option value="30">Expiring in 30 Days</option>
            <option value="60">Expiring in 60 Days</option>
            <option value="90">Expiring in 90 Days</option>
          </select>

          <div className="h-5 w-px bg-slate-800 hidden sm:block" />

          {/* Sort Options: by expiry date, utilization %, cost, name */}
          <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
            <select
              value={sortBy}
              onChange={(e) => updateParams({ sort: e.target.value }, false)}
              aria-label="Sort licenses by"
              className="py-1.5 px-2.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-300 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="endDate">Expiry Date</option>
              <option value="utilization_pct">Utilization %</option>
              <option value="cost">Contract Cost</option>
              <option value="name">License Name</option>
            </select>

            <button
              type="button"
              onClick={() => updateParams({ order: sortOrder === 'asc' ? 'desc' : 'asc' }, false)}
              title={`Sort direction: ${sortOrder === 'asc' ? 'Ascending' : 'Descending'}`}
              className="p-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              {sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Error State Banner */}
      {isError && (
        <div className="p-4 bg-rose-950/40 border border-rose-900/50 rounded-xl flex items-center justify-between text-xs text-rose-300">
          <span>{(error as any)?.message || 'Failed to load software licenses.'}</span>
          <button
            type="button"
            onClick={() => refetch()}
            className="underline font-semibold hover:text-rose-100"
          >
            Retry
          </button>
        </div>
      )}

      {/* ====================================================================== */}
      {/* License Cards View Grid                                                */}
      {/* ====================================================================== */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="card" className="h-64" />
          ))}
        </div>
      ) : licenses.length === 0 ? (
        <Card className="text-center p-12 bg-slate-900/40 border border-slate-800 rounded-2xl">
          <KeyRound className="w-12 h-12 text-slate-500 mx-auto mb-3 opacity-40" />
          <h3 className="text-base font-bold text-slate-100 mb-1">No Licenses Found</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mb-5">
            No software contracts match your search query, vendor, or expiration filters.
          </p>
          {canManage && (
            <Button
              variant="primary"
              size="sm"
              iconLeft={<Plus className="w-4 h-4" />}
              onClick={() => {
                setShowCreateModal(true);
                setCreateStep(1);
                setCreateErrors({});
              }}
            >
              Register License
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {licenses.map((licItem) => {
            const lic = licItem as any;
            const licId = lic.id || lic.license_id;
            const licName = lic.name || lic.license_name || 'Unnamed License';
            const vendorName = lic.vendor?.name || lic.vendor_name || 'Unknown Vendor';
            const licTypeName = lic.licenseType?.name || lic.license_type || 'Standard';
            const isUnlimited = licTypeName === 'SITE_LICENSE' || lic.licenseType?.isSeatBased === false;

            const allocated = Number(
              lic.used_seats ??
                lic.usedSeats ??
                (lic.allocations
                  ? lic.allocations.filter((a: any) => a.status === 'ACTIVE').length
                  : 0)
            );
            const total = Number(lic.total_seats ?? lic.totalSeats ?? 1);
            const pct = isUnlimited ? 100 : Math.min(100, Math.round((allocated / total) * 100));

            const rawCost =
              typeof lic.cost === 'object' && lic.cost?.d
                ? Number(lic.cost.d[0])
                : Number(lic.cost || 0);
            const currency = lic.currency || 'USD';
            const rawKey = lic.license_key || lic.licenseKey;
            const maskedKey = maskLicenseKey(rawKey);

            const utilColor = getUtilizationColor(pct);
            const { initials: vendorInitials, palette: vendorPalette } = getVendorLogoMeta(vendorName);
            const isMenuOpen = activeMenuLicenseId === licId;

            return (
              <Card
                key={licId}
                hoverElevation
                className="flex flex-col justify-between transition-all bg-slate-900/70 border-slate-800 hover:border-slate-700 relative overflow-visible"
              >
                <div className="p-5 space-y-4">
                  {/* Card Header: Vendor Logo (colored initials), Name, Status Badge & Context Menu */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Vendor Logo Placeholder (Colored Initials) */}
                      <div
                        className={`w-10 h-10 rounded-xl bg-gradient-to-br ${vendorPalette.bg} ${vendorPalette.border} border flex items-center justify-center font-bold text-xs select-none shadow-sm shrink-0 ${vendorPalette.text}`}
                        title={vendorName}
                      >
                        {vendorInitials}
                      </div>

                      <div className="min-w-0">
                        <Link
                          to={`/licenses/${licId}`}
                          className="font-bold text-sm text-slate-100 hover:text-indigo-400 hover:underline block truncate leading-snug transition-colors"
                        >
                          {licName}
                        </Link>
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5 truncate">
                          <Building className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="truncate">{vendorName}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right side: Status Badge + Context Menu (3-dot) */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {lic.status === 'ACTIVE' ? (
                        <Badge variant="success" dot size="sm">
                          ACTIVE
                        </Badge>
                      ) : lic.status === 'EXPIRED' ? (
                        <Badge variant="danger" dot size="sm">
                          EXPIRED
                        </Badge>
                      ) : (
                        <Badge variant="outline" size="sm">
                          {lic.status || 'ARCHIVED'}
                        </Badge>
                      )}

                      {/* 3-Dot Context Menu Button */}
                      <div className="relative" ref={isMenuOpen ? menuContainerRef : undefined}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuLicenseId(isMenuOpen ? null : licId);
                          }}
                          className="p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors focus:outline-none"
                          aria-label={`Actions for ${licName}`}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {/* Dropdown Menu */}
                        {isMenuOpen && (
                          <div className="absolute right-0 top-full mt-1 w-44 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-30 py-1 text-xs text-slate-300 divide-y divide-slate-800 animate-in fade-in zoom-in-95 duration-100">
                            <div className="py-1">
                              <Link
                                to={`/licenses/${licId}`}
                                className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-800 hover:text-slate-100 transition-colors w-full text-left"
                                onClick={() => setActiveMenuLicenseId(null)}
                              >
                                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                                <span>View Details</span>
                              </Link>

                              {canManage && (
                                <button
                                  type="button"
                                  onClick={() => openAllocateModalFor(lic)}
                                  disabled={!isUnlimited && allocated >= total}
                                  className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-800 hover:text-slate-100 transition-colors w-full text-left disabled:opacity-40 disabled:hover:bg-transparent"
                                >
                                  <Users2 className="w-3.5 h-3.5 text-indigo-400" />
                                  <span>Allocate Seat</span>
                                </button>
                              )}

                              {canManage && (
                                <button
                                  type="button"
                                  onClick={() => openRenewModalFor(lic)}
                                  className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-800 hover:text-slate-100 transition-colors w-full text-left"
                                >
                                  <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Renew</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuLicenseId(null);
                                  handleExportPdf(licId, licName);
                                }}
                                className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-800 hover:text-slate-100 transition-colors w-full text-left"
                              >
                                <FileDown className="w-3.5 h-3.5 text-amber-400" />
                                <span>Export PDF</span>
                              </button>
                            </div>

                            {canManage && (
                              <div className="py-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuLicenseId(null);
                                    setDeleteTarget({ id: licId, name: licName });
                                  }}
                                  className="flex items-center gap-2.5 px-3 py-2 hover:bg-rose-950/40 text-rose-400 hover:text-rose-300 transition-colors w-full text-left"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Soft Delete</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Masked Key Display (••••••••-XXXX) with Copy Button */}
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/80 border border-slate-800 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <KeyRound className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="font-mono text-slate-300 tracking-wider truncate">
                        {maskedKey}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyKey(rawKey || maskedKey, licId)}
                      className="p-1 text-slate-500 hover:text-indigo-400 transition-colors rounded hover:bg-slate-800 shrink-0"
                      title="Copy Key"
                    >
                      {copiedKeyId === licId ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {/* Seat Utilization Progress Bar */}
                  <div className="space-y-1.5 p-3 rounded-xl bg-slate-950/40 border border-slate-800/80">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-medium">Seat Utilization</span>
                      <span className={`font-mono font-bold ${utilColor.text}`}>
                        {isUnlimited
                          ? 'Unlimited'
                          : `${allocated} / ${total} seats (${pct}%)`}
                      </span>
                    </div>

                    {!isUnlimited && (
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${pct}%` }}
                          className={`h-full rounded-full transition-all duration-300 ${utilColor.bar}`}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Bottom: Expiry Countdown Chip & Cost */}
                <div className="px-5 py-3.5 bg-slate-950/40 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  {/* Expiry Countdown Chip (Red if <30 days) */}
                  <div className="flex items-center gap-1.5">
                    {renderExpiryCountdownChip(lic)}
                  </div>

                  {/* Cost & Currency */}
                  <div className="flex items-center gap-1 font-mono text-slate-200 font-semibold">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                    <span>
                      ${Number(rawCost).toFixed(2)} {currency}
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ====================================================================== */}
      {/* Pagination Controls                                                    */}
      {/* ====================================================================== */}
      {licensesData?.meta && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden shadow-xs">
          <Pagination
            meta={licensesData.meta}
            currentPage={page}
            pageSize={limit}
            onPageChange={(newPage) => updateParams({ page: newPage }, false)}
            onLimitChange={(newLimit) => updateParams({ limit: newLimit, page: 1 }, false)}
          />
        </div>
      )}

      {/* ====================================================================== */}
      {/* Create License Multi-Step Modal (Steps 1, 2, 3)                         */}
      {/* ====================================================================== */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
              <div>
                <h2 className="text-base font-extrabold text-slate-100 tracking-tight">
                  Register Software License
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Step {createStep} of 3 &bull;{' '}
                  {createStep === 1
                    ? 'Basic Contract Info'
                    : createStep === 2
                    ? 'Seats & Schedule'
                    : 'Cost & Terms'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setCreateErrors({});
                }}
                className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stepper Progress Bar */}
            <div className="grid grid-cols-3 border-b border-slate-800 text-xs text-center font-medium">
              <div
                className={`py-2.5 border-b-2 transition-colors ${
                  createStep === 1
                    ? 'border-indigo-500 text-indigo-400 font-bold bg-indigo-950/20'
                    : createStep > 1
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-slate-500'
                }`}
              >
                1. Basic Info
              </div>
              <div
                className={`py-2.5 border-b-2 transition-colors ${
                  createStep === 2
                    ? 'border-indigo-500 text-indigo-400 font-bold bg-indigo-950/20'
                    : createStep > 2
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-slate-500'
                }`}
              >
                2. Seats & Dates
              </div>
              <div
                className={`py-2.5 border-b-2 transition-colors ${
                  createStep === 3
                    ? 'border-indigo-500 text-indigo-400 font-bold bg-indigo-950/20'
                    : 'border-transparent text-slate-500'
                }`}
              >
                3. Cost & Terms
              </div>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleFinalCreateSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* STEP 1: Basic Info (Name, Key, Vendor, Type) */}
              {createStep === 1 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <Input
                    label="License Name *"
                    placeholder="e.g. JetBrains All Products Pack"
                    value={createForm.name}
                    onChange={(e) => {
                      setCreateForm({ ...createForm, name: e.target.value });
                      if (createErrors.name) setCreateErrors((prev) => ({ ...prev, name: '' }));
                    }}
                    error={createErrors.name}
                  />

                  <Input
                    label="License Key / Secret Code *"
                    placeholder="XXXX-XXXX-XXXX-XXXX"
                    className="font-mono uppercase"
                    value={createForm.licenseKey}
                    onChange={(e) => {
                      setCreateForm({ ...createForm, licenseKey: e.target.value });
                      if (createErrors.licenseKey)
                        setCreateErrors((prev) => ({ ...prev, licenseKey: '' }));
                    }}
                    error={createErrors.licenseKey}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <Select
                      label="Vendor *"
                      value={createForm.vendorId}
                      onChange={(e) => {
                        setCreateForm({ ...createForm, vendorId: e.target.value });
                        if (createErrors.vendorId)
                          setCreateErrors((prev) => ({ ...prev, vendorId: '' }));
                      }}
                      error={createErrors.vendorId}
                    >
                      <option value="">Select Vendor...</option>
                      {vendors.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </Select>

                    <Select
                      label="Licensing Model *"
                      value={createForm.licenseTypeId}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          licenseTypeId: parseInt(e.target.value, 10),
                        })
                      }
                      error={createErrors.licenseTypeId}
                    >
                      <option value={3}>Seat-Based Commercial</option>
                      <option value={2}>SaaS Subscription</option>
                      <option value={1}>Perpetual License</option>
                      <option value={4}>Usage-Based / Metered</option>
                      <option value={5}>Open Source</option>
                    </Select>
                  </div>
                </div>
              )}

              {/* STEP 2: Seats & Dates (totalSeats, startDate, endDate, autoRenew) */}
              {createStep === 2 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <Input
                    type="number"
                    min={1}
                    label="Total Contracted Seats *"
                    placeholder="10"
                    value={createForm.totalSeats}
                    onChange={(e) => {
                      setCreateForm({
                        ...createForm,
                        totalSeats: parseInt(e.target.value, 10) || 1,
                      });
                      if (createErrors.totalSeats)
                        setCreateErrors((prev) => ({ ...prev, totalSeats: '' }));
                    }}
                    error={createErrors.totalSeats}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <DatePicker
                      label="Start Date"
                      required
                      value={createForm.startDate}
                      onChange={(val) => {
                        setCreateForm({ ...createForm, startDate: val });
                        if (createErrors.startDate)
                          setCreateErrors((prev) => ({ ...prev, startDate: '' }));
                      }}
                    />

                    <DatePicker
                      label="End Date"
                      value={createForm.endDate}
                      onChange={(val) => {
                        setCreateForm({ ...createForm, endDate: val });
                        if (createErrors.endDate)
                          setCreateErrors((prev) => ({ ...prev, endDate: '' }));
                      }}
                    />
                  </div>
                  {createErrors.endDate && (
                    <p className="text-xs text-rose-500 font-medium">{createErrors.endDate}</p>
                  )}

                  {/* Auto Renew Toggle */}
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-xs text-slate-200 block">
                        Automatic Renewal
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Automatically invoke sp_renew_license when the contract reaches expiry
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={createForm.autoRenew}
                        onChange={(e) =>
                          setCreateForm({ ...createForm, autoRenew: e.target.checked })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                </div>
              )}

              {/* STEP 3: Cost & Currency */}
              {createStep === 3 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      label="Contract Cost *"
                      placeholder="499.00"
                      className="font-mono"
                      value={createForm.cost}
                      onChange={(e) => {
                        setCreateForm({
                          ...createForm,
                          cost: parseFloat(e.target.value) || 0,
                        });
                        if (createErrors.cost) setCreateErrors((prev) => ({ ...prev, cost: '' }));
                      }}
                      error={createErrors.cost}
                    />

                    <Select
                      label="Currency *"
                      value={createForm.currency}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, currency: e.target.value })
                      }
                      error={createErrors.currency}
                    >
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="CAD">CAD ($)</option>
                      <option value="AUD">AUD ($)</option>
                      <option value="INR">INR (₹)</option>
                      <option value="JPY">JPY (¥)</option>
                    </Select>
                  </div>

                  {/* Review Summary */}
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs">
                    <span className="font-bold text-slate-300 block uppercase tracking-wider text-[11px]">
                      Contract Review Summary
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-slate-400">
                      <div>
                        Name:{' '}
                        <span className="font-semibold text-slate-200">{createForm.name}</span>
                      </div>
                      <div>
                        Vendor:{' '}
                        <span className="font-semibold text-slate-200">
                          {vendors.find((v) => v.id === createForm.vendorId)?.name || 'Selected'}
                        </span>
                      </div>
                      <div>
                        Seats:{' '}
                        <span className="font-semibold text-slate-200">
                          {createForm.totalSeats} seats
                        </span>
                      </div>
                      <div>
                        Validity:{' '}
                        <span className="font-semibold text-slate-200">
                          {createForm.startDate} to {createForm.endDate || 'Perpetual'}
                        </span>
                      </div>
                      <div>
                        Auto-Renew:{' '}
                        <span className="font-semibold text-slate-200">
                          {createForm.autoRenew ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                      <div>
                        Price:{' '}
                        <span className="font-semibold text-emerald-400 font-mono">
                          ${createForm.cost} {createForm.currency}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </form>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/40">
              {createStep > 1 ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setCreateStep((prev) => (prev - 1) as 1 | 2)}
                >
                  Back
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </Button>
              )}

              {createStep < 3 ? (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    if (createStep === 1 && validateStep1()) {
                      setCreateStep(2);
                    } else if (createStep === 2 && validateStep2()) {
                      setCreateStep(3);
                    }
                  }}
                >
                  {createStep === 1 ? 'Next: Seats & Dates' : 'Next: Cost & Terms'}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  isLoading={createLicenseMutation.isPending}
                  onClick={handleFinalCreateSubmit}
                >
                  Create License
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================== */}
      {/* Allocate Seat Modal                                                    */}
      {/* ====================================================================== */}
      {showAllocateModal && selectedLicense && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setShowAllocateModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-base font-bold text-slate-100">Allocate License Seat</h2>
            <p className="text-xs text-slate-400 mt-1">
              Assign an available seat for{' '}
              <strong className="text-slate-200">
                {selectedLicense.name || selectedLicense.license_name}
              </strong>
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!selectedUserId) return;
                allocateSeatMutation.mutate({
                  licenseId: selectedLicense.id || selectedLicense.license_id,
                  userId: selectedUserId,
                  notes: allocationNotes,
                });
              }}
              className="space-y-4 mt-4 text-xs"
            >
              <div>
                <Select
                  label="Select Team Member *"
                  required
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                >
                  <option value="">Choose an employee...</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.fullName} ({m.email})
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Input
                  label="Assignment Notes"
                  placeholder="e.g. Workstation ID, Project authorization code"
                  value={allocationNotes}
                  onChange={(e) => setAllocationNotes(e.target.value)}
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowAllocateModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={allocateSeatMutation.isPending}
                >
                  Confirm Allocation
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================== */}
      {/* Renew License Modal (sp_renew_license)                                 */}
      {/* ====================================================================== */}
      {showRenewModal && selectedLicense && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setShowRenewModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-base font-bold text-slate-100">Renew License Contract</h2>
            <p className="text-xs text-slate-400 mt-1">
              Extend duration for{' '}
              <strong className="text-slate-200">
                {selectedLicense.name || selectedLicense.license_name}
              </strong>{' '}
              via stored procedure <code className="text-indigo-400">sp_renew_license</code>
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                renewLicenseMutation.mutate({
                  licenseId: selectedLicense.id || selectedLicense.license_id,
                  newEndDate: renewalForm.newEndDate,
                  cost: renewalForm.cost,
                  notes: renewalForm.notes,
                });
              }}
              className="space-y-4 mt-4 text-xs"
            >
              <DatePicker
                label="New End Date"
                required
                value={renewalForm.newEndDate}
                onChange={(val) => setRenewalForm({ ...renewalForm, newEndDate: val })}
              />

              <Input
                type="number"
                step="0.01"
                min={0}
                label="Renewal Cost (USD) *"
                className="font-mono"
                value={renewalForm.cost}
                onChange={(e) =>
                  setRenewalForm({
                    ...renewalForm,
                    cost: parseFloat(e.target.value) || 0,
                  })
                }
              />

              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1">
                  Renewal Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. PO #88392, Annual enterprise extension"
                  value={renewalForm.notes}
                  onChange={(e) => setRenewalForm({ ...renewalForm, notes: e.target.value })}
                  className="w-full bg-slate-950 text-slate-100 placeholder:text-slate-600 border border-slate-800 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowRenewModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={renewLicenseMutation.isPending}
                >
                  Execute Renewal
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================== */}
      {/* Soft-Delete Confirmation Dialog                                        */}
      {/* ====================================================================== */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate(deleteTarget.id);
          }
        }}
        title="Move License to Trash"
        message={`Are you sure you want to soft-delete license "${deleteTarget?.name}"? Active allocations will be terminated.`}
        confirmLabel="Delete License"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};
