// ==============================================================================
// AssetVault: License Allocation Matrix
// Course: BCSE307L Database Systems (Fall 2026-27)
// Provisioned user software seats, release controls, and compliance status
// ==============================================================================

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Layers,
  ExternalLink,
  LogOut,
} from 'lucide-react';
import { api } from '../../services/api';
import { LicenseAllocation } from '../../types';
import { useToast } from '../../context/ToastContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { SearchInput } from '../../components/common/SearchInput';
import { Pagination } from '../../components/common/Pagination';
import { RoleGate } from '../../components/auth/RoleGate';

export const AllocationListPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();


  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [releaseAllocationId, setReleaseAllocationId] = useState<string | null>(null);
  const [releaseReason, setReleaseReason] = useState('Administrative seat release');

  // Fetch Allocations
  const {
    data: allocationsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<{
    data: LicenseAllocation[];
    meta: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }>({
    queryKey: ['allocations', page, limit, statusFilter],
    queryFn: async () => {
      const res = await api.get<{ data: LicenseAllocation[]; meta: any }>('/allocations', {
        params: {
          page,
          limit,
          status: statusFilter || undefined,
        },
      });
      return res;
    },
  });

  // Release Seat Mutation (sp_release_license_seat)
  const releaseMutation = useMutation({
    mutationFn: ({ allocationId, reason }: { allocationId: string; reason: string }) =>
      api.post(`/allocations/${allocationId}/release`, { reason }),
    onSuccess: () => {
      toast({
        title: 'Seat Released',
        message: 'License seat returned to tenant pool via sp_release_license_seat',
        type: 'info',
      });
      setReleaseAllocationId(null);
      queryClient.invalidateQueries({ queryKey: ['allocations'] });
      queryClient.invalidateQueries({ queryKey: ['licenses'] });
    },
    onError: (err: any) => {
      toast({
        title: 'Release Failed',
        message: err.message || 'Could not release license seat.',
        type: 'error',
      });
    },
  });

  const allocations = allocationsData?.data || [];
  const meta = allocationsData?.meta || { page: 1, limit: 15, total: 0, totalPages: 1 };

  // Filter client-side by search query if needed
  const filtered = allocations.filter((a) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const userName = a.user?.fullName?.toLowerCase() || '';
    const userEmail = a.user?.email?.toLowerCase() || '';
    const licName = a.license?.name?.toLowerCase() || '';
    return userName.includes(q) || userEmail.includes(q) || licName.includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400">
              <Layers className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              License Seat Allocations
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Enterprise software seat distribution matrix tracking user software provisioning and compliance.
          </p>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="w-full sm:w-72">
          <SearchInput
            value={search}
            onChange={(val) => {
              setSearch(val);
              setPage(1);
            }}
            placeholder="Search by user or license..."
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
          <option value="ACTIVE">Active Allocations</option>
          <option value="REVOKED">Released / Revoked Seats</option>
        </select>
      </div>

      {isError && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 rounded-xl flex items-center justify-between">
          <span className="text-xs text-rose-700 dark:text-rose-400 font-medium">
            {(error as any)?.message || 'Failed to load license allocations.'}
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

      {/* Table / Content */}
      {isLoading ? (
        <LoadingSkeleton variant="table" />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No Allocations Found"
          message="No user seat allocations recorded under the specified criteria."
        />
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-850 text-slate-500 uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">License</th>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Allocated Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filtered.map((alloc) => (
                  <tr key={alloc.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <div>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {alloc.user?.fullName || 'User'}
                        </span>
                        <span className="block text-[11px] text-slate-400 font-mono">
                          {alloc.user?.email || 'N/A'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {alloc.license ? (
                        <Link
                          to={`/licenses/${alloc.license.id}`}
                          className="font-medium text-primary-600 dark:text-primary-400 hover:underline flex items-center"
                        >
                          {alloc.license.name}
                          <ExternalLink className="w-3 h-3 ml-1 text-slate-400" />
                        </Link>
                      ) : (
                        'License'
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {alloc.license?.vendor?.name || 'Independent'}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(alloc.allocatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={alloc.status} size="sm" />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {alloc.status === 'ACTIVE' && (
                        <RoleGate roles={['TENANT_ADMIN', 'ASSET_MANAGER']}>
                          <button
                            onClick={() => setReleaseAllocationId(alloc.id)}
                            className="text-rose-600 dark:text-rose-400 font-medium hover:underline inline-flex items-center text-xs"
                          >
                            <LogOut className="w-3.5 h-3.5 mr-1" />
                            Release Seat
                          </button>
                        </RoleGate>
                      )}
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

      {/* RELEASE SEAT MODAL */}
      <Modal
        isOpen={!!releaseAllocationId}
        onClose={() => setReleaseAllocationId(null)}
        title="Release License Seat"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600 dark:text-slate-300">
            Releasing this seat invokes stored procedure{' '}
            <code className="font-mono text-primary-500">sp_release_license_seat</code> and restores available seat
            capacity for the license.
          </p>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Reason for Release</label>
            <input
              type="text"
              value={releaseReason}
              onChange={(e) => setReleaseReason(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setReleaseAllocationId(null)}
              className="px-3 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={releaseMutation.isPending}
              onClick={() =>
                releaseMutation.mutate({
                  allocationId: releaseAllocationId!,
                  reason: releaseReason,
                })
              }
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-lg shadow-sm"
            >
              {releaseMutation.isPending ? 'Releasing...' : 'Release Seat'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
