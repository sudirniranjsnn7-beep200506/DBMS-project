// ==============================================================================
// AssetVault: Category Taxonomy Management
// Course: BCSE307L Database Systems (Fall 2026-27)
// Hierarchical category tree (/api/categories/tree), cycle prevention, & asset counts
// ==============================================================================

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FolderTree,
  Plus,
  Trash2,
  Edit2,
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  LayoutGrid,
  ListTree,
} from 'lucide-react';
import { api } from '../../services/api';
import { Category } from '../../types';
import { useToast } from '../../context/ToastContext';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { RoleGate } from '../../components/auth/RoleGate';

export const CategoryListPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [viewMode, setViewMode] = useState<'tree' | 'grid'>('tree');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deleteCategory, setDeleteCategory] = useState<Category | null>(null);

  const [form, setForm] = useState({
    name: '',
    description: '',
    parentId: '',
  });
  const [categoryErrors, setCategoryErrors] = useState<Record<string, string>>({});

  // 1. Fetch Flat Categories List
  const {
    data: rawFlatCategories,
    isLoading: isFlatLoading,
    isError: isFlatError,
    error: flatError,
    refetch: refetchFlat,
  } = useQuery({
    queryKey: ['categories', 'flat'],
    queryFn: async () => {
      const res: any = await api.get('/categories');
      if (Array.isArray(res)) return res;
      if (Array.isArray(res?.data)) return res.data;
      if (Array.isArray(res?.data?.data)) return res.data.data;
      return [];
    },
  });

  // 2. Fetch Nested Categories Tree (/api/categories/tree)
  const {
    data: rawCategoryTree,
    isLoading: isTreeLoading,
    isError: isTreeError,
    error: treeError,
    refetch: refetchTree,
  } = useQuery({
    queryKey: ['categories', 'tree'],
    queryFn: async () => {
      const res: any = await api.get('/categories/tree');
      if (Array.isArray(res)) return res;
      if (Array.isArray(res?.data)) return res.data;
      if (Array.isArray(res?.data?.data)) return res.data.data;
      return [];
    },
  });

  const flatCategories: Category[] = Array.isArray(rawFlatCategories)
    ? rawFlatCategories
    : Array.isArray((rawFlatCategories as any)?.data)
    ? (rawFlatCategories as any).data
    : [];

  const categoryTree: Category[] = Array.isArray(rawCategoryTree)
    ? rawCategoryTree
    : Array.isArray((rawCategoryTree as any)?.data)
    ? (rawCategoryTree as any).data
    : [];

  // MUTATIONS
  // Create or Update Category
  const saveMutation = useMutation({
    mutationFn: (data: typeof form) => {
      const payload = {
        name: data.name,
        description: data.description || undefined,
        parentId: data.parentId || undefined,
      };
      if (editingCategory) {
        return api.patch(`/categories/${editingCategory.id}`, payload);
      }
      return api.post('/categories', payload);
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        message: editingCategory ? 'Category updated' : 'Category created',
        type: 'success',
      });
      setIsModalOpen(false);
      setEditingCategory(null);
      setForm({ name: '', description: '', parentId: '' });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: (err: any) => {
      toast({
        title: 'Category Error',
        message: err.message || 'Operation failed. Cycles or duplicate names are forbidden.',
        type: 'error',
      });
    },
  });

  // Delete Category (409 Conflict if children or assets exist)
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/categories/${id}`),
    onSuccess: () => {
      toast({ title: 'Category Deleted', message: 'Category removed', type: 'info' });
      setDeleteCategory(null);
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: (err: any) => {
      toast({
        title: 'Cannot Delete Category',
        message: err.message || 'Category has associated sub-categories or digital assets.',
        type: 'error',
      });
    },
  });

  const toggleExpand = (id: string) => {
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Recursive Tree Node Renderer
  const renderTreeNode = (node: Category, depth: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes[node.id] ?? true;

    return (
      <div key={node.id} className="space-y-1">
        <div
          className={`flex items-center justify-between p-2.5 rounded-lg border transition-all ${
            depth === 0
              ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm'
              : 'bg-slate-50/70 dark:bg-slate-850/50 border-slate-200/60 dark:border-slate-800/60'
          }`}
          style={{ marginLeft: `${depth * 24}px` }}
        >
          <div className="flex items-center space-x-2">
            {hasChildren ? (
              <button
                onClick={() => toggleExpand(node.id)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
              >
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            ) : (
              <span className="w-6" />
            )}

            {isExpanded && hasChildren ? (
              <FolderOpen className="w-4 h-4 text-primary-500" />
            ) : (
              <Folder className="w-4 h-4 text-slate-400" />
            )}

            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white">{node.name}</span>
              {node.description && (
                <span className="text-[11px] text-slate-400 ml-2 hidden sm:inline truncate max-w-xs">
                  — {node.description}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {node._count?.assets ?? 0} assets
            </span>

            <RoleGate roles={['TENANT_ADMIN', 'ASSET_MANAGER']}>
              <button
                onClick={() => {
                  setEditingCategory(node);
                  setForm({
                    name: node.name,
                    description: node.description || '',
                    parentId: node.parentId || '',
                  });
                  setIsModalOpen(true);
                }}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
                title="Edit Category"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setDeleteCategory(node)}
                className="p-1 text-slate-400 hover:text-rose-500 rounded"
                title="Delete Category"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </RoleGate>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="space-y-1">
            {node.children!.map((child) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const isLoading = isFlatLoading || isTreeLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400">
              <FolderTree className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Taxonomy Categories
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Hierarchical tree classification with cycle detection and asset dependency guards.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setViewMode('tree')}
              className={`p-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'tree'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
              }`}
              title="Tree View"
            >
              <ListTree className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>

          <RoleGate roles={['TENANT_ADMIN', 'ASSET_MANAGER']}>
            <button
              onClick={() => {
                setEditingCategory(null);
                setForm({ name: '', description: '', parentId: '' });
                setCategoryErrors({});
                setIsModalOpen(true);
              }}
              className="inline-flex items-center px-3.5 py-2 text-xs font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 shadow-sm transition-colors"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              New Category
            </button>
          </RoleGate>
        </div>
      </div>

      {(isFlatError || isTreeError) && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 rounded-xl flex items-center justify-between">
          <span className="text-xs text-rose-700 dark:text-rose-400 font-medium">
            {(flatError as any)?.message || (treeError as any)?.message || 'Failed to load category taxonomy.'}
          </span>
          <button
            type="button"
            onClick={() => { refetchFlat(); refetchTree(); }}
            className="text-xs font-semibold text-rose-700 dark:text-rose-300 underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Content */}
      {isLoading ? (
        <LoadingSkeleton variant="card" count={3} />
      ) : flatCategories.length === 0 ? (
        <EmptyState
          title="No Categories"
          message="No classification categories have been created yet."
          action={{
            label: 'Create First Category',
            onClick: () => {
              setEditingCategory(null);
              setForm({ name: '', description: '', parentId: '' });
              setIsModalOpen(true);
            },
          }}
        />
      ) : viewMode === 'tree' ? (
        /* Hierarchical Tree View */
        <div className="space-y-2 p-4 rounded-xl bg-slate-50/50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800">
          {categoryTree.map((rootNode) => renderTreeNode(rootNode, 0))}
        </div>
      ) : (
        /* Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {flatCategories.map((c) => (
            <div
              key={c.id}
              className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-start justify-between">
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">{c.name}</h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {c._count?.assets ?? 0} assets
                  </span>
                </div>
                {c.parent && (
                  <p className="text-[11px] text-primary-600 dark:text-primary-400 mt-1">
                    ↳ Parent: {c.parent.name}
                  </p>
                )}
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-2">
                  {c.description || 'No description provided.'}
                </p>
              </div>

              <RoleGate roles={['TENANT_ADMIN', 'ASSET_MANAGER']}>
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-2">
                  <button
                    onClick={() => {
                      setEditingCategory(c);
                      setForm({
                        name: c.name,
                        description: c.description || '',
                        parentId: c.parentId || '',
                      });
                      setIsModalOpen(true);
                    }}
                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteCategory(c)}
                    className="p-1.5 text-slate-400 hover:text-rose-500 rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </RoleGate>
            </div>
          ))}
        </div>
      )}

      {/* CREATE / EDIT CATEGORY MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setCategoryErrors({}); }}
        title={editingCategory ? 'Edit Taxonomy Category' : 'Create Taxonomy Category'}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const errors: Record<string, string> = {};
            if (!form.name.trim() || form.name.trim().length < 2) {
              errors.name = 'Category name must be at least 2 characters.';
            }
            if (editingCategory && form.parentId === editingCategory.id) {
              errors.parentId = 'A category cannot be its own parent.';
            }

            if (Object.keys(errors).length > 0) {
              setCategoryErrors(errors);
              return;
            }
            setCategoryErrors({});
            saveMutation.mutate(form);
          }}
          className="space-y-4 text-xs"
        >
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Category Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Computer Vision Datasets"
              value={form.name}
              onChange={(e) => {
                setForm({ ...form, name: e.target.value });
                if (categoryErrors.name) setCategoryErrors((prev) => ({ ...prev, name: '' }));
              }}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            />
            {categoryErrors.name && (
              <p className="mt-1 text-[11px] text-rose-500 font-medium">{categoryErrors.name}</p>
            )}
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
              Parent Category (Hierarchy Root)
            </label>
            <select
              value={form.parentId}
              onChange={(e) => {
                setForm({ ...form, parentId: e.target.value });
                if (categoryErrors.parentId) setCategoryErrors((prev) => ({ ...prev, parentId: '' }));
              }}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            >
              <option value="">None (Top-Level Category)</option>
              {Array.isArray(flatCategories) && flatCategories
                .filter((c) => c.id !== editingCategory?.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
            {categoryErrors.parentId && (
              <p className="mt-1 text-[11px] text-rose-500 font-medium">{categoryErrors.parentId}</p>
            )}
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Description</label>
            <textarea
              rows={2}
              placeholder="Classification guidelines..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-3 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg shadow-sm"
            >
              {saveMutation.isPending ? 'Saving...' : 'Save Category'}
            </button>
          </div>
        </form>
      </Modal>

      {/* CONFIRM DELETE DIALOG */}
      <ConfirmDialog
        isOpen={!!deleteCategory}
        onClose={() => setDeleteCategory(null)}
        onConfirm={() => deleteMutation.mutate(deleteCategory!.id)}
        title="Delete Taxonomy Category"
        message={`Are you sure you want to delete category "${deleteCategory?.name}"? The system will block deletion if this category contains child sub-categories or digital assets.`}
        confirmText="Delete Category"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};
