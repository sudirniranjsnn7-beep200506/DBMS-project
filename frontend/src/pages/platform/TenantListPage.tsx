// ==============================================================================
// AssetVault: Multi-Tenant Governance (Super Admin)
// Course: BCSE307L Database Systems (Fall 2026-27)
// Cross-tenant registry, plan changes, and status management
// ==============================================================================

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building,
  Plus,
  CreditCard,
  CheckCircle,
  XCircle,
  Trash2,
} from 'lucide-react';
import { api } from '../../services/api';
import { Tenant, Plan, TenantStatus } from '../../types';
import { useToast } from '../../context/ToastContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { SearchInput } from '../../components/common/SearchInput';
import { Pagination } from '../../components/common/Pagination';

export const TenantListPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [changePlanTenant, setChangePlanTenant] = useState<Tenant | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<number>(1);
  const [deleteTenant, setDeleteTenant] = useState<Tenant | null>(null);

  // Create form state
  const [createForm, setCreateForm] = useState({
    name: '',
    slug: '',
    contactEmail: '',
    planId: 1,
  });
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});

  // Fetch Tenants
  const {
    data: tenantsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<{
    data: Tenant[];
    meta: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }>({
    queryKey: ['platform-tenants', page, limit, search, statusFilter],
    queryFn: async () => {
      const res = await api.get<{ data: Tenant[]; meta: any }>('/tenants', {
        params: {
          page,
          limit,
          q: search || undefined,
          status: statusFilter || undefined,
        },
      });
      return res;
    },
  });

  // Fetch Subscription Plans
  const { data: plansData } = useQuery<{ data: Plan[] }>({
    queryKey: ['plans-list'],
    queryFn: async () => {
      const res = await api.get<{ data: Plan[] }>('/plans');
      return res;
    },
  });

  const plans = plansData?.data || [];

  // MUTATIONS
  // Create Tenant
  const createMutation = useMutation({
    mutationFn: (data: typeof createForm) => api.post('/tenants', data),
    onSuccess: () => {
      toast({ title: 'Tenant Created', message: 'New organization provisioned successfully', type: 'success' });
      setIsCreateOpen(false);
      setCreateForm({ name: '', slug: '', contactEmail: '', planId: 1 });
      queryClient.invalidateQueries({ queryKey: ['platform-tenants'] });
    },
    onError: (err: any) => {
      toast({ title: 'Error', message: err.message || 'Failed to create tenant', type: 'error' });
    },
  });

  // Change Plan
  const changePlanMutation = useMutation({
    mutationFn: ({ tenantId, planId }: { tenantId: string; planId: number }) =>
      api.patch(`/tenants/${tenantId}/plan`, { planId }),
    onSuccess: () => {
      toast({ title: 'Plan Updated', message: 'Tenant subscription plan changed', type: 'success' });
      setChangePlanTenant(null);
      queryClient.invalidateQueries({ queryKey: ['platform-tenants'] });
    },
    onError: (err: any) => {
      toast({ title: 'Error', message: err.message || 'Failed to update plan', type: 'error' });
    },
  });

  // Toggle Status (ACTIVE / SUSPENDED)
  const toggleStatusMutation = useMutation({
    mutationFn: ({ tenantId, status }: { tenantId: string; status: TenantStatus }) =>
      api.patch(`/tenants/${tenantId}/status`, { status }),
    onSuccess: (_, vars) => {
      toast({
        title: 'Status Updated',
        message: `Tenant status set to ${vars.status}`,
        type: 'info',
      });
      queryClient.invalidateQueries({ queryKey: ['platform-tenants'] });
    },
    onError: (err: any) => {
      toast({ title: 'Error', message: err.message || 'Failed to change status', type: 'error' });
    },
  });

  // Delete Tenant
  const deleteMutation = useMutation({
    mutationFn: (tenantId: string) => api.delete(`/tenants/${tenantId}`),
    onSuccess: () => {
      toast({ title: 'Tenant Deleted', message: 'Tenant soft-deleted from platform', type: 'info' });
      setDeleteTenant(null);
      queryClient.invalidateQueries({ queryKey: ['platform-tenants'] });
    },
    onError: (err: any) => {
      toast({ title: 'Error', message: err.message || 'Failed to delete tenant', type: 'error' });
    },
  });

  const tenants = tenantsData?.data || [];
  const meta = tenantsData?.meta || { page: 1, limit: 10, total: 0, totalPages: 1 };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400">
              <Building className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Platform Tenants Governance
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Global administrative control: inspect, provision, suspend, and configure organization tenants.
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center px-3.5 py-2 text-xs font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 shadow-sm transition-colors"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Provision Tenant
        </button>
      </div>

      {/* Filter / Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="w-full sm:w-72">
          <SearchInput
            value={search}
            onChange={(val) => {
              setSearch(val);
              setPage(1);
            }}
            placeholder="Search by name or slug..."
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 w-full sm:w-auto"
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="TRIAL">Trial</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
      </div>

      {isError && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 rounded-xl flex items-center justify-between">
          <span className="text-xs text-rose-700 dark:text-rose-400 font-medium">
            {(error as any)?.message || 'Failed to load organization tenants.'}
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

      {/* Tenants Table */}
      {isLoading ? (
        <LoadingSkeleton variant="table" />
      ) : tenants.length === 0 ? (
        <EmptyState
          title="No Tenants Found"
          message="No organization tenants match the query criteria."
        />
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-850 text-slate-500 uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3">Tenant</th>
                  <th className="px-4 py-3">Slug</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Contact Email</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {tenants.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                      {t.name}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500">{t.slug}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded font-semibold text-[11px] bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                        {t.plan?.name || `Plan #${t.planId}`}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={t.status} size="sm" />
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono">
                      {t.contactEmail || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        {/* Change Plan Button */}
                        <button
                          onClick={() => {
                            setChangePlanTenant(t);
                            setSelectedPlanId(t.planId);
                          }}
                          className="p-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                          title="Change Plan"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                        </button>

                        {/* Status Toggle (Suspend / Activate) */}
                        <button
                          onClick={() =>
                            toggleStatusMutation.mutate({
                              tenantId: t.id,
                              status: t.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED',
                            })
                          }
                          className={`p-1.5 rounded transition-colors ${
                            t.status === 'SUSPENDED'
                              ? 'text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                              : 'text-amber-500 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                          }`}
                          title={t.status === 'SUSPENDED' ? 'Activate Tenant' : 'Suspend Tenant'}
                        >
                          {t.status === 'SUSPENDED' ? (
                            <CheckCircle className="w-3.5 h-3.5" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => setDeleteTenant(t)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded"
                          title="Delete Tenant"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-3 border-t border-slate-200 dark:border-slate-800">
            <Pagination
              currentPage={meta.page}
              totalPages={meta.totalPages}
              totalItems={meta.total}
              pageSize={limit}
              onPageChange={setPage}
              onPageSizeChange={setLimit}
            />
          </div>
        </div>
      )}

      {/* CREATE TENANT MODAL */}
      <Modal isOpen={isCreateOpen} onClose={() => { setIsCreateOpen(false); setCreateErrors({}); }} title="Provision Organization Tenant">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const errors: Record<string, string> = {};
            if (!createForm.name.trim() || createForm.name.trim().length < 2) {
              errors.name = 'Tenant name must be at least 2 characters.';
            }
            if (!createForm.slug.trim() || createForm.slug.trim().length < 2) {
              errors.slug = 'Tenant slug must be at least 2 characters.';
            }
            if (!createForm.contactEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(createForm.contactEmail.trim())) {
              errors.contactEmail = 'Please provide a valid administrative contact email.';
            }

            if (Object.keys(errors).length > 0) {
              setCreateErrors(errors);
              return;
            }
            setCreateErrors({});
            createMutation.mutate(createForm);
          }}
          className="space-y-4 text-xs"
        >
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Tenant Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Acme Corporation"
              value={createForm.name}
              onChange={(e) => {
                setCreateForm({
                  ...createForm,
                  name: e.target.value,
                  slug: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-'),
                });
                if (createErrors.name) setCreateErrors((prev) => ({ ...prev, name: '' }));
              }}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            />
            {createErrors.name && (
              <p className="mt-1 text-[11px] text-rose-500 font-medium">{createErrors.name}</p>
            )}
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Slug (Identifier)</label>
            <input
              type="text"
              required
              placeholder="acme-corp"
              value={createForm.slug}
              onChange={(e) => {
                setCreateForm({ ...createForm, slug: e.target.value });
                if (createErrors.slug) setCreateErrors((prev) => ({ ...prev, slug: '' }));
              }}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono"
            />
            {createErrors.slug && (
              <p className="mt-1 text-[11px] text-rose-500 font-medium">{createErrors.slug}</p>
            )}
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Contact Email</label>
            <input
              type="email"
              required
              placeholder="admin@acme.com"
              value={createForm.contactEmail}
              onChange={(e) => {
                setCreateForm({ ...createForm, contactEmail: e.target.value });
                if (createErrors.contactEmail) setCreateErrors((prev) => ({ ...prev, contactEmail: '' }));
              }}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            />
            {createErrors.contactEmail && (
              <p className="mt-1 text-[11px] text-rose-500 font-medium">{createErrors.contactEmail}</p>
            )}
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Subscription Plan</label>
            <select
              value={createForm.planId}
              onChange={(e) => setCreateForm({ ...createForm, planId: parseInt(e.target.value) || 1 })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            >
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (${Number(p.monthlyPrice)}/mo, max {p.maxUsers} users, {p.maxAssets} assets)
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => { setIsCreateOpen(false); setCreateErrors({}); }}
              className="px-3 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg shadow-sm"
            >
              {createMutation.isPending ? 'Provisioning...' : 'Provision Tenant'}
            </button>
          </div>
        </form>
      </Modal>

      {/* CHANGE PLAN MODAL */}
      <Modal isOpen={!!changePlanTenant} onClose={() => setChangePlanTenant(null)} title="Update Subscription Plan">
        <div className="space-y-4 text-xs">
          <p className="text-slate-600 dark:text-slate-300">
            Assign subscription plan tier to <span className="font-bold">{changePlanTenant?.name}</span>.
          </p>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Target Plan</label>
            <select
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            >
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (${Number(p.monthlyPrice)}/mo)
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setChangePlanTenant(null)}
              className="px-3 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={changePlanMutation.isPending}
              onClick={() =>
                changePlanMutation.mutate({
                  tenantId: changePlanTenant!.id,
                  planId: selectedPlanId,
                })
              }
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg shadow-sm"
            >
              {changePlanMutation.isPending ? 'Saving...' : 'Apply Plan'}
            </button>
          </div>
        </div>
      </Modal>

      {/* DELETE CONFIRMATION */}
      <ConfirmDialog
        isOpen={!!deleteTenant}
        onClose={() => setDeleteTenant(null)}
        onConfirm={() => deleteMutation.mutate(deleteTenant!.id)}
        title="Delete Tenant"
        message={`Are you sure you want to soft-delete tenant "${deleteTenant?.name}"? All tenant users and access tokens will be invalidated.`}
        confirmText="Delete Tenant"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};
