// ==============================================================================
// AssetVault: Modern License Detail & Quota Ledger View
// Course: BCSE307L Database Systems (Fall 2026-27)
// Multi-tab layout: Overview, Allocations, Covered Assets, Renewals, Audit Trail
// ==============================================================================

import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from 'recharts';
import {
  ArrowLeft,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Check,
  Plus,
  Trash2,
  Unlink,
  ExternalLink,
  Download,
  Building,
  Calendar,
  DollarSign,
  Users2,
  ShieldCheck,
  AlertCircle,
  Clock,
  RotateCcw,
  History,
  Layers,
  Search,
  Edit3,
  FileCode,
  FileText,
  Image as ImageIcon,
  Video,
  Binary,
  File,
  Link as LinkIcon,
} from 'lucide-react';
import { api, apiClient, getAccessToken } from '../../services/api';
import { License, Asset, LicenseAllocation, LicenseRenewal, User, Vendor } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  Card,
  Badge,
  Button,
  Input,
  Select,
  Avatar,
  Skeleton,
} from '../../components/ui';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { DatePicker } from '../../components/common/DatePicker';

// ==============================================================================
// 1. Asset Type Configuration & Helpers
// ==============================================================================

const ASSET_TYPE_ICONS: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  SOFTWARE: { icon: FileCode, color: 'text-indigo-400' },
  DOCUMENT: { icon: FileText, color: 'text-amber-400' },
  IMAGE: { icon: ImageIcon, color: 'text-emerald-400' },
  VIDEO: { icon: Video, color: 'text-rose-400' },
  DATASET: { icon: Binary, color: 'text-cyan-400' },
  FONT: { icon: Layers, color: 'text-purple-400' },
};

function renderAssetTypeIcon(type?: string, className = 'w-4 h-4') {
  const meta = (type && ASSET_TYPE_ICONS[type.toUpperCase()]) || { icon: File, color: 'text-slate-400' };
  const IconComp = meta.icon;
  return <IconComp className={`${className} ${meta.color}`} />;
}

// Seat utilization progress color: green <70%, amber 70-90%, red >90%
function getUtilizationColor(pct: number) {
  if (pct > 90) {
    return {
      bar: 'bg-rose-500',
      text: 'text-rose-400',
      hex: '#f43f5e',
      badge: 'danger' as const,
    };
  }
  if (pct >= 70) {
    return {
      bar: 'bg-amber-500',
      text: 'text-amber-400',
      hex: '#f59e0b',
      badge: 'warning' as const,
    };
  }
  return {
    bar: 'bg-emerald-500',
    text: 'text-emerald-400',
    hex: '#10b981',
    badge: 'success' as const,
  };
}

function maskKeyDisplay(key?: string): string {
  if (!key) return '••••••••-••••';
  if (key.startsWith('••••')) return key;
  const last4 = key.slice(-4);
  return `••••••••-${last4}`;
}

// ==============================================================================
// 2. Main LicenseDetailPage Component
// ==============================================================================

export const LicenseDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const toast = useToast();

  const roleName =
    typeof user?.role === 'object' && user?.role !== null
      ? (user.role as any).name
      : user?.role;

  const canManage =
    roleName === 'TENANT_ADMIN' ||
    roleName === 'ASSET_MANAGER' ||
    roleName === 'SUPER_ADMIN' ||
    Boolean(user?.isSuperAdmin);

  // Active Tab State: Overview, Allocations, Covered Assets, Renewals, Audit Trail
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const validTabs = ['overview', 'allocations', 'assets', 'renewals', 'audit'] as const;
  type TabType = (typeof validTabs)[number];
  const activeTab: TabType = validTabs.includes(rawTab as TabType)
    ? (rawTab as TabType)
    : 'overview';

  const setActiveTab = (tab: TabType) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (tab === 'overview') {
          next.delete('tab');
        } else {
          next.set('tab', tab);
        }
        return next;
      },
      { replace: true }
    );
  };

  // Key Visibility & Copy State
  const [isKeyRevealed, setIsKeyRevealed] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  // Modals & Action States
  const [isAllocateModalOpen, setIsAllocateModalOpen] = useState(false);
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isLinkAssetModalOpen, setIsLinkAssetModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [releaseAllocationTarget, setReleaseAllocationTarget] = useState<any | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // User search dialog state inside Allocations tab
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [allocationNotes, setAllocationNotes] = useState('');

  // Asset linking search state inside Covered Assets tab
  const [selectedAssetId, setSelectedAssetId] = useState('');

  // Renewal Form State
  const [renewForm, setRenewForm] = useState({
    newEndDate: '',
    cost: 0,
    notes: 'Annual contract extension via sp_renew_license',
  });

  // Edit License Form State
  const [editForm, setEditForm] = useState({
    name: '',
    vendorId: '',
    licenseTypeId: 3,
    totalSeats: 10,
    cost: 0,
    currency: 'USD',
    startDate: '',
    endDate: '',
    autoRenew: true,
    status: 'ACTIVE',
  });

  // Audit trail pagination
  const [auditPage, setAuditPage] = useState(1);

  // ============================================================================
  // Data Queries
  // ============================================================================

  // 1. Fetch License Details
  const {
    data: licenseData,
    isLoading: isLicenseLoading,
    error: licenseError,
  } = useQuery<{ data: License } | License>({
    queryKey: ['license', id],
    queryFn: async () => {
      return api.get(`/licenses/${id}`);
    },
    enabled: Boolean(id),
  });

  const license = (licenseData as any)?.data || (licenseData as any);

  // Populate Edit and Renew Forms when license data loads
  useEffect(() => {
    if (license) {
      const parsedEnd = license.endDate || license.end_date ? new Date(license.endDate || license.end_date) : new Date();
      const nextYearDate = new Date(parsedEnd.getTime() + 365 * 24 * 60 * 60 * 1000);
      const licCost = typeof license.cost === 'object' && license.cost?.d ? Number(license.cost.d[0]) : Number(license.cost || 0);

      setRenewForm({
        newEndDate: nextYearDate.toISOString().split('T')[0],
        cost: licCost,
        notes: `Annual renewal for ${license.name}`,
      });

      setEditForm({
        name: license.name || '',
        vendorId: license.vendorId || license.vendor?.id || '',
        licenseTypeId: license.licenseTypeId || license.licenseType?.id || 3,
        totalSeats: license.totalSeats ?? license.total_seats ?? 10,
        cost: licCost,
        currency: license.currency || 'USD',
        startDate: (license.startDate || license.start_date || '').split('T')[0],
        endDate: license.endDate || license.end_date ? (license.endDate || license.end_date).split('T')[0] : '',
        autoRenew: Boolean(license.autoRenew),
        status: license.status || 'ACTIVE',
      });
    }
  }, [license]);

  // 2. Fetch Allocations (with user data)
  const {
    data: allocationsResponse,
    isLoading: isAllocationsLoading,
  } = useQuery<{ data: LicenseAllocation[]; meta: any }>({
    queryKey: ['license', id, 'allocations'],
    queryFn: async () => {
      return api.get(`/licenses/${id}/allocations`);
    },
    enabled: Boolean(id),
  });

  // 3. Fetch Covered Assets
  const {
    data: coveredAssetsResponse,
    isLoading: isAssetsLoading,
  } = useQuery<{ data: Asset[] } | Asset[]>({
    queryKey: ['license', id, 'assets'],
    queryFn: async () => {
      return api.get(`/licenses/${id}/assets`);
    },
    enabled: Boolean(id),
  });

  // 4. Fetch Renewals History
  const {
    data: renewalsResponse,
    isLoading: isRenewalsLoading,
  } = useQuery<{ data: LicenseRenewal[] } | LicenseRenewal[]>({
    queryKey: ['license', id, 'renewals'],
    queryFn: async () => {
      return api.get(`/licenses/${id}/renewals`);
    },
    enabled: Boolean(id),
  });

  // 5. Fetch Audit Trail Logs
  const {
    data: auditLogsResponse,
    isLoading: isAuditLoading,
  } = useQuery<{ data: any[]; meta: any }>({
    queryKey: ['audit-logs', 'license', id, auditPage],
    queryFn: async () => {
      return api.get('/audit-logs', {
        params: {
          tableName: 'licenses',
          page: auditPage,
          limit: 10,
        },
      });
    },
    enabled: Boolean(id) && activeTab === 'audit',
  });

  // 6. Fetch Assignable Users for Allocation Dialog
  const { data: usersResponse } = useQuery<{ data: User[] }>({
    queryKey: ['users', 'assignable'],
    queryFn: () => api.get('/users', { params: { limit: 100 } }),
    enabled: isAllocateModalOpen,
  });

  // 7. Fetch Available Assets for Linking
  const { data: availableAssetsResponse } = useQuery<{ data: Asset[] }>({
    queryKey: ['assets', 'linkable'],
    queryFn: () => api.get('/assets', { params: { limit: 100 } }),
    enabled: isLinkAssetModalOpen,
  });

  // 8. Fetch Vendors for Edit Modal
  const { data: vendorsResponse } = useQuery<{ data: Vendor[] }>({
    queryKey: ['vendors-dropdown'],
    queryFn: () => api.get('/vendors'),
    enabled: isEditModalOpen,
  });

  // Normalized Arrays
  const allocationsList = (allocationsResponse?.data || []) as any[];
  const activeAllocations = allocationsList.filter((a) => a.status === 'ACTIVE');
  const coveredAssets = Array.isArray(coveredAssetsResponse)
    ? coveredAssetsResponse
    : (coveredAssetsResponse as any)?.data || [];
  const renewals = Array.isArray(renewalsResponse)
    ? renewalsResponse
    : (renewalsResponse as any)?.data || [];
  const rawAuditLogs = auditLogsResponse?.data || [];
  const users = usersResponse?.data || [];
  const availableAssets = availableAssetsResponse?.data || [];
  const vendors = vendorsResponse?.data || [];

  // Filter audit logs relevant to this license
  const licenseAuditLogs = useMemo(() => {
    return rawAuditLogs.filter((log: any) => {
      return (
        log.recordId === id ||
        log.newData?.id === id ||
        log.oldData?.id === id ||
        log.newData?.license_id === id
      );
    });
  }, [rawAuditLogs, id]);

  // Filter users by search input in Allocate Seat modal
  const filteredUsers = useMemo(() => {
    if (!userSearchQuery.trim()) return users;
    const lower = userSearchQuery.toLowerCase();
    return users.filter(
      (u) =>
        u.fullName?.toLowerCase().includes(lower) ||
        u.email?.toLowerCase().includes(lower)
    );
  }, [users, userSearchQuery]);

  // Computed seat calculations
  const totalSeats = Number(license?.totalSeats ?? license?.total_seats ?? 1);
  const usedSeats = Number(license?.usedSeats ?? license?.used_seats ?? activeAllocations.length);
  const availableSeats = Number(license?.availableSeats ?? license?.available_seats ?? Math.max(0, totalSeats - usedSeats));
  const utilizationPct =
    totalSeats > 0 ? Math.min(100, Math.round((usedSeats / totalSeats) * 100)) : 0;
  const utilColor = getUtilizationColor(utilizationPct);

  // ============================================================================
  // Mutations
  // ============================================================================

  // 1. Allocate Seat Mutation
  const allocateSeatMutation = useMutation({
    mutationFn: (payload: { userId: string; notes?: string }) =>
      api.post(`/licenses/${id}/allocate`, payload),
    onSuccess: () => {
      toast.success('License seat allocated via sp_allocate_license_seat');
      setIsAllocateModalOpen(false);
      setSelectedUserId('');
      setAllocationNotes('');
      setUserSearchQuery('');
      queryClient.invalidateQueries({ queryKey: ['license', id] });
      queryClient.invalidateQueries({ queryKey: ['license', id, 'allocations'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Seat capacity exceeded or user already allocated');
    },
  });

  // 2. Release Seat Mutation
  const releaseSeatMutation = useMutation({
    mutationFn: (allocationId: string) =>
      api.post(`/allocations/${allocationId}/release`, {
        reason: 'Administrative deallocation via license console',
      }),
    onSuccess: () => {
      toast.info('Seat released via sp_release_license_seat');
      setReleaseAllocationTarget(null);
      queryClient.invalidateQueries({ queryKey: ['license', id] });
      queryClient.invalidateQueries({ queryKey: ['license', id, 'allocations'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to release seat allocation');
    },
  });

  // 3. Renew License Mutation
  const renewLicenseMutation = useMutation({
    mutationFn: (payload: typeof renewForm) => api.post(`/licenses/${id}/renew`, payload),
    onSuccess: () => {
      toast.success('License contract successfully renewed via sp_renew_license');
      setIsRenewModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['license', id] });
      queryClient.invalidateQueries({ queryKey: ['license', id, 'renewals'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Renewal validation error');
    },
  });

  // 4. Edit License Mutation
  const editLicenseMutation = useMutation({
    mutationFn: (payload: any) => api.patch(`/licenses/${id}`, payload),
    onSuccess: () => {
      toast.success('License parameters successfully updated');
      setIsEditModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['license', id] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update license');
    },
  });

  // 5. Link Asset Mutation
  const linkAssetMutation = useMutation({
    mutationFn: (assetId: string) => api.post(`/licenses/${id}/link-asset/${assetId}`, {}),
    onSuccess: () => {
      toast.success('Asset successfully linked to license coverage');
      setIsLinkAssetModalOpen(false);
      setSelectedAssetId('');
      queryClient.invalidateQueries({ queryKey: ['license', id, 'assets'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to link asset');
    },
  });

  // 6. Unlink Asset Mutation
  const unlinkAssetMutation = useMutation({
    mutationFn: (assetId: string) => api.delete(`/licenses/${id}/link-asset/${assetId}`),
    onSuccess: () => {
      toast.info('Asset coverage detached from license');
      queryClient.invalidateQueries({ queryKey: ['license', id, 'assets'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to unlink asset');
    },
  });

  // 7. Delete License Mutation
  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/licenses/${id}`),
    onSuccess: () => {
      toast.info('License contract moved to trash');
      navigate('/licenses');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete license');
    },
  });

  // ============================================================================
  // Action Handlers
  // ============================================================================

  const handleCopyKey = () => {
    if (!license?.licenseKey && !license?.license_key) return;
    const keyToCopy = isKeyRevealed
      ? license.licenseKey || license.license_key
      : license.license_key || license.licenseKey;
    navigator.clipboard.writeText(keyToCopy);
    setCopiedKey(true);
    toast.info('License key copied to clipboard');
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleRevealToggle = () => {
    setIsKeyRevealed((prev) => !prev);
    if (!isKeyRevealed) {
      toast.info('Audited action: License key access recorded in security audit log');
    }
  };

  const handleExportPdf = async () => {
    if (!id || !license) return;
    setIsExportingPdf(true);
    try {
      toast.info(`Generating official PDF dossier for ${license.name}...`);
      const token = getAccessToken();
      const response = await apiClient.get(`/licenses/${id}/pdf`, {
        responseType: 'blob',
        params: token ? { token } : undefined,
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `license-report-${license.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('License PDF dossier exported successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to export license PDF');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Loading & Error States
  if (isLicenseLoading) {
    return (
      <div className="space-y-6 pb-20">
        <div className="flex items-center gap-3">
          <Skeleton variant="avatar" className="w-9 h-9" />
          <div className="space-y-1.5">
            <Skeleton variant="text" className="w-56 h-6" />
            <Skeleton variant="text" className="w-32 h-4" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton variant="card" className="h-72" />
          <Skeleton variant="card" className="h-72" />
        </div>
      </div>
    );
  }

  if (licenseError || !license) {
    return (
      <Card className="text-center p-12 bg-slate-900 border border-slate-800 rounded-2xl max-w-lg mx-auto mt-10">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-100 mb-1">License Not Found</h3>
        <p className="text-xs text-slate-400 mb-5">
          The requested software license contract does not exist or has been removed from the registry.
        </p>
        <Button variant="primary" size="sm" onClick={() => navigate('/licenses')}>
          Back to Licenses
        </Button>
      </Card>
    );
  }

  const rawCost =
    typeof license.cost === 'object' && license.cost?.d
      ? Number(license.cost.d[0])
      : Number(license.cost || 0);
  const costPerSeat = totalSeats > 0 ? (rawCost / totalSeats).toFixed(2) : '0.00';
  const vendorName = license.vendor?.name || license.vendor_name || 'Independent Vendor';
  const maskedKey = maskKeyDisplay(license.license_key || license.licenseKey);
  const displayedKey = isKeyRevealed ? license.licenseKey || license.license_key : maskedKey;

  // Donut data
  const donutData = [
    { name: 'Allocated Seats', value: usedSeats, color: utilColor.hex },
    { name: 'Available Seats', value: Math.max(0, availableSeats), color: '#334155' },
  ];

  return (
    <div className="space-y-6 pb-20">
      {/* ====================================================================== */}
      {/* 1. Header: Name, Vendor Chip, Status Badge, Action Buttons             */}
      {/* ====================================================================== */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-start gap-3.5 min-w-0">
          <Link
            to="/licenses"
            className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-xl transition-colors shrink-0 mt-0.5"
            title="Back to licenses"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>

          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight truncate">
                {license.name}
              </h1>

              {/* Vendor Chip */}
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800/80 border border-slate-700 text-slate-300">
                <Building className="w-3.5 h-3.5 text-indigo-400" />
                <span>{vendorName}</span>
              </span>

              {/* Status Badge */}
              {license.status === 'ACTIVE' ? (
                <Badge variant="success" dot size="sm">
                  ACTIVE
                </Badge>
              ) : license.status === 'EXPIRED' ? (
                <Badge variant="danger" dot size="sm">
                  EXPIRED
                </Badge>
              ) : (
                <Badge variant="outline" size="sm">
                  {license.status}
                </Badge>
              )}
            </div>

            <p className="text-xs text-slate-400 flex items-center gap-2">
              <span>Contract ID: <span className="font-mono text-slate-300">{license.id?.slice(0, 8)}</span></span>
              <span>&bull;</span>
              <span>Model: <span className="text-slate-300 font-medium">{license.licenseType?.name || 'Standard'}</span></span>
              <span>&bull;</span>
              <span>Currency: <span className="font-mono text-slate-300">{license.currency || 'USD'}</span></span>
            </p>
          </div>
        </div>

        {/* Header Action Buttons (Renew, Export PDF, Edit, Delete) */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Renew Button */}
          {canManage && (
            <Button
              variant="primary"
              size="sm"
              iconLeft={<RotateCcw className="w-3.5 h-3.5" />}
              onClick={() => setIsRenewModalOpen(true)}
            >
              Renew
            </Button>
          )}

          {/* Export PDF Button */}
          <Button
            variant="secondary"
            size="sm"
            iconLeft={<Download className="w-3.5 h-3.5 text-amber-400" />}
            isLoading={isExportingPdf}
            onClick={handleExportPdf}
          >
            Export PDF
          </Button>

          {/* Edit Button */}
          {canManage && (
            <Button
              variant="secondary"
              size="sm"
              iconLeft={<Edit3 className="w-3.5 h-3.5 text-indigo-400" />}
              onClick={() => setIsEditModalOpen(true)}
            >
              Edit
            </Button>
          )}

          {/* Delete Button */}
          {canManage && (
            <Button
              variant="danger"
              size="sm"
              iconLeft={<Trash2 className="w-3.5 h-3.5" />}
              onClick={() => setIsDeleteModalOpen(true)}
            >
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* ====================================================================== */}
      {/* 2. Tab Navigation                                                      */}
      {/* ====================================================================== */}
      <div className="flex items-center gap-1 border-b border-slate-800 text-xs overflow-x-auto scrollbar-none">
        {[
          { key: 'overview', label: 'Overview', icon: KeyRound },
          {
            key: 'allocations',
            label: `Allocations (${activeAllocations.length})`,
            icon: Users2,
          },
          {
            key: 'assets',
            label: `Covered Assets (${coveredAssets.length})`,
            icon: ShieldCheck,
          },
          {
            key: 'renewals',
            label: `Renewals (${renewals.length})`,
            icon: History,
          },
          {
            key: 'audit',
            label: 'Audit Trail',
            icon: Clock,
          },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 px-4 py-3 font-semibold border-b-2 transition-all whitespace-nowrap ${
                isActive
                  ? 'border-indigo-500 text-indigo-400 bg-indigo-950/20'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-850'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ====================================================================== */}
      {/* TAB 1: OVERVIEW (Two-Column Layout)                                     */}
      {/* ====================================================================== */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-200">
          {/* Left Column: Key Info, Dates, Cost, Auto-Renew (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Masked Key Card with Reveal & Copy */}
            <Card className="bg-slate-900 border-slate-800 p-5 space-y-3.5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-indigo-400" />
                  <span className="font-bold text-xs uppercase tracking-wider text-slate-300">
                    License Key & Credentials
                  </span>
                </div>
                <Badge variant="outline" size="sm" className="text-[10px]">
                  Audited Access
                </Badge>
              </div>

              {/* Key Display Bar */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="font-mono text-sm tracking-wider text-slate-100 select-all truncate mr-3">
                  {displayedKey}
                </span>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Reveal / Hide Toggle (For Admins) */}
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRevealToggle}
                      iconLeft={
                        isKeyRevealed ? (
                          <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                        ) : (
                          <Eye className="w-3.5 h-3.5 text-indigo-400" />
                        )
                      }
                    >
                      {isKeyRevealed ? 'Hide' : 'Reveal'}
                    </Button>
                  )}

                  {/* Copy Button */}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleCopyKey}
                    iconLeft={
                      copiedKey ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                      )
                    }
                  >
                    {copiedKey ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </div>

              <p className="text-[11px] text-slate-500">
                All views, copy operations, and unmasking actions are immutable and stored in the security compliance ledger.
              </p>
            </Card>

            {/* Contract Dates & Validity Card */}
            <Card className="bg-slate-900 border-slate-800 p-5 space-y-4 shadow-sm">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-xs uppercase tracking-wider text-slate-300">
                  Contract Terms & Schedule
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">
                    Effective Start Date
                  </span>
                  <span className="font-semibold text-slate-200">
                    {license.startDate || license.start_date
                      ? new Date(license.startDate || license.start_date).toLocaleDateString()
                      : '—'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">
                    Expiration Date
                  </span>
                  <span className="font-semibold text-slate-200">
                    {license.endDate || license.end_date
                      ? new Date(license.endDate || license.end_date).toLocaleDateString()
                      : 'Perpetual Contract'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 col-span-2 sm:col-span-1">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">
                    Auto-Renewal Schedule
                  </span>
                  <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        license.autoRenew ? 'bg-emerald-400' : 'bg-slate-600'
                      }`}
                    />
                    {license.autoRenew ? 'Auto-Renew Enabled' : 'Manual Renewal'}
                  </span>
                </div>
              </div>
            </Card>

            {/* Financials & Seat Pricing Card */}
            <Card className="bg-slate-900 border-slate-800 p-5 space-y-4 shadow-sm">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-xs uppercase tracking-wider text-slate-300">
                  Financials & Commercial Pricing
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">
                    Total Contract Cost
                  </span>
                  <span className="font-mono font-bold text-base text-emerald-400">
                    ${rawCost.toFixed(2)} {license.currency || 'USD'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">
                    Cost per Contracted Seat
                  </span>
                  <span className="font-mono font-semibold text-slate-200 text-sm">
                    ${costPerSeat} / seat
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 col-span-2 sm:col-span-1">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">
                    Licensing Model
                  </span>
                  <span className="font-semibold text-slate-200">
                    {license.licenseType?.name || 'Commercial'}
                  </span>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Column: Seat Utilization Donut Chart & Compliance Summary (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Seat Utilization Donut Chart (Recharts PieChart) */}
            <Card className="bg-slate-900 border-slate-800 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs uppercase tracking-wider text-slate-300">
                  Seat Utilization Donut
                </span>
                <span className={`font-mono font-bold text-xs ${utilColor.text}`}>
                  {utilizationPct}% Utilized
                </span>
              </div>

              <div className="relative h-48 flex items-center justify-center">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      <Cell fill={utilColor.hex} />
                      <Cell fill="#334155" />
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: '#090d16',
                        borderColor: '#1e293b',
                        borderRadius: '8px',
                        fontSize: '11px',
                        color: '#f8fafc',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>

                {/* Center Stats */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-black font-mono text-slate-100">
                    {utilizationPct}%
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                    {usedSeats} / {totalSeats} seats
                  </span>
                </div>
              </div>

              {/* Donut Legend */}
              <div className="flex items-center justify-center gap-6 text-xs pt-1 border-t border-slate-800/80">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: utilColor.hex }}
                  />
                  <span className="text-slate-300 font-medium">
                    Allocated ({usedSeats})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                  <span className="text-slate-400 font-medium">
                    Available ({availableSeats})
                  </span>
                </div>
              </div>
            </Card>

            {/* Compliance Summary Card */}
            <Card className="bg-slate-900 border-slate-800 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs uppercase tracking-wider text-slate-300">
                  Compliance Summary
                </span>
                {utilizationPct >= 100 ? (
                  <Badge variant="danger" dot size="sm">
                    AT CAPACITY
                  </Badge>
                ) : license.status === 'EXPIRED' ? (
                  <Badge variant="danger" dot size="sm">
                    EXPIRED
                  </Badge>
                ) : (
                  <Badge variant="success" dot size="sm">
                    COMPLIANT
                  </Badge>
                )}
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                  <span className="font-semibold text-slate-200 block">
                    Quota Allocation Advisory
                  </span>
                  <p className="text-[11px] text-slate-400">
                    {availableSeats > 0
                      ? `${availableSeats} seats remain available for assignment to members.`
                      : 'Seat quota is fully allocated. Allocate additional seats by renewing or increasing contract capacity.'}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                  <span className="font-semibold text-slate-200 block">
                    Asset Attachment Status
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Covering {coveredAssets.length} enterprise repository assets under this contract.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ====================================================================== */}
      {/* TAB 2: ALLOCATIONS (Table + Allocate Seat Search Dialog)               */}
      {/* ====================================================================== */}
      {activeTab === 'allocations' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-200">
                Seat Allocations Ledger
              </h2>
              <p className="text-xs text-slate-400">
                Active seat holders provisioned via database stored procedure <code className="text-indigo-400">sp_allocate_license_seat</code>
              </p>
            </div>

            {canManage && (
              <Button
                variant="primary"
                size="sm"
                iconLeft={<Plus className="w-3.5 h-3.5" />}
                onClick={() => {
                  setIsAllocateModalOpen(true);
                  setSelectedUserId('');
                  setUserSearchQuery('');
                  setAllocationNotes('');
                }}
                disabled={availableSeats <= 0}
              >
                Allocate Seat
              </Button>
            )}
          </div>

          {/* Allocations Table */}
          {isAllocationsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} variant="row" />
              ))}
            </div>
          ) : activeAllocations.length === 0 ? (
            <Card className="text-center p-10 bg-slate-900 border border-slate-800 rounded-2xl">
              <Users2 className="w-10 h-10 text-slate-500 mx-auto mb-2 opacity-50" />
              <h4 className="text-sm font-bold text-slate-200">No Active Allocations</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                No users are currently assigned seats on this contract. Click &quot;Allocate Seat&quot; to assign a team member.
              </p>
            </Card>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Member</th>
                      <th className="py-3 px-4">Allocated Date</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Notes / Machine</th>
                      {canManage && <th className="py-3 px-4 text-right">Action</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {activeAllocations.map((alloc: any) => {
                      const userObj = alloc.user || {};
                      const userName = userObj.fullName || userObj.name || 'Assigned User';
                      const userEmail = userObj.email || '—';
                      const allocDate = alloc.allocatedAt || alloc.allocated_at;

                      return (
                        <tr key={alloc.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <Avatar name={userName} size="sm" />
                              <div>
                                <span className="font-semibold text-slate-100 block">
                                  {userName}
                                </span>
                                <span className="text-[11px] text-slate-400">{userEmail}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-300">
                            {allocDate ? new Date(allocDate).toLocaleDateString() : '—'}
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant="success" dot size="sm">
                              ACTIVE
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                            {alloc.notes || '—'}
                          </td>
                          {canManage && (
                            <td className="py-3 px-4 text-right">
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => setReleaseAllocationTarget(alloc)}
                              >
                                Release
                              </Button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ====================================================================== */}
      {/* TAB 3: COVERED ASSETS (Cards Grid + Link Asset)                        */}
      {/* ====================================================================== */}
      {activeTab === 'assets' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-200">
                Covered Digital Assets
              </h2>
              <p className="text-xs text-slate-400">
                Repository assets licensed under this contract and evaluated in licensing compliance
              </p>
            </div>

            {canManage && (
              <Button
                variant="primary"
                size="sm"
                iconLeft={<LinkIcon className="w-3.5 h-3.5" />}
                onClick={() => setIsLinkAssetModalOpen(true)}
              >
                Link Asset
              </Button>
            )}
          </div>

          {isAssetsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} variant="card" className="h-44" />
              ))}
            </div>
          ) : coveredAssets.length === 0 ? (
            <Card className="text-center p-10 bg-slate-900 border border-slate-800 rounded-2xl">
              <ShieldCheck className="w-10 h-10 text-slate-500 mx-auto mb-2 opacity-50" />
              <h4 className="text-sm font-bold text-slate-200">No Assets Covered</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                No repository assets have been attached to this license contract. Click &quot;Link Asset&quot; to associate an asset.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {coveredAssets.map((asset: any) => {
                const assetId = asset.id || asset.asset_id;
                const assetName = asset.name || asset.asset_name;
                const assetCode = asset.assetCode || asset.asset_code;
                const assetType = asset.assetType || asset.asset_type;
                const compliance = asset.complianceStatus || asset.compliance_status || 'COMPLIANT';

                return (
                  <Card
                    key={assetId}
                    hoverElevation
                    className="p-4 bg-slate-900 border-slate-800 flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" size="sm" className="font-mono text-[10px]">
                          {assetCode}
                        </Badge>

                        {compliance === 'COMPLIANT' ? (
                          <Badge variant="success" dot size="sm">
                            COMPLIANT
                          </Badge>
                        ) : compliance === 'EXPIRED_LICENSE' ? (
                          <Badge variant="danger" dot size="sm">
                            EXPIRED
                          </Badge>
                        ) : (
                          <Badge variant="warning" dot size="sm">
                            UNLICENSED
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-start gap-2.5">
                        <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 shrink-0">
                          {renderAssetTypeIcon(assetType)}
                        </div>
                        <div className="min-w-0">
                          <Link
                            to={`/assets/${assetId}`}
                            className="font-bold text-xs text-slate-100 hover:text-indigo-400 hover:underline block truncate"
                          >
                            {assetName}
                          </Link>
                          <span className="text-[11px] text-slate-500 capitalize">{assetType?.toLowerCase()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      <Link
                        to={`/assets/${assetId}`}
                        className="text-indigo-400 hover:underline flex items-center gap-1 font-semibold text-[11px]"
                      >
                        <span>View Asset</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>

                      {canManage && (
                        <button
                          type="button"
                          onClick={() => unlinkAssetMutation.mutate(assetId)}
                          className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                          title="Unlink coverage"
                        >
                          <Unlink className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ====================================================================== */}
      {/* TAB 4: RENEWALS (Timeline-Style Renewal History)                        */}
      {/* ====================================================================== */}
      {activeTab === 'renewals' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-200">
                Renewal Term Timeline
              </h2>
              <p className="text-xs text-slate-400">
                Audited extension history executed via stored procedure <code className="text-indigo-400">sp_renew_license</code>
              </p>
            </div>

            {canManage && (
              <Button
                variant="primary"
                size="sm"
                iconLeft={<RotateCcw className="w-3.5 h-3.5" />}
                onClick={() => setIsRenewModalOpen(true)}
              >
                Renew Contract
              </Button>
            )}
          </div>

          {isRenewalsLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} variant="card" className="h-28" />
              ))}
            </div>
          ) : renewals.length === 0 ? (
            <Card className="text-center p-10 bg-slate-900 border border-slate-800 rounded-2xl">
              <History className="w-10 h-10 text-slate-500 mx-auto mb-2 opacity-50" />
              <h4 className="text-sm font-bold text-slate-200">No Prior Renewals</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                This license is operating on its initial contract term. No renewal extensions have been recorded yet.
              </p>
            </Card>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-800">
              {renewals.map((r: any, idx: number) => {
                const renewedAtDate = r.renewedAt || r.renewed_at || r.createdAt;
                const oldEndDate = r.oldEndDate || r.old_end_date;
                const newEndDate = r.newEndDate || r.new_end_date;
                const renewalCost = typeof r.cost === 'object' && r.cost?.d ? Number(r.cost.d[0]) : Number(r.cost || 0);

                return (
                  <div key={r.id || idx} className="relative group">
                    {/* Timeline Dot */}
                    <div className="absolute -left-6 top-1.5 w-3.5 h-3.5 rounded-full bg-indigo-600 border-2 border-slate-900 ring-2 ring-indigo-500/30" />

                    <Card className="p-4 bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-100">
                              Contract Extension
                            </span>
                            <Badge variant="success" size="sm">
                              Completed
                            </Badge>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Executed on {renewedAtDate ? new Date(renewedAtDate).toLocaleDateString() : '—'}
                          </p>
                        </div>

                        <div className="font-mono font-bold text-emerald-400 text-xs">
                          ${renewalCost.toFixed(2)} {license.currency || 'USD'}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-800/80 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase block">Previous End Date</span>
                          <span className="font-semibold text-slate-300">
                            {oldEndDate ? new Date(oldEndDate).toLocaleDateString() : '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase block">Extended End Date</span>
                          <span className="font-semibold text-indigo-400">
                            {newEndDate ? new Date(newEndDate).toLocaleDateString() : '—'}
                          </span>
                        </div>
                      </div>

                      {r.notes && (
                        <p className="text-[11px] text-slate-400 italic mt-2.5 bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
                          &quot;{r.notes}&quot;
                        </p>
                      )}
                    </Card>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ====================================================================== */}
      {/* TAB 5: AUDIT TRAIL (Infinite Scroll Log with Diffs)                    */}
      {/* ====================================================================== */}
      {activeTab === 'audit' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-200">
                Immutable Audit Trail
              </h2>
              <p className="text-xs text-slate-400">
                Cryptographically protected change ledger from <code className="text-indigo-400">audit_logs</code> table
              </p>
            </div>
          </div>

          {isAuditLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} variant="row" className="h-20" />
              ))}
            </div>
          ) : licenseAuditLogs.length === 0 ? (
            <Card className="text-center p-10 bg-slate-900 border border-slate-800 rounded-2xl">
              <Clock className="w-10 h-10 text-slate-500 mx-auto mb-2 opacity-50" />
              <h4 className="text-sm font-bold text-slate-200">No Audit Events Logged</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                No changes have been recorded in the audit ledger for this license yet.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {licenseAuditLogs.map((log: any) => {
                const action = log.action || 'UPDATE';
                const userObj = log.user || {};
                const actorName = userObj.fullName || 'System Automated Trigger';
                const actorEmail = userObj.email || '';
                const timestamp = log.performedAt || log.performed_at;

                // Compute changed fields between oldData and newData
                const oldObj = log.oldData || log.old_data || {};
                const newObj = log.newData || log.new_data || {};
                const changedKeys = Array.from(
                  new Set([...Object.keys(oldObj), ...Object.keys(newObj)])
                ).filter(
                  (k) =>
                    !['updatedAt', 'updated_at', 'tenantId', 'tenant_id'].includes(k) &&
                    JSON.stringify(oldObj[k]) !== JSON.stringify(newObj[k])
                );

                return (
                  <Card key={log.id} className="p-4 bg-slate-900 border-slate-800 text-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        {action === 'INSERT' ? (
                          <div className="p-1.5 rounded-lg bg-emerald-950/60 border border-emerald-800/60 text-emerald-400">
                            <Plus className="w-3.5 h-3.5" />
                          </div>
                        ) : action === 'DELETE' ? (
                          <div className="p-1.5 rounded-lg bg-rose-950/60 border border-rose-800/60 text-rose-400">
                            <Trash2 className="w-3.5 h-3.5" />
                          </div>
                        ) : (
                          <div className="p-1.5 rounded-lg bg-indigo-950/60 border border-indigo-800/60 text-indigo-400">
                            <RotateCcw className="w-3.5 h-3.5" />
                          </div>
                        )}

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-200">{actorName}</span>
                            {actorEmail && <span className="text-[11px] text-slate-500">({actorEmail})</span>}
                          </div>
                          <span className="text-[11px] text-slate-500">
                            {timestamp ? new Date(timestamp).toLocaleString() : '—'}
                          </span>
                        </div>
                      </div>

                      <Badge
                        variant={action === 'INSERT' ? 'success' : action === 'DELETE' ? 'danger' : 'info'}
                        size="sm"
                      >
                        {action}
                      </Badge>
                    </div>

                    {/* Changed Fields Diff */}
                    {changedKeys.length > 0 && (
                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                          Modified Attributes Diff
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {changedKeys.map((k) => (
                            <span
                              key={k}
                              className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-[11px] font-mono"
                            >
                              <strong className="text-slate-300">{k}:</strong>{' '}
                              <span className="line-through text-rose-400">
                                {oldObj[k] !== undefined ? String(oldObj[k]) : 'null'}
                              </span>{' '}
                              &rarr;{' '}
                              <span className="text-emerald-400 font-bold">
                                {newObj[k] !== undefined ? String(newObj[k]) : 'null'}
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}

              {/* Pagination controls for audit trail */}
              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={auditPage <= 1}
                  onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="text-xs text-slate-400 font-medium">Page {auditPage}</span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={licenseAuditLogs.length < 10}
                  onClick={() => setAuditPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ====================================================================== */}
      {/* MODAL: Allocate Seat User Search Dialog                                */}
      {/* ====================================================================== */}
      {isAllocateModalOpen && (
        <Modal
          isOpen={isAllocateModalOpen}
          onClose={() => setIsAllocateModalOpen(false)}
          title="Allocate License Seat"
          description={`Assign a seat for "${license.name}" via stored procedure sp_allocate_license_seat`}
          maxWidth="md"
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setIsAllocateModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={!selectedUserId || allocateSeatMutation.isPending}
                isLoading={allocateSeatMutation.isPending}
                onClick={() =>
                  allocateSeatMutation.mutate({
                    userId: selectedUserId,
                    notes: allocationNotes,
                  })
                }
              >
                Confirm Allocation
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            {/* Live Search User Filter */}
            <Input
              label="Search Team Members"
              placeholder="Filter by employee name or email..."
              value={userSearchQuery}
              onChange={(e) => setUserSearchQuery(e.target.value)}
              iconLeft={<Search className="w-4 h-4 text-slate-500" />}
            />

            {/* User List with Selection */}
            <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-800 rounded-xl p-2 bg-slate-950">
              {filteredUsers.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">No employees matched your search</p>
              ) : (
                filteredUsers.map((u) => {
                  const isSelected = selectedUserId === u.id;
                  return (
                    <div
                      key={u.id}
                      onClick={() => setSelectedUserId(u.id)}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-indigo-600/20 border border-indigo-500/40 text-slate-100'
                          : 'hover:bg-slate-850 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar name={u.fullName} size="sm" />
                        <div className="min-w-0">
                          <span className="font-semibold text-xs truncate block">{u.fullName}</span>
                          <span className="text-[11px] text-slate-400 truncate block">{u.email}</span>
                        </div>
                      </div>
                      <input
                        type="radio"
                        name="allocate-user"
                        checked={isSelected}
                        onChange={() => setSelectedUserId(u.id)}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                    </div>
                  );
                })
              )}
            </div>

            <Input
              label="Assignment Notes / Workstation"
              placeholder="e.g. Workstation WS-984, Project authorization code"
              value={allocationNotes}
              onChange={(e) => setAllocationNotes(e.target.value)}
            />
          </div>
        </Modal>
      )}

      {/* ====================================================================== */}
      {/* MODAL: Renew License Modal (sp_renew_license)                          */}
      {/* ====================================================================== */}
      {isRenewModalOpen && (
        <Modal
          isOpen={isRenewModalOpen}
          onClose={() => setIsRenewModalOpen(false)}
          title="Renew License Contract"
          description={`Extend contract expiration for "${license.name}" via sp_renew_license`}
          maxWidth="md"
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setIsRenewModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                isLoading={renewLicenseMutation.isPending}
                onClick={() => renewLicenseMutation.mutate(renewForm)}
              >
                Execute Renewal
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <DatePicker
              label="New Extended End Date"
              required
              value={renewForm.newEndDate}
              onChange={(val) => setRenewForm({ ...renewForm, newEndDate: val })}
            />

            <Input
              type="number"
              step="0.01"
              min={0}
              label="Renewal Cost *"
              className="font-mono"
              value={renewForm.cost}
              onChange={(e) =>
                setRenewForm({ ...renewForm, cost: parseFloat(e.target.value) || 0 })
              }
            />

            <div>
              <label className="text-xs font-medium text-slate-400 block mb-1">
                Renewal Notes
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Annual commercial extension, PO #29384"
                value={renewForm.notes}
                onChange={(e) => setRenewForm({ ...renewForm, notes: e.target.value })}
                className="w-full bg-slate-950 text-slate-100 placeholder:text-slate-600 border border-slate-800 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
              />
            </div>
          </div>
        </Modal>
      )}

      {/* ====================================================================== */}
      {/* MODAL: Edit License Modal                                              */}
      {/* ====================================================================== */}
      {isEditModalOpen && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title="Edit License Contract"
          description={`Update parameters and terms for "${license.name}"`}
          maxWidth="lg"
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                isLoading={editLicenseMutation.isPending}
                onClick={() => editLicenseMutation.mutate(editForm)}
              >
                Save Changes
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <Input
              label="License Name *"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            />

            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Vendor *"
                value={editForm.vendorId}
                onChange={(e) => setEditForm({ ...editForm, vendorId: e.target.value })}
              >
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </Select>

              <Select
                label="License Status *"
                value={editForm.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="EXPIRED">EXPIRED</option>
                <option value="SUSPENDED">SUSPENDED</option>
                <option value="CANCELLED">CANCELLED</option>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                type="number"
                min={1}
                label="Total Seats *"
                value={editForm.totalSeats}
                onChange={(e) =>
                  setEditForm({ ...editForm, totalSeats: parseInt(e.target.value, 10) || 1 })
                }
              />

              <Input
                type="number"
                step="0.01"
                min={0}
                label="Cost *"
                className="font-mono"
                value={editForm.cost}
                onChange={(e) =>
                  setEditForm({ ...editForm, cost: parseFloat(e.target.value) || 0 })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <DatePicker
                label="Start Date"
                value={editForm.startDate}
                onChange={(val) => setEditForm({ ...editForm, startDate: val })}
              />

              <DatePicker
                label="End Date"
                value={editForm.endDate}
                onChange={(val) => setEditForm({ ...editForm, endDate: val })}
              />
            </div>
          </div>
        </Modal>
      )}

      {/* ====================================================================== */}
      {/* MODAL: Link Asset Modal                                                */}
      {/* ====================================================================== */}
      {isLinkAssetModalOpen && (
        <Modal
          isOpen={isLinkAssetModalOpen}
          onClose={() => setIsLinkAssetModalOpen(false)}
          title="Cover Digital Asset"
          description={`Attach an enterprise digital asset to license "${license.name}"`}
          maxWidth="md"
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setIsLinkAssetModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={!selectedAssetId || linkAssetMutation.isPending}
                isLoading={linkAssetMutation.isPending}
                onClick={() => linkAssetMutation.mutate(selectedAssetId)}
              >
                Link Asset
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <Select
              label="Select Repository Asset *"
              value={selectedAssetId}
              onChange={(e) => setSelectedAssetId(e.target.value)}
            >
              <option value="">Choose an asset to cover...</option>
              {availableAssets.map((a: any) => (
                <option key={a.id || a.asset_id} value={a.id || a.asset_id}>
                  {a.name || a.asset_name} ({a.assetCode || a.asset_code})
                </option>
              ))}
            </Select>
          </div>
        </Modal>
      )}

      {/* ====================================================================== */}
      {/* Confirm Seat Release Dialog                                            */}
      {/* ====================================================================== */}
      <ConfirmDialog
        isOpen={Boolean(releaseAllocationTarget)}
        onClose={() => setReleaseAllocationTarget(null)}
        onConfirm={() => {
          if (releaseAllocationTarget) {
            releaseSeatMutation.mutate(releaseAllocationTarget.id);
          }
        }}
        title="Release License Seat"
        message={`Are you sure you want to release the seat held by "${
          releaseAllocationTarget?.user?.fullName || 'this user'
        }"? The seat will immediately be available for reassignment via sp_release_license_seat.`}
        confirmLabel="Release Seat"
        variant="danger"
        isLoading={releaseSeatMutation.isPending}
      />

      {/* ====================================================================== */}
      {/* Confirm Delete License Dialog                                          */}
      {/* ====================================================================== */}
      <ConfirmDialog
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="Move License to Trash"
        message={`Are you sure you want to soft-delete license "${license.name}"? Active allocations will be terminated.`}
        confirmLabel="Delete License"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};
