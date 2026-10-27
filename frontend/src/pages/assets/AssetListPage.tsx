// ==============================================================================
// AssetVault: Modern Digital Asset Data Browser & Repository
// Course: BCSE307L Database Systems (Fall 2026-27)
// Grid/Table toggle, filter sidebar, bulk actions, slide-over drawer & URL sync
// ==============================================================================

import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, apiClient, getAccessToken } from '../../services/api';
import { Category, AssetType } from '../../types';
import { useToast } from '../../context/ToastContext';
import { RoleGate } from '../../components/auth/RoleGate';
import { Pagination } from '../../components/common/Pagination';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { TagInput } from '../../components/common/TagInput';
import { FileUrlField } from '../../components/common/FileUrlField';
import {
  Card,
  Badge,
  Button,
  Input,
  Select,
  Avatar,
  Skeleton,
} from '../../components/ui';
import {
  Plus,
  Upload,
  LayoutGrid,
  List as ListIcon,
  Trash2,
  RotateCcw,
  FileSpreadsheet,
  ExternalLink,
  FileCode,
  Image as ImageIcon,
  Video,
  FileText,
  Binary,
  Layers,
  File,
  Search,
  Filter,
  X,
  CheckSquare,
  Square,
  MinusSquare,
  Download,
  Tag as TagIcon,
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RefreshCw,
} from 'lucide-react';

// ==============================================================================
// 1. Asset Type Configuration & Icon Mapping
// ==============================================================================

interface AssetTypeConfig {
  type: AssetType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  textColor: string;
  badgeBg: string;
}

const ASSET_TYPE_CONFIGS: Record<string, AssetTypeConfig> = {
  SOFTWARE: {
    type: 'SOFTWARE',
    label: 'Software',
    icon: FileCode,
    textColor: 'text-indigo-400',
    badgeBg: 'bg-indigo-950/40 border-indigo-800/40',
  },
  DOCUMENT: {
    type: 'DOCUMENT',
    label: 'Document',
    icon: FileText,
    textColor: 'text-amber-400',
    badgeBg: 'bg-amber-950/40 border-amber-800/40',
  },
  IMAGE: {
    type: 'IMAGE',
    label: 'Image',
    icon: ImageIcon,
    textColor: 'text-emerald-400',
    badgeBg: 'bg-emerald-950/40 border-emerald-800/40',
  },
  VIDEO: {
    type: 'VIDEO',
    label: 'Video',
    icon: Video,
    textColor: 'text-rose-400',
    badgeBg: 'bg-rose-950/40 border-rose-800/40',
  },
  DATASET: {
    type: 'DATASET',
    label: 'Dataset',
    icon: Binary,
    textColor: 'text-cyan-400',
    badgeBg: 'bg-cyan-950/40 border-cyan-800/40',
  },
  FONT: {
    type: 'FONT',
    label: 'Font',
    icon: Layers,
    textColor: 'text-purple-400',
    badgeBg: 'bg-purple-950/40 border-purple-800/40',
  },
};

const DEFAULT_TYPE_CONFIG: AssetTypeConfig = {
  type: 'OTHER',
  label: 'Other',
  icon: File,
  textColor: 'text-slate-400',
  badgeBg: 'bg-slate-800/40 border-slate-700/40',
};

function getTypeConfig(type?: string): AssetTypeConfig {
  if (!type) return DEFAULT_TYPE_CONFIG;
  return ASSET_TYPE_CONFIGS[type.toUpperCase()] || DEFAULT_TYPE_CONFIG;
}

// ==============================================================================
// 2. Form Schema for Create Asset Slide-Over Drawer
// ==============================================================================

const createAssetSchema = z.object({
  name: z.string().min(2, 'Asset name must be at least 2 characters').max(200, 'Maximum 200 characters'),
  assetCode: z.string().min(2, 'Asset code must be at least 2 characters').max(50, 'Maximum 50 characters'),
  assetType: z.enum(['SOFTWARE', 'DOCUMENT', 'IMAGE', 'VIDEO', 'DATASET', 'FONT', 'AUDIO', 'OTHER']),
  categoryId: z.string().optional().nullable(),
  description: z.string().max(1000, 'Maximum 1000 characters').optional().nullable(),
  fileUrl: z
    .string()
    .trim()
    .refine((v) => !v || /^https?:\/\/.+/i.test(v), {
      message: 'Please enter a valid HTTP/HTTPS URL',
    })
    .optional(),
  tags: z.array(z.string()).default([]),
});

type CreateAssetFormValues = z.infer<typeof createAssetSchema>;

// ==============================================================================
// 3. Category Tree Node Interface & Component
// ==============================================================================

interface CategoryTreeNode {
  id: string;
  name: string;
  description?: string | null;
  parentId?: string | null;
  assetCount?: number;
  children: CategoryTreeNode[];
}

interface CategoryTreeProps {
  nodes: CategoryTreeNode[];
  selectedCategoryId: string;
  onSelect: (id: string) => void;
  depth?: number;
}

const CategoryTree: React.FC<CategoryTreeProps> = ({
  nodes,
  selectedCategoryId,
  onSelect,
  depth = 0,
}) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-0.5 text-xs">
      {nodes.map((node) => {
        const hasChildren = node.children && node.children.length > 0;
        const isSelected = selectedCategoryId === node.id;
        const isNodeExpanded = expanded[node.id] ?? false;

        return (
          <div key={node.id}>
            <div
              onClick={() => onSelect(node.id)}
              style={{ paddingLeft: `${depth * 14 + 6}px` }}
              className={`flex items-center justify-between py-1.5 pr-2 rounded-lg cursor-pointer transition-colors group ${
                isSelected
                  ? 'bg-indigo-600/15 text-indigo-400 font-semibold border border-indigo-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                {hasChildren ? (
                  <button
                    type="button"
                    onClick={(e) => toggleExpand(node.id, e)}
                    className="p-0.5 text-slate-500 hover:text-slate-300 rounded focus:outline-none"
                    aria-label={isNodeExpanded ? 'Collapse' : 'Expand'}
                  >
                    {isNodeExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </button>
                ) : (
                  <span className="w-4" />
                )}

                {hasChildren ? (
                  isNodeExpanded ? (
                    <FolderOpen className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  ) : (
                    <Folder className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  )
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-600 shrink-0 ml-1 mr-1" />
                )}

                <span className="truncate">{node.name}</span>
              </div>

              {node.assetCount !== undefined && node.assetCount > 0 && (
                <span className="ml-2 text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-500 font-mono">
                  {node.assetCount}
                </span>
              )}
            </div>

            {hasChildren && isNodeExpanded && (
              <CategoryTree
                nodes={node.children}
                selectedCategoryId={selectedCategoryId}
                onSelect={onSelect}
                depth={depth + 1}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

// ==============================================================================
// 4. Main AssetListPage Component
// ==============================================================================

export const AssetListPage: React.FC = () => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL state synchronization
  const q = searchParams.get('q') || '';
  const typesParam = searchParams.get('types') || searchParams.get('assetType') || '';
  const selectedTypes: string[] = useMemo(() => {
    return typesParam ? typesParam.split(',').filter(Boolean) : [];
  }, [typesParam]);

  const status = searchParams.get('status') || 'ACTIVE';
  const complianceStatus = searchParams.get('complianceStatus') || 'ALL';
  const categoryId = searchParams.get('categoryId') || '';
  const ownerParam = searchParams.get('owner') || '';
  const viewMode = (searchParams.get('view') || 'grid') as 'grid' | 'table';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '12', 10);
  const sort = searchParams.get('sort') || 'created_at';
  const order = (searchParams.get('order') || 'desc') as 'asc' | 'desc';

  // Local UI States
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [showAddTagModal, setShowAddTagModal] = useState(false);
  const [bulkTagName, setBulkTagName] = useState('');

  // CSV Import States
  const [csvContent, setCsvContent] = useState('');
  const [csvPreviewRows, setCsvPreviewRows] = useState<any[]>([]);

  // Search input local state for debouncing / responsive feel
  const [searchInput, setSearchInput] = useState(q);
  useEffect(() => {
    setSearchInput(q);
  }, [q]);

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

  // Reset all filters helper
  const handleResetFilters = () => {
    setSearchParams(new URLSearchParams({ view: viewMode, status: 'ACTIVE', page: '1', limit: String(limit) }));
    setSearchInput('');
  };

  // Active filter count calculation
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (q) count++;
    if (selectedTypes.length > 0) count += selectedTypes.length;
    if (status !== 'ACTIVE') count++;
    if (complianceStatus !== 'ALL') count++;
    if (categoryId) count++;
    if (ownerParam) count++;
    return count;
  }, [q, selectedTypes, status, complianceStatus, categoryId, ownerParam]);

  // ============================================================================
  // React Hook Form for Create Asset Slide-Over Drawer
  // ============================================================================
  const {
    register: registerCreate,
    handleSubmit: handleCreateSubmit,
    reset: resetCreateForm,
    control: createControl,
    formState: { errors: createErrors, isSubmitting: isCreatingSubmitting },
  } = useForm<CreateAssetFormValues>({
    resolver: zodResolver(createAssetSchema),
    defaultValues: {
      name: '',
      assetCode: '',
      assetType: 'SOFTWARE',
      categoryId: '',
      description: '',
      fileUrl: '',
      tags: [],
    },
  });

  // ============================================================================
  // Data Queries
  // ============================================================================

  // If exactly 1 type is selected, pass it to the backend. If multiple are selected,
  // we fetch all and filter in memory so the backend's strict single-type check isn't broken.
  const backendAssetType = selectedTypes.length === 1 ? selectedTypes[0] : undefined;

  const {
    data: assetsResponse,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      'assets',
      q,
      backendAssetType,
      status,
      complianceStatus,
      categoryId,
      ownerParam,
      page,
      limit,
      sort,
      order,
    ],
    queryFn: async () => {
      return api.get<{ data: any[]; meta: any }>('/assets', {
        q: q || undefined,
        assetType: backendAssetType,
        status: status === 'ALL' ? undefined : status,
        complianceStatus: complianceStatus === 'ALL' ? undefined : complianceStatus,
        categoryId: categoryId || undefined,
        ownerId: ownerParam && /^[0-9a-f-]{36}$/i.test(ownerParam) ? ownerParam : undefined,
        page,
        limit,
        sort,
        order,
      });
    },
  });

  // Categories Tree Query
  const { data: categoryTreeResponse } = useQuery({
    queryKey: ['categories', 'tree'],
    queryFn: async () => {
      try {
        const res = await api.get<any>('/categories/tree');
        return Array.isArray(res) ? (res as CategoryTreeNode[]) : (res?.data || []);
      } catch {
        return [] as CategoryTreeNode[];
      }
    },
  });

  // Flat Categories Query for Create Form Dropdown
  const { data: flatCategoriesResponse } = useQuery({
    queryKey: ['categories', 'flat'],
    queryFn: () => api.get<{ data: Category[] }>('/categories', { limit: 100 }),
  });

  // Flattened & parsed items
  const rawAssets = (assetsResponse?.data || []) as any[];
  const meta = assetsResponse?.meta;
  const categoryTree = (Array.isArray(categoryTreeResponse) ? categoryTreeResponse : (categoryTreeResponse as any)?.data || []) as CategoryTreeNode[];
  const flatCategories = (flatCategoriesResponse?.data || []) as Category[];

  // Client-side filtering if multiple types are selected
  const assets = useMemo(() => {
    let result = rawAssets;
    if (selectedTypes.length > 1) {
      result = result.filter((item) => {
        const itemType = (item.asset_type || item.assetType || '').toUpperCase();
        return selectedTypes.includes(itemType);
      });
    }
    if (ownerParam && !/^[0-9a-f-]{36}$/i.test(ownerParam)) {
      const lower = ownerParam.toLowerCase();
      result = result.filter((item) => {
        const ownerName = (item.owner_name || item.owner?.fullName || '').toLowerCase();
        const ownerEmail = (item.owner_email || item.owner?.email || '').toLowerCase();
        return ownerName.includes(lower) || ownerEmail.includes(lower);
      });
    }
    return result;
  }, [rawAssets, selectedTypes, ownerParam]);

  // ============================================================================
  // Mutations
  // ============================================================================

  // 1. Create Asset Mutation
  const createAssetMutation = useMutation({
    mutationFn: (payload: any) => api.post('/assets', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      resetCreateForm();
      setCreateDrawerOpen(false);
      toast.success('Asset successfully created in repository');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create asset');
    },
  });

  const onExecuteCreateAsset = (values: CreateAssetFormValues) => {
    const payload = {
      name: values.name.trim(),
      assetCode: values.assetCode.trim().toUpperCase(),
      assetType: values.assetType,
      categoryId: values.categoryId || null,
      description: values.description?.trim() || null,
      fileUrl: values.fileUrl?.trim() || undefined,
      fileSizeBytes: 1048576,
      checksumSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      tags: values.tags || [],
    };
    createAssetMutation.mutate(payload);
  };

  // 2. Soft Delete Mutation (Single)
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/assets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setDeleteTarget(null);
      toast.success('Asset moved to Trash', 'Soft Deleted');
    },
    onError: (err: any) => toast.error(err.message || 'Failed to delete asset'),
  });

  // 3. Restore Asset Mutation
  const restoreMutation = useMutation({
    mutationFn: (id: string) => api.post(`/assets/${id}/restore`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      toast.success('Asset restored to active catalog');
    },
    onError: (err: any) => toast.error(err.message || 'Failed to restore asset'),
  });

  // 4. Bulk Delete Mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => api.delete(`/assets/${id}`)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setShowBulkDeleteDialog(false);
      setSelectedIds(new Set());
      toast.success(`Successfully moved ${selectedIds.size} assets to Trash`);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Bulk delete encountered an issue');
    },
  });

  // 5. Bulk Add Tag Mutation
  const bulkAddTagMutation = useMutation({
    mutationFn: async ({ ids, tagName }: { ids: string[]; tagName: string }) => {
      for (const id of ids) {
        await api.post(`/assets/${id}/tags`, { tagNames: [tagName], tag: tagName }).catch(() => null);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setShowAddTagModal(false);
      setBulkTagName('');
      toast.success(`Tag applied to selected assets`);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to apply tags in bulk');
    },
  });

  // 6. Bulk CSV Import Mutation
  const bulkImportMutation = useMutation({
    mutationFn: (csvText: string) =>
      api.post('/assets/bulk-import', csvText, { 'Content-Type': 'text/csv' }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setShowCsvModal(false);
      setCsvContent('');
      setCsvPreviewRows([]);
      toast.success(res.data?.message || 'Bulk import completed successfully');
    },
    onError: (err: any) => {
      toast.error(err.message || 'CSV Bulk Import Failed - All changes rolled back');
    },
  });

  // ============================================================================
  // Selection Handlers
  // ============================================================================

  const allVisibleIds = useMemo(() => {
    return assets.map((a) => a.asset_id || a.id);
  }, [assets]);

  const isAllSelected = allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedIds.has(id));
  const isPartiallySelected =
    allVisibleIds.some((id) => selectedIds.has(id)) && !isAllSelected;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allVisibleIds));
    }
  };

  const toggleSelectRow = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  // ============================================================================
  // CSV Export Handlers
  // ============================================================================

  // Full Catalog Export
  const handleExportFullCsv = async () => {
    try {
      toast.info('Generating asset CSV export...');
      const token = getAccessToken();
      const response = await apiClient.get('/assets/export', {
        responseType: 'blob',
        params: token ? { token } : undefined,
      });
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `assets-export-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Asset catalog exported successfully.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to export CSV');
    }
  };

  // Selected Assets CSV Export
  const handleExportSelectedCsv = () => {
    if (selectedIds.size === 0) return;
    const selectedRows = assets.filter((a) => selectedIds.has(a.asset_id || a.id));
    const headers = ['asset_code', 'name', 'asset_type', 'status', 'compliance_status', 'category', 'created_at'];
    const rows = selectedRows.map((r) => [
      `"${(r.asset_code || r.assetCode || '').replace(/"/g, '""')}"`,
      `"${(r.asset_name || r.name || '').replace(/"/g, '""')}"`,
      `"${r.asset_type || r.assetType || ''}"`,
      `"${r.asset_status || r.status || ''}"`,
      `"${r.compliance_status || r.complianceStatus || 'UNLICENSED'}"`,
      `"${(r.category_name || r.category?.name || 'Uncategorized').replace(/"/g, '""')}"`,
      `"${r.created_at || r.createdAt || ''}"`,
    ]);

    const csvOutput = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `selected-assets-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    toast.success(`Exported ${selectedRows.length} assets to CSV`);
  };

  // CSV Import file reader
  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvContent(text);

      const lines = text.split('\n').filter((l) => l.trim().length > 0);
      if (lines.length > 1) {
        const rows = lines.slice(1, 6).map((line) => {
          const cols = line.split(',').map((c) => c.replace(/^"|"$/g, '').trim());
          return {
            assetCode: cols[0],
            name: cols[1],
            assetType: cols[2],
            description: cols[3],
          };
        });
        setCsvPreviewRows(rows);
      }
    };
    reader.readAsText(file);
  };

  // Keyboard shortcut to close slide-over drawer on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && createDrawerOpen) {
        setCreateDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [createDrawerOpen]);

  // Sorting helper
  const handleSortChange = (newSort: string) => {
    if (sort === newSort) {
      updateParams({ order: order === 'asc' ? 'desc' : 'asc' });
    } else {
      updateParams({ sort: newSort, order: 'desc' });
    }
  };

  // ============================================================================
  // Render Helpers for Compliance & Types
  // ============================================================================

  const renderComplianceBadge = (statusValue?: string) => {
    const normalized = (statusValue || 'UNLICENSED').toUpperCase();
    if (normalized === 'COMPLIANT') {
      return (
        <Badge variant="success" dot size="sm">
          COMPLIANT
        </Badge>
      );
    }
    if (normalized === 'EXPIRED' || normalized === 'EXPIRED_LICENSE') {
      return (
        <Badge variant="danger" dot size="sm">
          EXPIRED
        </Badge>
      );
    }
    return (
      <Badge variant="warning" dot size="sm">
        UNLICENSED
      </Badge>
    );
  };

  const renderTypeIcon = (type?: string, className = 'w-4 h-4') => {
    const config = getTypeConfig(type);
    const IconComp = config.icon;
    return <IconComp className={`${className} ${config.textColor}`} />;
  };

  // ============================================================================
  // Filter Sidebar Content (shared between desktop & mobile overlay)
  // ============================================================================

  const renderFilterSidebarContent = () => (
    <div className="space-y-6 text-xs text-slate-300">
      {/* Sidebar Header & Clear All */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-indigo-400" />
          <span className="font-bold text-sm text-slate-100 uppercase tracking-wider">Filters</span>
          {activeFilterCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600 text-white">
              {activeFilterCount}
            </span>
          )}
        </div>
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="text-[11px] font-medium text-indigo-400 hover:text-indigo-300 hover:underline"
          >
            Reset all
          </button>
        )}
      </div>

      {/* 1. Asset Type Multi-Select Checkboxes */}
      <div className="space-y-2.5">
        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Asset Types
        </label>
        <div className="space-y-1.5">
          {Object.values(ASSET_TYPE_CONFIGS).map((cfg) => {
            const isChecked = selectedTypes.includes(cfg.type);
            const Icon = cfg.icon;
            return (
              <label
                key={cfg.type}
                className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors border ${
                  isChecked
                    ? 'bg-indigo-600/10 border-indigo-500/40 text-slate-100'
                    : 'bg-slate-900/40 border-slate-800/80 hover:bg-slate-800/50 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {
                      const next = isChecked
                        ? selectedTypes.filter((t) => t !== cfg.type)
                        : [...selectedTypes, cfg.type];
                      updateParams({ types: next.length > 0 ? next.join(',') : undefined, assetType: undefined });
                    }}
                    className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900 w-3.5 h-3.5 cursor-pointer"
                  />
                  <div className="flex items-center gap-2">
                    <Icon className={`w-3.5 h-3.5 ${cfg.textColor}`} />
                    <span className="font-medium text-xs">{cfg.label}</span>
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* 2. Status Radio Group */}
      <div className="space-y-2.5 pt-3 border-t border-slate-800">
        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Catalog Status
        </label>
        <div className="space-y-1.5">
          {[
            { value: 'ACTIVE', label: 'Active Assets' },
            { value: 'ARCHIVED', label: 'Trash / Archived' },
            { value: 'ALL', label: 'All Catalog' },
          ].map((item) => (
            <label
              key={item.value}
              className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-colors border ${
                status === item.value
                  ? 'bg-indigo-600/10 border-indigo-500/40 text-slate-100 font-medium'
                  : 'bg-slate-900/40 border-slate-800/80 hover:bg-slate-800/50 text-slate-400 hover:text-slate-200'
              }`}
            >
              <input
                type="radio"
                name="status-filter"
                value={item.value}
                checked={status === item.value}
                onChange={() => updateParams({ status: item.value === 'ACTIVE' ? undefined : item.value })}
                className="text-indigo-600 border-slate-700 bg-slate-950 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* 3. Compliance Status Filter */}
      <div className="space-y-2.5 pt-3 border-t border-slate-800">
        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Compliance Status
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { value: 'ALL', label: 'All' },
            { value: 'COMPLIANT', label: 'Compliant' },
            { value: 'UNLICENSED', label: 'Unlicensed' },
            { value: 'EXPIRED_LICENSE', label: 'Expired' },
          ].map((item) => {
            const isSelected = complianceStatus === item.value;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => updateParams({ complianceStatus: item.value === 'ALL' ? undefined : item.value })}
                className={`py-1.5 px-2 rounded-lg text-left text-xs transition-all border flex items-center justify-between ${
                  isSelected
                    ? 'bg-indigo-600/15 border-indigo-500/50 text-indigo-300 font-semibold'
                    : 'bg-slate-900/40 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>{item.label}</span>
                {item.value !== 'ALL' && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      item.value === 'COMPLIANT'
                        ? 'bg-emerald-400'
                        : item.value === 'UNLICENSED'
                        ? 'bg-amber-400'
                        : 'bg-rose-400'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Category Tree Hierarchy Selector */}
      <div className="space-y-2.5 pt-3 border-t border-slate-800">
        <div className="flex items-center justify-between">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Category Hierarchy
          </label>
          {categoryId && (
            <button
              type="button"
              onClick={() => updateParams({ categoryId: undefined })}
              className="text-[10px] text-indigo-400 hover:underline"
            >
              Clear
            </button>
          )}
        </div>

        <div className="max-h-56 overflow-y-auto pr-1 space-y-1">
          <button
            type="button"
            onClick={() => updateParams({ categoryId: undefined })}
            className={`w-full flex items-center gap-2 py-1.5 px-2 rounded-lg text-left text-xs transition-colors ${
              !categoryId
                ? 'bg-indigo-600/15 text-indigo-300 font-semibold border border-indigo-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Folder className="w-3.5 h-3.5 text-slate-400" />
            <span>All Categories</span>
          </button>

          {categoryTree.length > 0 ? (
            <CategoryTree
              nodes={categoryTree}
              selectedCategoryId={categoryId}
              onSelect={(id) => updateParams({ categoryId: id === categoryId ? undefined : id })}
            />
          ) : flatCategories.length > 0 ? (
            <div className="space-y-0.5">
              {flatCategories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => updateParams({ categoryId: cat.id === categoryId ? undefined : cat.id })}
                  className={`w-full flex items-center justify-between py-1.5 px-2 rounded-lg text-left text-xs transition-colors ${
                    categoryId === cat.id
                      ? 'bg-indigo-600/15 text-indigo-300 font-semibold border border-indigo-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <span className="truncate">{cat.name}</span>
                  {cat._count?.assets ? (
                    <span className="text-[10px] text-slate-500 font-mono">{cat._count.assets}</span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-slate-500 italic p-2">No categories found</p>
          )}
        </div>
      </div>

      {/* 5. Owner Search Filter */}
      <div className="space-y-2 pt-3 border-t border-slate-800">
        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Owner Filter
        </label>
        <div className="relative">
          <Input
            inputSize="sm"
            placeholder="Search by owner name..."
            value={ownerParam}
            onChange={(e) => updateParams({ owner: e.target.value || undefined })}
            iconLeft={<Search className="w-3.5 h-3.5" />}
            rightAction={
              ownerParam ? (
                <button
                  type="button"
                  onClick={() => updateParams({ owner: undefined })}
                  className="p-1 hover:text-slate-200 text-slate-500"
                >
                  <X className="w-3 h-3" />
                </button>
              ) : undefined
            }
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-20">
      {/* ====================================================================== */}
      {/* Page Header & Global Top Actions                                       */}
      {/* ====================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">
              Digital Asset Repository
            </h1>
            {isFetching && (
              <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Enterprise digital catalog, multi-format media browser, and license compliance manager
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* CSV Bulk Import Button */}
          <RoleGate permission="assets:create">
            <Button
              variant="secondary"
              size="sm"
              iconLeft={<Upload className="w-3.5 h-3.5 text-slate-400" />}
              onClick={() => setShowCsvModal(true)}
            >
              Import CSV
            </Button>
          </RoleGate>

          {/* Export Full CSV Button */}
          <Button
            variant="secondary"
            size="sm"
            iconLeft={<FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />}
            onClick={handleExportFullCsv}
          >
            Export CSV
          </Button>

          {/* Add Asset Button (Opens Slide-Over Drawer) */}
          <RoleGate permission="assets:create">
            <Button
              variant="primary"
              size="sm"
              iconLeft={<Plus className="w-4 h-4" />}
              onClick={() => setCreateDrawerOpen(true)}
            >
              Add Asset
            </Button>
          </RoleGate>
        </div>
      </div>

      {/* ====================================================================== */}
      {/* Main Content Layout: Sidebar + Data View Container                      */}
      {/* ====================================================================== */}
      <div className="flex items-start gap-6">
        {/* Desktop Fixed Filter Sidebar */}
        <aside className="hidden lg:block w-64 shrink-0 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4.5 backdrop-blur-md shadow-lg sticky top-20">
          {renderFilterSidebarContent()}
        </aside>

        {/* Data View Main Container */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Top Search & Controls Bar */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-sm backdrop-blur-xs">
            {/* Search Input with Debounce/Immediate Sync */}
            <div className="flex-1 min-w-[220px] max-w-md">
              <Input
                inputSize="sm"
                placeholder="Search assets by name, code, SKU..."
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

            <div className="flex items-center gap-2 ml-auto">
              {/* Mobile Filter Sheet Trigger */}
              <button
                type="button"
                onClick={() => setMobileFilterOpen(true)}
                className="lg:hidden relative inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-750 transition-colors"
              >
                <Filter className="w-3.5 h-3.5 text-indigo-400" />
                <span>Filters</span>
                {activeFilterCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-indigo-600 text-[10px] font-bold text-white flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {/* Sort Dropdown */}
              <div className="flex items-center gap-1.5">
                <select
                  value={sort}
                  onChange={(e) => updateParams({ sort: e.target.value })}
                  aria-label="Sort by column"
                  className="py-1.5 px-2.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-300 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="created_at">Date Created</option>
                  <option value="name">Asset Name</option>
                  <option value="assetCode">Asset Code</option>
                  <option value="updatedAt">Recently Updated</option>
                </select>

                <button
                  type="button"
                  onClick={() => updateParams({ order: order === 'asc' ? 'desc' : 'asc' }, false)}
                  title={`Order: ${order === 'asc' ? 'Ascending' : 'Descending'}`}
                  className="p-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                >
                  {order === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* View Toggle: Grid vs Table */}
              <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 gap-0.5">
                <button
                  type="button"
                  onClick={() => updateParams({ view: 'grid' }, false)}
                  aria-label="Grid view"
                  className={`p-1.5 rounded-md transition-all ${
                    viewMode === 'grid'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Grid View"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => updateParams({ view: 'table' }, false)}
                  aria-label="Table view"
                  className={`p-1.5 rounded-md transition-all ${
                    viewMode === 'table'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Table View"
                >
                  <ListIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Error Banner */}
          {isError && (
            <div className="p-4 bg-rose-950/40 border border-rose-900/50 rounded-xl flex items-center justify-between text-xs text-rose-300">
              <span>{(error as any)?.message || 'Failed to load assets from repository.'}</span>
              <button
                type="button"
                onClick={() => refetch()}
                className="underline font-semibold hover:text-rose-100"
              >
                Retry
              </button>
            </div>
          )}

          {/* ================================================================== */}
          {/* Loading Skeletons                                                  */}
          {/* ================================================================== */}
          {isLoading ? (
            viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} variant="card" className="h-56" />
                ))}
              </div>
            ) : (
              <div className="space-y-2 bg-slate-900/40 border border-slate-800 rounded-xl p-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} variant="row" />
                ))}
              </div>
            )
          ) : assets.length === 0 ? (
            /* Empty State */
            <Card className="text-center p-12 bg-slate-900/40 border border-slate-800 rounded-2xl">
              <div className="w-14 h-14 rounded-2xl bg-indigo-950/40 border border-indigo-800/40 flex items-center justify-center mx-auto mb-4 text-indigo-400">
                <FileCode className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-100 mb-1">No Assets Found</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto mb-5">
                No digital assets match your current search criteria, category hierarchy, or status filters.
              </p>
              <div className="flex items-center justify-center gap-3">
                {activeFilterCount > 0 && (
                  <Button variant="secondary" size="sm" onClick={handleResetFilters}>
                    Clear Filters
                  </Button>
                )}
                <RoleGate permission="assets:create">
                  <Button
                    variant="primary"
                    size="sm"
                    iconLeft={<Plus className="w-4 h-4" />}
                    onClick={() => setCreateDrawerOpen(true)}
                  >
                    Add Asset
                  </Button>
                </RoleGate>
              </div>
            </Card>
          ) : viewMode === 'grid' ? (
            /* ================================================================== */
            /* Grid View Mode: Responsive Card Grid                               */
            /* ================================================================== */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {assets.map((asset) => {
                const id = asset.asset_id || asset.id;
                const name = asset.asset_name || asset.name;
                const code = asset.asset_code || asset.assetCode;
                const assetType = asset.asset_type || asset.assetType;
                const compliance = asset.compliance_status || asset.complianceStatus || 'UNLICENSED';
                const ownerName = asset.owner_name || asset.owner?.fullName || 'System';
                const rawDate = asset.created_at || asset.createdAt;
                const dateStr = rawDate ? new Date(rawDate).toLocaleDateString() : '';
                const tags = Array.isArray(asset.tags)
                  ? asset.tags.map((t: any) => (typeof t === 'string' ? t : t.tag?.name || t.name))
                  : [];
                const isSelected = selectedIds.has(id);

                return (
                  <Card
                    key={id}
                    hoverElevation
                    className={`flex flex-col justify-between transition-all relative ${
                      isSelected
                        ? 'border-indigo-500/80 bg-indigo-950/20 shadow-indigo-950/30 ring-1 ring-indigo-500/50'
                        : 'hover:border-slate-700'
                    }`}
                  >
                    <div className="p-4 space-y-3">
                      {/* Card Top: Checkbox, Code Badge & Compliance */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <button
                            type="button"
                            onClick={(e) => toggleSelectRow(id, e)}
                            className="text-slate-400 hover:text-indigo-400 transition-colors focus:outline-none"
                            aria-label={`Select asset ${name}`}
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-indigo-500" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-600 hover:text-slate-400" />
                            )}
                          </button>
                          <Badge variant="outline" size="sm" className="font-mono text-[10px] truncate">
                            {code}
                          </Badge>
                        </div>
                        {renderComplianceBadge(compliance)}
                      </div>

                      {/* Card Content: Icon, Title & Snippet */}
                      <div>
                        <div className="flex items-start gap-2.5 mb-1.5">
                          <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 shrink-0">
                            {renderTypeIcon(assetType, 'w-4 h-4')}
                          </div>
                          <Link
                            to={`/assets/${id}`}
                            className="font-bold text-sm text-slate-100 hover:text-indigo-400 hover:underline line-clamp-2 leading-snug transition-colors"
                          >
                            {name}
                          </Link>
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                          {asset.description || 'No description provided.'}
                        </p>
                      </div>

                      {/* Tag Chips */}
                      {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {tags.slice(0, 3).map((t: string, idx: number) => (
                            <span
                              key={idx}
                              className="px-1.5 py-0.5 rounded-md bg-slate-800 text-[10px] text-slate-400 font-medium"
                            >
                              #{t}
                            </span>
                          ))}
                          {tags.length > 3 && (
                            <span className="text-[10px] text-slate-500">+{tags.length - 3}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Card Footer: Owner, Date & Actions */}
                    <div className="px-4 py-3 bg-slate-950/40 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar name={ownerName} size="sm" />
                        <div className="min-w-0">
                          <p className="font-medium text-slate-300 truncate max-w-[100px] leading-tight">
                            {ownerName}
                          </p>
                          <p className="text-[10px] text-slate-500">{dateStr}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        {status === 'ARCHIVED' ? (
                          <button
                            type="button"
                            onClick={() => restoreMutation.mutate(id)}
                            className="p-1.5 text-emerald-400 hover:bg-emerald-950/40 rounded-lg transition-colors"
                            title="Restore Asset"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <RoleGate permission="assets:delete">
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(asset)}
                              className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors"
                              title="Move to Trash"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </RoleGate>
                        )}
                        <Link
                          to={`/assets/${id}`}
                          className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            /* ================================================================== */
            /* Table View Mode: Sortable Columns with Sticky Header               */
            /* ================================================================== */
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/90 backdrop-blur border-b border-slate-800 sticky top-0 z-10 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-4 w-10">
                        <button
                          type="button"
                          onClick={toggleSelectAll}
                          className="text-slate-400 hover:text-indigo-400 transition-colors focus:outline-none"
                          aria-label="Select all assets"
                        >
                          {isAllSelected ? (
                            <CheckSquare className="w-4 h-4 text-indigo-500" />
                          ) : isPartiallySelected ? (
                            <MinusSquare className="w-4 h-4 text-indigo-400" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-600" />
                          )}
                        </button>
                      </th>
                      <th
                        className="py-3 px-4 cursor-pointer hover:text-slate-200 transition-colors"
                        onClick={() => handleSortChange('name')}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Asset Details</span>
                          {sort === 'name' ? (
                            order === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-400" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-400" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-600" />
                          )}
                        </div>
                      </th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Compliance</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Owner</th>
                      <th
                        className="py-3 px-4 cursor-pointer hover:text-slate-200 transition-colors"
                        onClick={() => handleSortChange('created_at')}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Created Date</span>
                          {sort === 'created_at' ? (
                            order === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-400" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-400" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-600" />
                          )}
                        </div>
                      </th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {assets.map((asset) => {
                      const id = asset.asset_id || asset.id;
                      const name = asset.asset_name || asset.name;
                      const code = asset.asset_code || asset.assetCode;
                      const assetType = asset.asset_type || asset.assetType;
                      const compliance = asset.compliance_status || asset.complianceStatus || 'UNLICENSED';
                      const categoryName = asset.category_name || asset.category?.name || 'Uncategorized';
                      const ownerName = asset.owner_name || asset.owner?.fullName || 'System';
                      const rawDate = asset.created_at || asset.createdAt;
                      const dateStr = rawDate ? new Date(rawDate).toLocaleDateString() : '';
                      const isSelected = selectedIds.has(id);

                      return (
                        <tr
                          key={id}
                          className={`hover:bg-slate-800/40 transition-colors ${
                            isSelected ? 'bg-indigo-950/20' : ''
                          }`}
                        >
                          {/* Selection Checkbox */}
                          <td className="py-3.5 px-4">
                            <button
                              type="button"
                              onClick={(e) => toggleSelectRow(id, e)}
                              className="text-slate-400 hover:text-indigo-400 transition-colors focus:outline-none"
                              aria-label={`Select ${name}`}
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-indigo-500" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-600" />
                              )}
                            </button>
                          </td>

                          {/* Asset Name + Code */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 shrink-0">
                                {renderTypeIcon(assetType, 'w-4 h-4')}
                              </div>
                              <div>
                                <Link
                                  to={`/assets/${id}`}
                                  className="font-bold text-slate-100 hover:text-indigo-400 hover:underline block leading-snug"
                                >
                                  {name}
                                </Link>
                                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                                  <Badge variant="outline" size="sm" className="font-mono text-[10px] px-1.5 py-0">
                                    {code}
                                  </Badge>
                                  <span>&bull;</span>
                                  <span>v{asset.latest_version_no || 1}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Type */}
                          <td className="py-3.5 px-4">
                            <span className="font-medium text-slate-300">{assetType}</span>
                          </td>

                          {/* Compliance Status Badge */}
                          <td className="py-3.5 px-4">{renderComplianceBadge(compliance)}</td>

                          {/* Category */}
                          <td className="py-3.5 px-4 text-slate-400 font-medium">{categoryName}</td>

                          {/* Owner Avatar & Name */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <Avatar name={ownerName} size="sm" />
                              <span className="text-slate-300 truncate max-w-[120px]">{ownerName}</span>
                            </div>
                          </td>

                          {/* Created Date */}
                          <td className="py-3.5 px-4 text-slate-400">{dateStr}</td>

                          {/* Action Buttons */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {status === 'ARCHIVED' ? (
                                <button
                                  type="button"
                                  onClick={() => restoreMutation.mutate(id)}
                                  className="p-1.5 text-emerald-400 hover:bg-emerald-950/40 rounded-lg transition-colors"
                                  title="Restore Asset"
                                >
                                  <RotateCcw className="w-4 h-4" />
                                </button>
                              ) : (
                                <RoleGate permission="assets:delete">
                                  <button
                                    type="button"
                                    onClick={() => setDeleteTarget(asset)}
                                    className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors"
                                    title="Move to Trash"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </RoleGate>
                              )}
                              <Link
                                to={`/assets/${id}`}
                                className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition-colors"
                                title="View Details"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================================================================== */}
          {/* Pagination Container                                               */}
          {/* ================================================================== */}
          {assets.length > 0 && (
            <div className="rounded-xl overflow-hidden border border-slate-800">
              <Pagination
                meta={meta}
                currentPage={page}
                pageSize={limit}
                onPageChange={(newPage) => updateParams({ page: newPage }, false)}
                onLimitChange={(newLimit) => updateParams({ limit: newLimit, page: 1 }, false)}
              />
            </div>
          )}
        </div>
      </div>

      {/* ====================================================================== */}
      {/* Floating Bulk Actions Bar (Visible when selectedIds.size > 0)          */}
      {/* ====================================================================== */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-5 py-3 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-slate-700 shadow-2xl text-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <Badge variant="info" size="md" className="font-semibold">
            {selectedIds.size} Selected
          </Badge>

          <div className="h-5 w-px bg-slate-700" />

          {/* Bulk Export */}
          <Button
            variant="secondary"
            size="sm"
            iconLeft={<Download className="w-3.5 h-3.5 text-indigo-400" />}
            onClick={handleExportSelectedCsv}
          >
            Export CSV
          </Button>

          {/* Bulk Add Tag */}
          <Button
            variant="secondary"
            size="sm"
            iconLeft={<TagIcon className="w-3.5 h-3.5 text-emerald-400" />}
            onClick={() => setShowAddTagModal(true)}
          >
            Add Tag
          </Button>

          {/* Bulk Delete */}
          <RoleGate permission="assets:delete">
            <Button
              variant="danger"
              size="sm"
              iconLeft={<Trash2 className="w-3.5 h-3.5" />}
              onClick={() => setShowBulkDeleteDialog(true)}
            >
              Delete
            </Button>
          </RoleGate>

          {/* Deselect All */}
          <button
            type="button"
            onClick={clearSelection}
            className="p-1.5 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition-colors ml-1"
            title="Deselect All"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ====================================================================== */}
      {/* Mobile Collapsible Filter Drawer Overlay                                */}
      {/* ====================================================================== */}
      {mobileFilterOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileFilterOpen(false)}
          />

          {/* Drawer Sheet */}
          <div className="relative ml-auto w-full max-w-xs bg-slate-900 border-l border-slate-800 p-5 overflow-y-auto z-10 flex flex-col justify-between shadow-2xl">
            <div>
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
                <span className="font-bold text-sm text-slate-100">Filter Repository</span>
                <button
                  type="button"
                  onClick={() => setMobileFilterOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              {renderFilterSidebarContent()}
            </div>

            <div className="pt-6 border-t border-slate-800 mt-6">
              <Button
                variant="primary"
                size="md"
                className="w-full"
                onClick={() => setMobileFilterOpen(false)}
              >
                Apply Filters
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================== */}
      {/* Create Asset Slide-Over Drawer (React Hook Form + Zod)                  */}
      {/* ====================================================================== */}
      {createDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop Blur */}
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
            onClick={() => setCreateDrawerOpen(false)}
          />

          {/* Sliding Panel */}
          <div className="relative w-full max-w-lg bg-slate-900 border-l border-slate-800 shadow-2xl z-10 flex flex-col h-full transform transition-transform duration-300 ease-in-out">
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
              <div>
                <h2 className="text-base font-extrabold text-slate-100 tracking-tight">
                  Create Digital Asset
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Provision a new catalog item with versioning and licensing controls
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreateDrawerOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
                aria-label="Close drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Body */}
            <form
              id="create-asset-form"
              onSubmit={handleCreateSubmit(onExecuteCreateAsset)}
              className="flex-1 overflow-y-auto p-6 space-y-4"
            >
              {/* Asset Name */}
              <Input
                label="Asset Name *"
                placeholder="e.g. Enterprise Microservices Architecture Spec"
                error={createErrors.name?.message}
                {...registerCreate('name')}
              />

              <div className="grid grid-cols-2 gap-3">
                {/* Asset Code / SKU */}
                <Input
                  label="Asset Code (SKU) *"
                  placeholder="AST-SPEC-001"
                  className="font-mono uppercase"
                  error={createErrors.assetCode?.message}
                  {...registerCreate('assetCode')}
                />

                {/* Asset Type */}
                <Select
                  label="Asset Type *"
                  error={createErrors.assetType?.message}
                  {...registerCreate('assetType')}
                >
                  <option value="SOFTWARE">Software</option>
                  <option value="DOCUMENT">Document</option>
                  <option value="IMAGE">Image</option>
                  <option value="VIDEO">Video</option>
                  <option value="DATASET">Dataset</option>
                  <option value="FONT">Font</option>
                </Select>
              </div>

              {/* Category */}
              <Select
                label="Category"
                error={createErrors.categoryId?.message}
                {...registerCreate('categoryId')}
              >
                <option value="">Select Category (Optional)...</option>
                {flatCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Description</label>
                <textarea
                  rows={3}
                  placeholder="Technical details, intended usage, and license notes..."
                  className="w-full bg-slate-950 text-slate-100 placeholder:text-slate-600 border border-slate-800 rounded-lg p-3 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors resize-none"
                  {...registerCreate('description')}
                />
                {createErrors.description && (
                  <p className="text-xs text-rose-500 font-medium">
                    {createErrors.description.message}
                  </p>
                )}
              </div>

              {/* Initial File URL */}
              <div>
                <Controller
                  control={createControl}
                  name="fileUrl"
                  render={({ field }) => (
                    <FileUrlField
                      label="Initial File URL"
                      helperText="Object storage / CDN URL for Version 1.0 (Optional)"
                      value={field.value || ''}
                      onChange={field.onChange}
                      error={createErrors.fileUrl?.message}
                    />
                  )}
                />
              </div>

              {/* Tags */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Tags</label>
                <Controller
                  control={createControl}
                  name="tags"
                  render={({ field }) => (
                    <TagInput
                      tags={field.value || []}
                      onChange={field.onChange}
                      placeholder="Type tag and press Enter..."
                    />
                  )}
                />
              </div>
            </form>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-end gap-3 bg-slate-950/40">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => setCreateDrawerOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form="create-asset-form"
                variant="primary"
                size="md"
                isLoading={createAssetMutation.isPending || isCreatingSubmitting}
              >
                Create Asset
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================== */}
      {/* Modal: Bulk Add Tag Dialog                                             */}
      {/* ====================================================================== */}
      <Modal
        isOpen={showAddTagModal}
        onClose={() => setShowAddTagModal(false)}
        title="Add Tag to Selected Assets"
        description={`Apply a tag to all ${selectedIds.size} currently selected assets`}
        maxWidth="md"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowAddTagModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!bulkTagName.trim() || bulkAddTagMutation.isPending}
              isLoading={bulkAddTagMutation.isPending}
              onClick={() => {
                if (!bulkTagName.trim()) return;
                bulkAddTagMutation.mutate({
                  ids: Array.from(selectedIds),
                  tagName: bulkTagName.trim(),
                });
              }}
            >
              Apply Tag
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label="Tag Name"
            placeholder="e.g. production-ready, release-v2"
            value={bulkTagName}
            onChange={(e) => setBulkTagName(e.target.value)}
            autoFocus
          />
        </div>
      </Modal>

      {/* ====================================================================== */}
      {/* Confirm Bulk Delete Dialog                                             */}
      {/* ====================================================================== */}
      <ConfirmDialog
        isOpen={showBulkDeleteDialog}
        onClose={() => setShowBulkDeleteDialog(false)}
        onConfirm={() => bulkDeleteMutation.mutate(Array.from(selectedIds))}
        title="Move Selected Assets to Trash"
        message={`Are you sure you want to move ${selectedIds.size} assets to Trash? They can be restored later from the Archived filter.`}
        confirmLabel="Move to Trash"
        variant="danger"
        isLoading={bulkDeleteMutation.isPending}
      />

      {/* ====================================================================== */}
      {/* Confirm Single Soft-Delete Dialog                                      */}
      {/* ====================================================================== */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate(deleteTarget?.asset_id || deleteTarget?.id)}
        title="Move Asset to Trash"
        message={`Are you sure you want to move "${deleteTarget?.asset_name || deleteTarget?.name}" to trash? You can restore it later from the Archived filter.`}
        confirmLabel="Move to Trash"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />

      {/* ====================================================================== */}
      {/* Modal: Bulk CSV Import with Preview & Rollback guarantee               */}
      {/* ====================================================================== */}
      <Modal
        isOpen={showCsvModal}
        onClose={() => setShowCsvModal(false)}
        title="All-or-Nothing Bulk CSV Import"
        description="Upload CSV containing asset_code, name, asset_type, and description. Transactions roll back entirely on any error."
        maxWidth="xl"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowCsvModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!csvContent || bulkImportMutation.isPending}
              isLoading={bulkImportMutation.isPending}
              onClick={() => bulkImportMutation.mutate(csvContent)}
            >
              {bulkImportMutation.isPending ? 'Importing Atomic Batch...' : 'Execute Import'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="border-2 border-dashed border-slate-700 rounded-xl p-6 text-center hover:border-indigo-500 transition-colors">
            <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-200 mb-1">
              Select or drop your CSV file here
            </p>
            <p className="text-[11px] text-slate-400 mb-3">
              Must include headers: asset_code, name, asset_type, description
            </p>
            <input
              type="file"
              accept=".csv"
              onChange={handleCsvFileChange}
              className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-950 file:text-indigo-300 cursor-pointer"
            />
          </div>

          {csvPreviewRows.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wider mb-2">
                Preview (First {csvPreviewRows.length} Rows)
              </h4>
              <div className="border border-slate-800 rounded-lg overflow-x-auto text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-950/60 font-semibold text-slate-300 border-b border-slate-800">
                    <tr>
                      <th className="p-2">Code</th>
                      <th className="p-2">Name</th>
                      <th className="p-2">Type</th>
                      <th className="p-2">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {csvPreviewRows.map((r, i) => (
                      <tr key={i}>
                        <td className="p-2 font-mono">{r.assetCode}</td>
                        <td className="p-2 font-medium">{r.name}</td>
                        <td className="p-2">{r.assetType}</td>
                        <td className="p-2 text-slate-400 truncate max-w-xs">{r.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
