// ==============================================================================
// AssetVault: Subscription Plans Governance (Super Admin)
// Course: BCSE307L Database Systems (Fall 2026-27)
// Subscription tier pricing, quotas (max users, max assets), and plan catalog
// ==============================================================================

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Plus, Edit2, Trash2, Users, FolderLock } from 'lucide-react';
import { api } from '../../services/api';
import { Plan } from '../../types';
import { useToast } from '../../context/ToastContext';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { EmptyState } from '../../components/common/EmptyState';

export const PlanListPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editPlan, setEditPlan] = useState<Plan | null>(null);
  const [deletePlan, setDeletePlan] = useState<Plan | null>(null);

  const [form, setForm] = useState({
    name: '',
    monthlyPrice: 0,
    maxUsers: 10,
    maxAssets: 100,
    isActive: true,
  });
  const [planErrors, setPlanErrors] = useState<Record<string, string>>({});

  // Fetch Plans
  const {
    data: plansData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<{ data: Plan[] }>({
    queryKey: ['plans-all'],
    queryFn: async () => {
      const res = await api.get<{ data: Plan[] }>('/plans');
      return res;
    },
  });

  // MUTATIONS
  // Create Plan
  const createMutation = useMutation({
    mutationFn: (data: typeof form) => api.post('/plans', data),
    onSuccess: () => {
      toast({ title: 'Plan Created', message: 'New subscription plan added', type: 'success' });
      setIsCreateOpen(false);
      setForm({ name: '', monthlyPrice: 0, maxUsers: 10, maxAssets: 100, isActive: true });
      queryClient.invalidateQueries({ queryKey: ['plans-all'] });
    },
    onError: (err: any) => {
      toast({ title: 'Error', message: err.message || 'Failed to create plan', type: 'error' });
    },
  });

  // Edit Plan
  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Plan> }) =>
      api.patch(`/plans/${id}`, data),
    onSuccess: () => {
      toast({ title: 'Plan Updated', message: 'Subscription tier modified', type: 'success' });
      setEditPlan(null);
      queryClient.invalidateQueries({ queryKey: ['plans-all'] });
    },
    onError: (err: any) => {
      toast({ title: 'Error', message: err.message || 'Failed to update plan', type: 'error' });
    },
  });

  // Delete Plan
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/plans/${id}`),
    onSuccess: () => {
      toast({ title: 'Plan Removed', message: 'Subscription plan deleted', type: 'info' });
      setDeletePlan(null);
      queryClient.invalidateQueries({ queryKey: ['plans-all'] });
    },
    onError: (err: any) => {
      toast({ title: 'Error', message: err.message || 'Cannot delete plan in active use', type: 'error' });
    },
  });

  const plans = plansData?.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400">
              <CreditCard className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Subscription Plan Tiers
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Define multi-tenant subscription tiers, quota boundaries, and monthly billing rates.
          </p>
        </div>

        <button
          onClick={() => {
            setForm({ name: '', monthlyPrice: 0, maxUsers: 10, maxAssets: 100, isActive: true });
            setPlanErrors({});
            setIsCreateOpen(true);
          }}
          className="inline-flex items-center px-3.5 py-2 text-xs font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 shadow-sm transition-colors"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Add Plan Tier
        </button>
      </div>

      {isError && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 rounded-xl flex items-center justify-between">
          <span className="text-xs text-rose-700 dark:text-rose-400 font-medium">
            {(error as any)?.message || 'Failed to load subscription plan tiers.'}
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

      {/* Plans Grid */}
      {isLoading ? (
        <LoadingSkeleton variant="card" count={3} />
      ) : plans.length === 0 ? (
        <EmptyState title="No Plans Found" message="No subscription tiers have been created yet." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((p) => (
            <div
              key={p.id}
              className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-6 relative overflow-hidden"
            >
              <div>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">{p.name}</h3>
                    <p className="text-2xl font-black text-primary-600 dark:text-primary-400 mt-2 font-mono">
                      ${Number(p.monthlyPrice).toLocaleString()}
                      <span className="text-xs font-normal text-slate-400">/mo</span>
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      p.isActive
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {p.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {/* Quota Highlights */}
                <div className="mt-6 space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex items-center space-x-2.5">
                    <Users className="w-4 h-4 text-primary-500" />
                    <span>
                      Max Users: <strong className="text-slate-900 dark:text-white">{p.maxUsers}</strong> seats
                    </span>
                  </div>
                  <div className="flex items-center space-x-2.5">
                    <FolderLock className="w-4 h-4 text-indigo-500" />
                    <span>
                      Max Assets: <strong className="text-slate-900 dark:text-white">{p.maxAssets}</strong> files
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-2">
                <button
                  onClick={() => {
                    setEditPlan(p);
                    setForm({
                      name: p.name,
                      monthlyPrice: Number(p.monthlyPrice),
                      maxUsers: p.maxUsers,
                      maxAssets: p.maxAssets,
                      isActive: p.isActive,
                    });
                  }}
                  className="p-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                  title="Edit Plan"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDeletePlan(p)}
                  className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors"
                  title="Delete Plan"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      <Modal
        isOpen={isCreateOpen || !!editPlan}
        onClose={() => {
          setIsCreateOpen(false);
          setEditPlan(null);
          setPlanErrors({});
        }}
        title={editPlan ? `Edit Plan Tier: ${editPlan.name}` : 'Create Subscription Plan Tier'}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const errors: Record<string, string> = {};
            if (!form.name.trim() || form.name.trim().length < 2) {
              errors.name = 'Plan name must be at least 2 characters.';
            }
            if (!form.maxUsers || form.maxUsers < 1) {
              errors.maxUsers = 'Max users must be greater than 0.';
            }
            if (!form.maxAssets || form.maxAssets < 1) {
              errors.maxAssets = 'Max assets must be greater than 0.';
            }
            if (form.monthlyPrice < 0 || isNaN(form.monthlyPrice)) {
              errors.monthlyPrice = 'Monthly price cannot be negative.';
            }

            if (Object.keys(errors).length > 0) {
              setPlanErrors(errors);
              return;
            }
            setPlanErrors({});

            if (editPlan) {
              editMutation.mutate({ id: editPlan.id, data: form });
            } else {
              createMutation.mutate(form);
            }
          }}
          className="space-y-4 text-xs"
        >
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Plan Name</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => {
                setForm({ ...form, name: e.target.value });
                if (planErrors.name) setPlanErrors((prev) => ({ ...prev, name: '' }));
              }}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            />
            {planErrors.name && (
              <p className="mt-1 text-[11px] text-rose-500 font-medium">{planErrors.name}</p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Monthly Price ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={form.monthlyPrice}
                onChange={(e) => {
                  setForm({ ...form, monthlyPrice: parseFloat(e.target.value) || 0 });
                  if (planErrors.monthlyPrice) setPlanErrors((prev) => ({ ...prev, monthlyPrice: '' }));
                }}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
              {planErrors.monthlyPrice && (
                <p className="mt-1 text-[11px] text-rose-500 font-medium">{planErrors.monthlyPrice}</p>
              )}
            </div>
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Max Users</label>
              <input
                type="number"
                min="1"
                required
                value={form.maxUsers}
                onChange={(e) => {
                  setForm({ ...form, maxUsers: parseInt(e.target.value) || 1 });
                  if (planErrors.maxUsers) setPlanErrors((prev) => ({ ...prev, maxUsers: '' }));
                }}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
              {planErrors.maxUsers && (
                <p className="mt-1 text-[11px] text-rose-500 font-medium">{planErrors.maxUsers}</p>
              )}
            </div>
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Max Assets</label>
              <input
                type="number"
                min="1"
                required
                value={form.maxAssets}
                onChange={(e) => {
                  setForm({ ...form, maxAssets: parseInt(e.target.value) || 1 });
                  if (planErrors.maxAssets) setPlanErrors((prev) => ({ ...prev, maxAssets: '' }));
                }}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
              {planErrors.maxAssets && (
                <p className="mt-1 text-[11px] text-rose-500 font-medium">{planErrors.maxAssets}</p>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <input
              type="checkbox"
              id="isActivePlan"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="rounded text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="isActivePlan" className="text-slate-700 dark:text-slate-300 font-medium">
              Plan is Active and available for subscription
            </label>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setIsCreateOpen(false);
                setEditPlan(null);
              }}
              className="px-3 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || editMutation.isPending}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg shadow-sm"
            >
              {createMutation.isPending || editMutation.isPending ? 'Saving...' : 'Save Plan'}
            </button>
          </div>
        </form>
      </Modal>

      {/* CONFIRM DELETE DIALOG */}
      <ConfirmDialog
        isOpen={!!deletePlan}
        onClose={() => setDeletePlan(null)}
        onConfirm={() => deleteMutation.mutate(deletePlan!.id)}
        title="Delete Plan Tier"
        message={`Are you sure you want to delete plan "${deletePlan?.name}"? Deletion will be rejected if existing tenants subscribe to this tier.`}
        confirmText="Delete Plan"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};
