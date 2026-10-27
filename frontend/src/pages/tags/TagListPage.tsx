// ==============================================================================
// AssetVault: Metadata Tags Management
// Course: BCSE307L Database Systems (Fall 2026-27)
// Taxonomic metadata vocabulary, color badges, and asset usage statistics
// ==============================================================================

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Tag as TagIcon,
  Plus,
  Trash2,
  Edit2,
} from 'lucide-react';
import { api } from '../../services/api';
import { Tag } from '../../types';
import { useToast } from '../../context/ToastContext';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { SearchInput } from '../../components/common/SearchInput';
import { RoleGate } from '../../components/auth/RoleGate';

const PRESET_COLORS = [
  '#6366f1', // Indigo
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#ec4899', // Pink
  '#8b5cf6', // Purple
  '#64748b', // Slate
];

export const TagListPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();


  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [deleteTag, setDeleteTag] = useState<Tag | null>(null);

  const [form, setForm] = useState({
    name: '',
    color: '#6366f1',
  });
  const [tagErrors, setTagErrors] = useState<Record<string, string>>({});

  // Fetch Tags
  const {
    data: tagsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<{ data: Tag[]; meta?: any }>({
    queryKey: ['tags', search],
    queryFn: async () => {
      const res = await api.get<{ data: Tag[]; meta: any }>('/tags', {
        params: { q: search || undefined, limit: 100 },
      });
      return res;
    },
  });

  // MUTATIONS
  const saveMutation = useMutation({
    mutationFn: (data: typeof form) => {
      if (editingTag) {
        return api.patch(`/tags/${editingTag.id}`, data);
      }
      return api.post('/tags', data);
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        message: editingTag ? 'Tag updated' : 'Tag created successfully',
        type: 'success',
      });
      setIsModalOpen(false);
      setEditingTag(null);
      setForm({ name: '', color: '#6366f1' });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
    onError: (err: any) => {
      toast({
        title: 'Tag Error',
        message: err.message || 'Operation failed. Tag name must be unique within tenant.',
        type: 'error',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/tags/${id}`),
    onSuccess: () => {
      toast({ title: 'Tag Removed', message: 'Tag unlinked from all assets and deleted', type: 'info' });
      setDeleteTag(null);
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
    onError: (err: any) => {
      toast({ title: 'Error', message: err.message || 'Failed to delete tag', type: 'error' });
    },
  });

  const tags = tagsData?.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400">
              <TagIcon className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Metadata Vocabulary Tags
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Categorization labels, custom color palettes, and asset tagging matrix.
          </p>
        </div>

        <RoleGate roles={['TENANT_ADMIN', 'ASSET_MANAGER']}>
          <button
            onClick={() => {
              setEditingTag(null);
              setForm({ name: '', color: '#6366f1' });
              setIsModalOpen(true);
            }}
            className="inline-flex items-center px-3.5 py-2 text-xs font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 shadow-sm transition-colors"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Create Tag
          </button>
        </RoleGate>
      </div>

      {/* Search Input */}
      <div className="w-full sm:w-72">
        <SearchInput value={search} onChange={setSearch} placeholder="Search tags..." />
      </div>

      {isError && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 rounded-xl flex items-center justify-between">
          <span className="text-xs text-rose-700 dark:text-rose-400 font-medium">
            {(error as any)?.message || 'Failed to load metadata tags.'}
          </span>
          <button
            type="button"
            onClick={() => refetch()}
            className="text-xs font-semibold text-rose-700 dark:text-rose-300 underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Tags Grid */}
      {isLoading ? (
        <LoadingSkeleton variant="card" count={3} />
      ) : tags.length === 0 ? (
        <EmptyState
          title="No Tags Defined"
          message="No metadata tags found. Create tags to label and categorize digital assets."
          action={{
            label: 'Create First Tag',
            onClick: () => {
              setEditingTag(null);
              setForm({ name: '', color: '#6366f1' });
              setIsModalOpen(true);
            },
          }}
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {tags.map((tag) => (
            <div
              key={tag.id}
              className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between"
            >
              <div className="flex items-center space-x-2.5 truncate mr-2">
                <span
                  style={{ backgroundColor: tag.color }}
                  className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                />
                <div className="truncate">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    #{tag.name}
                  </p>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {tag._count?.assetTags ?? 0} uses
                  </span>
                </div>
              </div>

              <RoleGate roles={['TENANT_ADMIN', 'ASSET_MANAGER']}>
                <div className="flex items-center space-x-1 shrink-0">
                  <button
                    onClick={() => {
                      setEditingTag(tag);
                      setForm({ name: tag.name, color: tag.color });
                      setIsModalOpen(true);
                    }}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
                    title="Edit Tag"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => setDeleteTag(tag)}
                    className="p-1 text-slate-400 hover:text-rose-500 rounded"
                    title="Delete Tag"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </RoleGate>
            </div>
          ))}
        </div>
      )}

      {/* CREATE / EDIT TAG MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setTagErrors({}); }}
        title={editingTag ? 'Edit Metadata Tag' : 'Create Metadata Tag'}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const errors: Record<string, string> = {};
            if (!form.name.trim()) {
              errors.name = 'Tag name is required.';
            }

            if (Object.keys(errors).length > 0) {
              setTagErrors(errors);
              return;
            }
            setTagErrors({});
            saveMutation.mutate(form);
          }}
          className="space-y-4 text-xs"
        >
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Tag Name</label>
            <input
              type="text"
              required
              placeholder="e.g. production, 3d-model, licensed"
              value={form.name}
              onChange={(e) => {
                setForm({ ...form, name: e.target.value });
                if (tagErrors.name) setTagErrors((prev) => ({ ...prev, name: '' }));
              }}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            />
            {tagErrors.name && (
              <p className="mt-1 text-[11px] text-rose-500 font-medium">{tagErrors.name}</p>
            )}
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Color Palette</label>
            <div className="flex items-center space-x-2 mb-2">
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="w-8 h-8 rounded border border-slate-300 dark:border-slate-700 cursor-pointer"
              />
              <span className="font-mono text-xs text-slate-600 dark:text-slate-400">{form.color}</span>
            </div>

            <div className="flex items-center space-x-2">
              {PRESET_COLORS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setForm({ ...form, color: preset })}
                  style={{ backgroundColor: preset }}
                  className={`w-6 h-6 rounded-full transition-transform ${
                    form.color.toLowerCase() === preset.toLowerCase()
                      ? 'scale-125 ring-2 ring-primary-500 ring-offset-2'
                      : 'hover:scale-110'
                  }`}
                />
              ))}
            </div>
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
              {saveMutation.isPending ? 'Saving...' : 'Save Tag'}
            </button>
          </div>
        </form>
      </Modal>

      {/* CONFIRM DELETE DIALOG */}
      <ConfirmDialog
        isOpen={!!deleteTag}
        onClose={() => setDeleteTag(null)}
        onConfirm={() => deleteMutation.mutate(deleteTag!.id)}
        title="Delete Metadata Tag"
        message={`Are you sure you want to delete tag "#${deleteTag?.name}"? It will be automatically unlinked from all tagged digital assets.`}
        confirmText="Delete Tag"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};
