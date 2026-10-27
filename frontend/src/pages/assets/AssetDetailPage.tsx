// ==============================================================================
// AssetVault: Asset Detail Page
// Course: BCSE307L Database Systems (Fall 2026-27)
// Multi-tab view: Overview, Versions, Licenses, Access History
// ==============================================================================

import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Tag as TagIcon,
  Download,
  Upload,
  CheckCircle2,
  Clock,
  Edit,
  Trash2,
  Plus,
  ExternalLink,
  Copy,
  Check,
  GitCompare,
  Unlink,
} from 'lucide-react';
import { api } from '../../services/api';
import { Asset, AssetVersion, AssetAccessLog, License, Tag, Category } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { RoleGate } from '../../components/auth/RoleGate';
import { FileUrlField } from '../../components/common/FileUrlField';

export const AssetDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'overview' | 'versions' | 'licenses' | 'history'>('overview');
  const [copiedChecksum, setCopiedChecksum] = useState<string | null>(null);

  // Modals state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isUploadVersionOpen, setIsUploadVersionOpen] = useState(false);
  const [isAttachTagOpen, setIsAttachTagOpen] = useState(false);
  const [isLinkLicenseOpen, setIsLinkLicenseOpen] = useState(false);
  const [isCompareOpen, setIsCompareOpen] = useState(false);

  // Form states
  const [editForm, setEditForm] = useState<{
    name: string;
    description: string;
    assetType: string;
    status: string;
    categoryId: string;
  }>({
    name: '',
    description: '',
    assetType: 'DOCUMENT',
    status: 'ACTIVE',
    categoryId: '',
  });

  const [versionForm, setVersionForm] = useState({
    versionNo: 1,
    fileUrl: '',
    fileSizeBytes: 1024,
    checksumSha256: '',
    changeNotes: '',
  });

  const [selectedTagId, setSelectedTagId] = useState('');
  const [selectedLicenseId, setSelectedLicenseId] = useState('');
  const [compareV1, setCompareV1] = useState<number>(1);
  const [compareV2, setCompareV2] = useState<number>(2);

  // 1. Fetch Asset Detail
  const {
    data: asset,
    isLoading: isAssetLoading,
    error: assetError,
  } = useQuery<Asset>({
    queryKey: ['asset', id],
    queryFn: async () => {
      const res = await api.get<{ data: Asset }>(`/assets/${id}`);
      return res.data;
    },
    enabled: !!id,
  });

  React.useEffect(() => {
    if (asset) {
      setEditForm({
        name: asset.name,
        description: asset.description || '',
        assetType: asset.assetType,
        status: asset.status,
        categoryId: asset.categoryId || '',
      });
      if (asset.versions && asset.versions.length > 0) {
        setVersionForm((prev) => ({
          ...prev,
          versionNo: asset.versions!.length + 1,
        }));
        if (asset.versions.length >= 2) {
          setCompareV1(asset.versions[0].versionNo);
          setCompareV2(asset.versions[1].versionNo);
        }
      }
    }
  }, [asset]);

  // 2. Fetch Versions
  const { data: versions = [], isLoading: isVersionsLoading } = useQuery<AssetVersion[]>({
    queryKey: ['asset', id, 'versions'],
    queryFn: async () => {
      const res = await api.get<AssetVersion[] | { data: AssetVersion[] }>(`/assets/${id}/versions`);
      return Array.isArray(res) ? res : (res as any).data || [];
    },
    enabled: !!id && activeTab === 'versions',
  });

  // 3. Fetch Access Logs
  const { data: accessLogs = [], isLoading: isLogsLoading } = useQuery<AssetAccessLog[]>({
    queryKey: ['asset', id, 'access-logs'],
    queryFn: async () => {
      const res = await api.get<AssetAccessLog[] | { data: AssetAccessLog[] }>(`/assets/${id}/access-logs`);
      return Array.isArray(res) ? res : (res as any).data || [];
    },
    enabled: !!id && activeTab === 'history',
  });

  // 4. Fetch Available Tags for attachment modal
  const { data: availableTags = [] } = useQuery<Tag[]>({
    queryKey: ['tags'],
    queryFn: async () => {
      const res = await api.get<{ data: Tag[] }>('/tags');
      return res.data || [];
    },
    enabled: isAttachTagOpen,
  });

  // 5. Fetch Available Licenses for linking modal
  const { data: availableLicenses = [] } = useQuery<License[]>({
    queryKey: ['licenses', 'active'],
    queryFn: async () => {
      const res = await api.get<{ data: License[] }>('/licenses', { params: { status: 'ACTIVE', limit: 100 } });
      return res.data || [];
    },
    enabled: isLinkLicenseOpen,
  });

  // 6. Fetch Categories for edit modal
  const { data: rawCategories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const res: any = await api.get('/categories');
      if (Array.isArray(res)) return res;
      if (Array.isArray(res?.data)) return res.data;
      return [];
    },
    enabled: isEditOpen,
  });
  const categories = Array.isArray(rawCategories) ? rawCategories : [];

  // 7. Version Comparison Query
  const { data: rawComparisonData, isFetching: isComparing } = useQuery({
    queryKey: ['asset', id, 'compare', compareV1, compareV2],
    queryFn: async () => {
      const res = await api.get(`/assets/${id}/versions/compare`, {
        params: { from: compareV1, to: compareV2 },
      });
      return (res as any)?.data || res;
    },
    enabled: isCompareOpen && compareV1 !== compareV2,
  });
  const comparisonData = (rawComparisonData as any)?.data || rawComparisonData;

  // MUTATIONS
  // Update Asset
  const updateMutation = useMutation({
    mutationFn: (data: typeof editForm) => api.patch(`/assets/${id}`, data),
    onSuccess: () => {
      toast({ title: 'Success', message: 'Asset updated successfully', type: 'success' });
      setIsEditOpen(false);
      queryClient.invalidateQueries({ queryKey: ['asset', id] });
    },
    onError: (err: any) => {
      toast({ title: 'Error', message: err.message || 'Failed to update asset', type: 'error' });
    },
  });

  // Soft Delete Asset
  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/assets/${id}`),
    onSuccess: () => {
      toast({ title: 'Deleted', message: 'Asset moved to trash', type: 'info' });
      navigate('/assets');
    },
    onError: (err: any) => {
      toast({ title: 'Error', message: err.message || 'Failed to delete asset', type: 'error' });
    },
  });

  // Checkout Asset
  const checkoutMutation = useMutation({
    mutationFn: () => api.post(`/assets/${id}/checkout`, {}),
    onSuccess: () => {
      toast({ title: 'Checked Out', message: 'Asset checked out successfully', type: 'success' });
      queryClient.invalidateQueries({ queryKey: ['asset', id] });
      queryClient.invalidateQueries({ queryKey: ['asset', id, 'access-logs'] });
    },
    onError: (err: any) => {
      toast({ title: 'Checkout Failed', message: err.message || 'Could not checkout asset', type: 'error' });
    },
  });

  // Checkin Asset
  const checkinMutation = useMutation({
    mutationFn: () => api.post(`/assets/${id}/checkin`, {}),
    onSuccess: () => {
      toast({ title: 'Checked In', message: 'Asset checked in successfully', type: 'success' });
      queryClient.invalidateQueries({ queryKey: ['asset', id] });
      queryClient.invalidateQueries({ queryKey: ['asset', id, 'access-logs'] });
    },
    onError: (err: any) => {
      toast({ title: 'Checkin Failed', message: err.message || 'Could not checkin asset', type: 'error' });
    },
  });

  // Download Asset
  const handleDownload = async () => {
    try {
      const res = await api.get<{
        data?: { downloadUrl?: string; fileUrl?: string; message?: string };
        downloadUrl?: string;
        fileUrl?: string;
      }>(`/assets/${id}/download`);
      toast({ title: 'Authorized', message: 'Download authorized by license verification', type: 'success' });
      queryClient.invalidateQueries({ queryKey: ['asset', id, 'access-logs'] });
      const fileUrl = res.data?.fileUrl || (res as any).fileUrl || res.data?.downloadUrl;
      if (fileUrl) {
        window.open(fileUrl, '_blank');
      }
    } catch (err: any) {
      toast({
        title: 'Download Forbidden',
        message: err.message || 'Active license seat allocation required to download file',
        type: 'error',
      });
    }
  };

  // Upload Version Mutation
  const uploadVersionMutation = useMutation({
    mutationFn: (data: typeof versionForm) =>
      api.post(`/assets/${id}/versions`, {
        fileUrl: data.fileUrl,
        fileSize: Number(data.fileSizeBytes),
        checksum: data.checksumSha256,
        changelog: data.changeNotes,
      }),
    onSuccess: () => {
      toast({ title: 'Version Uploaded', message: 'New asset version created successfully', type: 'success' });
      setIsUploadVersionOpen(false);
      queryClient.invalidateQueries({ queryKey: ['asset', id] });
      queryClient.invalidateQueries({ queryKey: ['asset', id, 'versions'] });
    },
    onError: (err: any) => {
      toast({ title: 'Error', message: err.message || 'Failed to upload version', type: 'error' });
    },
  });

  // Attach Tag Mutation
  const attachTagMutation = useMutation({
    mutationFn: (tagId: string) => api.post(`/assets/${id}/tags`, { tagIds: [tagId] }),
    onSuccess: () => {
      toast({ title: 'Tag Attached', message: 'Tag linked to asset', type: 'success' });
      setIsAttachTagOpen(false);
      setSelectedTagId('');
      queryClient.invalidateQueries({ queryKey: ['asset', id] });
    },
    onError: (err: any) => {
      toast({ title: 'Error', message: err.message || 'Failed to attach tag', type: 'error' });
    },
  });

  // Detach Tag Mutation
  const detachTagMutation = useMutation({
    mutationFn: (tagId: string) => api.delete(`/assets/${id}/tags/${tagId}`),
    onSuccess: () => {
      toast({ title: 'Tag Removed', message: 'Tag unlinked from asset', type: 'info' });
      queryClient.invalidateQueries({ queryKey: ['asset', id] });
    },
    onError: (err: any) => {
      toast({ title: 'Error', message: err.message || 'Failed to detach tag', type: 'error' });
    },
  });

  // Link License Mutation
  const linkLicenseMutation = useMutation({
    mutationFn: (licenseId: string) => api.post(`/licenses/${licenseId}/link-asset/${id}`, {}),
    onSuccess: () => {
      toast({ title: 'License Linked', message: 'License covering this asset linked', type: 'success' });
      setIsLinkLicenseOpen(false);
      setSelectedLicenseId('');
      queryClient.invalidateQueries({ queryKey: ['asset', id] });
    },
    onError: (err: any) => {
      toast({ title: 'Error', message: err.message || 'Failed to link license', type: 'error' });
    },
  });

  // Unlink License Mutation
  const unlinkLicenseMutation = useMutation({
    mutationFn: (licenseId: string) => api.delete(`/licenses/${licenseId}/link-asset/${id}`),
    onSuccess: () => {
      toast({ title: 'License Unlinked', message: 'License coverage removed from asset', type: 'info' });
      queryClient.invalidateQueries({ queryKey: ['asset', id] });
    },
    onError: (err: any) => {
      toast({ title: 'Error', message: err.message || 'Failed to unlink license', type: 'error' });
    },
  });

  const copyToClipboard = (text: string, idStr: string) => {
    navigator.clipboard.writeText(text);
    setCopiedChecksum(idStr);
    setTimeout(() => setCopiedChecksum(null), 2000);
  };

  const formatBytes = (bytes: number | string) => {
    const num = Number(bytes);
    if (isNaN(num) || num === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(num) / Math.log(k));
    return `${parseFloat((num / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  if (isAssetLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse" />
          <div className="h-6 w-48 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
        </div>
        <LoadingSkeleton variant="card" count={2} />
      </div>
    );
  }

  if (assetError || !asset) {
    return (
      <div className="py-12">
        <EmptyState
          title="Asset Not Found"
          message="The requested digital asset does not exist or has been permanently removed."
          action={{
            label: 'Back to Assets',
            onClick: () => navigate('/assets'),
          }}
        />
      </div>
    );
  }

  const tagsList: Tag[] = Array.isArray(asset.tags)
    ? asset.tags.map((t: any) => (t.tag ? t.tag : t))
    : [];

  const attachedLicenses: License[] = Array.isArray(asset.assetLicenses)
    ? asset.assetLicenses.map((al: any) => (al.license ? al.license : al))
    : [];

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center space-x-3">
          <Link
            to="/assets"
            className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title="Back to assets"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center space-x-3">
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                {asset.assetCode}
              </span>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                {asset.name}
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Type: <span className="font-medium">{asset.assetType}</span> &bull; Created{' '}
              {new Date(asset.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Seat-Gated Download Button */}
          <button
            onClick={handleDownload}
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 shadow-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Download File
          </button>

          {/* Quick Checkout & Checkin Buttons */}
          <button
            onClick={() => checkoutMutation.mutate()}
            disabled={checkoutMutation.isPending}
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
          >
            <Clock className="w-3.5 h-3.5 mr-1.5 text-indigo-500" />
            Checkout
          </button>
          <button
            onClick={() => checkinMutation.mutate()}
            disabled={checkinMutation.isPending}
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
          >
            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-500" />
            Checkin
          </button>

          {/* Edit & Delete Actions (Asset Manager / Tenant Admin) */}
          <RoleGate roles={['TENANT_ADMIN', 'ASSET_MANAGER', 'SUPER_ADMIN']}>
            <button
              onClick={() => setIsEditOpen(true)}
              className="p-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title="Edit asset details"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsDeleteOpen(true)}
              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
              title="Delete asset"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </RoleGate>
        </div>
      </div>

      {/* Status & Compliance Quick Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800">
        <div>
          <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Status</span>
          <div className="mt-1">
            <StatusBadge status={asset.status} />
          </div>
        </div>
        <div>
          <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Compliance</span>
          <div className="mt-1">
            <StatusBadge status={asset.complianceStatus || 'UNLICENSED'} />
          </div>
        </div>
        <div>
          <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Category</span>
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1 truncate">
            {asset.category?.name || 'Uncategorized'}
          </p>
        </div>
        <div>
          <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Owner</span>
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1 truncate">
            {asset.owner?.fullName || 'System'}
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav className="flex space-x-6 overflow-x-auto" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-1 border-b-2 text-xs font-medium whitespace-nowrap transition-colors ${
              activeTab === 'overview'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
            }`}
          >
            Overview & Metadata
          </button>
          <button
            onClick={() => setActiveTab('versions')}
            className={`py-3 px-1 border-b-2 text-xs font-medium whitespace-nowrap transition-colors ${
              activeTab === 'versions'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
            }`}
          >
            Versions ({asset.versions?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('licenses')}
            className={`py-3 px-1 border-b-2 text-xs font-medium whitespace-nowrap transition-colors ${
              activeTab === 'licenses'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
            }`}
          >
            Covering Licenses ({attachedLicenses.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-3 px-1 border-b-2 text-xs font-medium whitespace-nowrap transition-colors ${
              activeTab === 'history'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
            }`}
          >
            Access History
          </button>
        </nav>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-x-0 space-y-6">
            {/* Description Card */}
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Description</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {asset.description || 'No description provided for this digital asset.'}
              </p>
            </div>

            {/* Structured Metadata Card */}
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Custom Metadata</h3>
                <span className="text-[10px] font-mono text-slate-400">JSONB Schema</span>
              </div>
              {asset.metadata && Object.keys(asset.metadata).length > 0 ? (
                <pre className="p-3 bg-slate-50 dark:bg-slate-950 rounded-lg text-xs font-mono text-slate-700 dark:text-slate-300 overflow-x-auto border border-slate-200 dark:border-slate-800">
                  {JSON.stringify(asset.metadata, null, 2)}
                </pre>
              ) : (
                <p className="text-xs text-slate-500 italic">No custom attributes assigned.</p>
              )}
            </div>
          </div>

          {/* Right Column: Taxonomy & Details */}
          <div className="space-y-6">
            {/* Tags Section */}
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Metadata Tags</h3>
                <RoleGate roles={['TENANT_ADMIN', 'ASSET_MANAGER']}>
                  <button
                    onClick={() => setIsAttachTagOpen(true)}
                    className="p-1 text-primary-600 hover:text-primary-700 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950/40 rounded transition-colors text-xs inline-flex items-center"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Attach
                  </button>
                </RoleGate>
              </div>

              <div className="flex flex-wrap gap-2">
                {tagsList.length > 0 ? (
                  tagsList.map((tag) => (
                    <span
                      key={tag.id}
                      className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border"
                      style={{
                        backgroundColor: `${tag.color}15`,
                        borderColor: `${tag.color}40`,
                        color: tag.color,
                      }}
                    >
                      <TagIcon className="w-3 h-3 mr-1" />
                      {tag.name}
                      <RoleGate roles={['TENANT_ADMIN', 'ASSET_MANAGER']}>
                        <button
                          onClick={() => detachTagMutation.mutate(tag.id)}
                          className="ml-1.5 hover:opacity-75 focus:outline-none"
                          title="Detach tag"
                        >
                          &times;
                        </button>
                      </RoleGate>
                    </span>
                  ))
                ) : (
                  <p className="text-xs text-slate-400">No tags associated with this asset.</p>
                )}
              </div>
            </div>

            {/* Asset Audit Stats */}
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 text-xs">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">Audit Information</h3>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Asset ID</span>
                <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300 truncate max-w-[150px]">
                  {asset.id}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Owner ID</span>
                <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300 truncate max-w-[150px]">
                  {asset.ownerId}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Created At</span>
                <span className="text-slate-700 dark:text-slate-300">
                  {new Date(asset.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Last Updated</span>
                <span className="text-slate-700 dark:text-slate-300">
                  {new Date(asset.updatedAt).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: VERSIONS */}
      {activeTab === 'versions' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Version History & Cryptographic Checksums
            </h3>
            <div className="flex items-center space-x-2">
              {versions.length >= 2 && (
                <button
                  onClick={() => setIsCompareOpen(true)}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
                >
                  <GitCompare className="w-3.5 h-3.5 mr-1.5 text-primary-500" />
                  Compare Versions
                </button>
              )}
              <RoleGate roles={['TENANT_ADMIN', 'ASSET_MANAGER']}>
                <button
                  onClick={() => setIsUploadVersionOpen(true)}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 shadow-sm transition-colors"
                >
                  <Upload className="w-3.5 h-3.5 mr-1.5" />
                  Upload New Version
                </button>
              </RoleGate>
            </div>
          </div>

          {isVersionsLoading ? (
            <LoadingSkeleton variant="table" />
          ) : versions.length === 0 ? (
            <EmptyState
              title="No Versions Available"
              message="No file versions have been uploaded for this asset yet."
              action={
                hasPermission('versions:create')
                  ? {
                      label: 'Upload First Version',
                      onClick: () => setIsUploadVersionOpen(true),
                    }
                  : undefined
              }
            />
          ) : (
            <div className="space-y-3">
              {versions.map((v) => (
                <div
                  key={v.id}
                  className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-3">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary-50 text-primary-700 dark:bg-primary-950/60 dark:text-primary-300 border border-primary-200 dark:border-primary-800">
                        v{v.versionNo}
                      </span>
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        {formatBytes(v.fileSizeBytes)}
                      </span>
                      <span className="text-xs text-slate-400">
                        &bull; Uploaded {new Date(v.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {v.changeNotes && (
                      <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 pl-1">
                        {v.changeNotes}
                      </p>
                    )}
                    <div className="flex items-center space-x-2 pt-1">
                      <span className="text-[10px] text-slate-400 uppercase font-mono">SHA256:</span>
                      <span className="text-[11px] font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded max-w-xs sm:max-w-md truncate">
                        {v.checksumSha256}
                      </span>
                      <button
                        onClick={() => copyToClipboard(v.checksumSha256, v.id)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                        title="Copy SHA-256 Checksum"
                      >
                        {copiedChecksum === v.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <a
                      href={v.fileUrl && /^(https?:\/\/|\/)/i.test(v.fileUrl) ? v.fileUrl : '#'}
                      onClick={(e) => {
                        if (!v.fileUrl || !/^(https?:\/\/|\/)/i.test(v.fileUrl)) {
                          e.preventDefault();
                          toast.error('Invalid or untrusted file URL scheme');
                        }
                      }}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5 mr-1" />
                      Get File
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: LICENSES */}
      {activeTab === 'licenses' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Covering Software & Digital Licenses
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Licenses that grant authorized access to this asset under compliance governance.
              </p>
            </div>
            <RoleGate roles={['TENANT_ADMIN', 'ASSET_MANAGER']}>
              <button
                onClick={() => setIsLinkLicenseOpen(true)}
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 shadow-sm transition-colors"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Link License
              </button>
            </RoleGate>
          </div>

          {attachedLicenses.length === 0 ? (
            <EmptyState
              title="No Covering Licenses"
              message="This asset is currently UNLICENSED. Link an active software license to maintain enterprise compliance."
              action={
                hasPermission('licenses:link_asset')
                  ? {
                      label: 'Link a License Now',
                      onClick: () => setIsLinkLicenseOpen(true),
                    }
                  : undefined
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {attachedLicenses.map((lic) => (
                <div
                  key={lic.id}
                  className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <Link
                        to={`/licenses/${lic.id}`}
                        className="text-sm font-bold text-slate-900 dark:text-white hover:text-primary-600 transition-colors flex items-center"
                      >
                        {lic.name}
                        <ExternalLink className="w-3 h-3 ml-1 text-slate-400" />
                      </Link>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Vendor: {lic.vendor?.name || 'Unknown'} &bull; Seats: {lic.totalSeats}
                      </p>
                    </div>
                    <StatusBadge status={lic.status} />
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
                    <span className="text-slate-500">
                      Expires: {lic.endDate ? new Date(lic.endDate).toLocaleDateString() : 'Perpetual'}
                    </span>
                    <RoleGate roles={['TENANT_ADMIN', 'ASSET_MANAGER']}>
                      <button
                        onClick={() => unlinkLicenseMutation.mutate(lic.id)}
                        className="text-rose-500 hover:text-rose-700 text-xs font-medium inline-flex items-center"
                      >
                        <Unlink className="w-3.5 h-3.5 mr-1" />
                        Unlink
                      </button>
                    </RoleGate>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: ACCESS HISTORY */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Access & Checkout Audit Trail</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Seat-gated event log tracking view, checkout, checkin, and download actions.
              </p>
            </div>
          </div>

          {isLogsLoading ? (
            <LoadingSkeleton variant="table" />
          ) : accessLogs.length === 0 ? (
            <EmptyState
              title="No Access Records"
              message="No checkout or download operations recorded for this asset yet."
            />
          ) : (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-850 text-slate-500 dark:text-slate-400 uppercase font-semibold">
                    <tr>
                      <th className="px-4 py-3">Action</th>
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3">IP Address</th>
                      <th className="px-4 py-3">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {accessLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                              log.action === 'CHECKOUT'
                                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
                                : log.action === 'CHECKIN'
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                                : log.action === 'DOWNLOAD'
                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-800 dark:text-slate-200">
                          {log.user ? `${log.user.fullName} (${log.user.email})` : 'Anonymous / System'}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-500 dark:text-slate-400">
                          {log.ipAddress || 'Internal'}
                        </td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                          {new Date(log.accessedAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* EDIT ASSET MODAL */}
      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Edit Asset Properties">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateMutation.mutate(editForm);
          }}
          className="space-y-4 text-xs"
        >
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Asset Name</label>
            <input
              type="text"
              required
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Description</label>
            <textarea
              rows={3}
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Asset Type</label>
              <select
                value={editForm.assetType}
                onChange={(e) => setEditForm({ ...editForm, assetType: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              >
                <option value="FONT">Font</option>
                <option value="IMAGE">Image</option>
                <option value="SOFTWARE">Software</option>
                <option value="DATASET">Dataset</option>
                <option value="VIDEO">Video</option>
                <option value="DOCUMENT">Document</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Status</label>
              <select
                value={editForm.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              >
                <option value="ACTIVE">Active</option>
                <option value="DRAFT">Draft</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Category</label>
            <select
              value={editForm.categoryId}
              onChange={(e) => setEditForm({ ...editForm, categoryId: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            >
              <option value="">None / Uncategorized</option>
              {(categories || []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsEditOpen(false)}
              className="px-3 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg shadow-sm"
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* UPLOAD VERSION MODAL */}
      <Modal isOpen={isUploadVersionOpen} onClose={() => setIsUploadVersionOpen(false)} title="Upload Asset Version">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            uploadVersionMutation.mutate(versionForm);
          }}
          className="space-y-4 text-xs"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Version Number</label>
              <input
                type="number"
                min="1"
                required
                value={versionForm.versionNo}
                onChange={(e) => setVersionForm({ ...versionForm, versionNo: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">File Size (bytes)</label>
              <input
                type="number"
                min="1"
                required
                value={versionForm.fileSizeBytes}
                onChange={(e) => setVersionForm({ ...versionForm, fileSizeBytes: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <FileUrlField
            value={versionForm.fileUrl}
            onChange={(val) => setVersionForm({ ...versionForm, fileUrl: val })}
            required
            placeholder="https://storage.assetvault.io/..."
          />

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
              SHA-256 Checksum (Hex 64 chars)
            </label>
            <input
              type="text"
              required
              maxLength={64}
              placeholder="e.g. 5d41402abc4b2a76b9719d911017c592..."
              value={versionForm.checksumSha256}
              onChange={(e) => setVersionForm({ ...versionForm, checksumSha256: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Change Notes</label>
            <textarea
              rows={2}
              placeholder="Summary of modifications in this release..."
              value={versionForm.changeNotes}
              onChange={(e) => setVersionForm({ ...versionForm, changeNotes: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsUploadVersionOpen(false)}
              className="px-3 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploadVersionMutation.isPending}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg shadow-sm"
            >
              {uploadVersionMutation.isPending ? 'Uploading...' : 'Upload Version'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ATTACH TAG MODAL */}
      <Modal isOpen={isAttachTagOpen} onClose={() => setIsAttachTagOpen(false)} title="Attach Metadata Tag">
        <div className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Select Tag</label>
            <select
              value={selectedTagId}
              onChange={(e) => setSelectedTagId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            >
              <option value="">-- Choose a Tag --</option>
              {availableTags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsAttachTagOpen(false)}
              className="px-3 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!selectedTagId || attachTagMutation.isPending}
              onClick={() => attachTagMutation.mutate(selectedTagId)}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg shadow-sm disabled:opacity-50"
            >
              {attachTagMutation.isPending ? 'Attaching...' : 'Attach Tag'}
            </button>
          </div>
        </div>
      </Modal>

      {/* LINK LICENSE MODAL */}
      <Modal isOpen={isLinkLicenseOpen} onClose={() => setIsLinkLicenseOpen(false)} title="Link Covering License">
        <div className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Active License</label>
            <select
              value={selectedLicenseId}
              onChange={(e) => setSelectedLicenseId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            >
              <option value="">-- Choose Active License --</option>
              {availableLicenses.map((lic) => (
                <option key={lic.id} value={lic.id}>
                  {lic.name} ({lic.vendor?.name || 'Vendor'}) - {lic.totalSeats} seats
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsLinkLicenseOpen(false)}
              className="px-3 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!selectedLicenseId || linkLicenseMutation.isPending}
              onClick={() => linkLicenseMutation.mutate(selectedLicenseId)}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg shadow-sm disabled:opacity-50"
            >
              {linkLicenseMutation.isPending ? 'Linking...' : 'Link to Asset'}
            </button>
          </div>
        </div>
      </Modal>

      {/* COMPARE VERSIONS MODAL */}
      <Modal isOpen={isCompareOpen} onClose={() => setIsCompareOpen(false)} title="Compare Asset Versions">
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Base Version</label>
              <select
                value={compareV1}
                onChange={(e) => setCompareV1(parseInt(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.versionNo}>
                    v{v.versionNo} ({formatBytes(v.fileSizeBytes)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Target Version</label>
              <select
                value={compareV2}
                onChange={(e) => setCompareV2(parseInt(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.versionNo}>
                    v{v.versionNo} ({formatBytes(v.fileSizeBytes)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {compareV1 === compareV2 ? (
            <p className="text-amber-500 italic">Please select two distinct versions to compare.</p>
          ) : isComparing ? (
            <div className="py-6 text-center text-slate-400">Comparing cryptographic checksums...</div>
          ) : comparisonData ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-800">
                  <div className="font-semibold text-slate-700 dark:text-slate-300">
                    Base: v{comparisonData.from?.versionNo ?? compareV1}
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 truncate">
                    Size: {formatBytes(comparisonData.from?.fileSizeBytes || 0)}
                  </div>
                  <div
                    className="font-mono text-[10px] text-slate-400 truncate"
                    title={comparisonData.from?.checksumSha256}
                  >
                    SHA: {comparisonData.from?.checksumSha256?.substring(0, 16)}...
                  </div>
                </div>
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-800">
                  <div className="font-semibold text-slate-700 dark:text-slate-300">
                    Target: v{comparisonData.to?.versionNo ?? compareV2}
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 truncate">
                    Size: {formatBytes(comparisonData.to?.fileSizeBytes || 0)}
                  </div>
                  <div
                    className="font-mono text-[10px] text-slate-400 truncate"
                    title={comparisonData.to?.checksumSha256}
                  >
                    SHA: {comparisonData.to?.checksumSha256?.substring(0, 16)}...
                  </div>
                </div>
              </div>

              {comparisonData.comparison && (
                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Diff Analysis:</span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500">Version Delta:</span>{' '}
                      <span className="font-mono font-bold text-primary-600">
                        {comparisonData.comparison.versionDelta > 0
                          ? `+${comparisonData.comparison.versionDelta}`
                          : comparisonData.comparison.versionDelta}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Size Delta:</span>{' '}
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                        {comparisonData.comparison.sizeDeltaBytes > 0 ? '+' : ''}
                        {formatBytes(comparisonData.comparison.sizeDeltaBytes)}
                      </span>
                    </div>
                    <div className="col-span-2 flex items-center gap-2">
                      <span className="text-slate-500">Checksum Status:</span>
                      {comparisonData.comparison.checksumIdentical ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          Identical Binaries
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                          Modified Content
                        </span>
                      )}
                    </div>
                    {comparisonData.comparison.changeNotes && (
                      <div className="col-span-2 pt-1 border-t border-slate-200 dark:border-slate-800">
                        <span className="text-slate-500">Change Notes:</span>{' '}
                        <p className="text-slate-700 dark:text-slate-300 italic mt-0.5">
                          "{comparisonData.comparison.changeNotes}"
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-slate-500">No comparison data available.</p>
          )}

          <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsCompareOpen(false)}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium rounded-lg"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* CONFIRM DELETE DIALOG */}
      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="Move Asset to Trash"
        message={`Are you sure you want to soft-delete "${asset.name}"? This will detach covering licenses and disable checkout access.`}
        confirmText="Delete Asset"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};
