// ==============================================================================
// AssetVault: My Licenses Page (Member Self-Service Portal)
// Course: BCSE307L Database Systems (Fall 2026-27)
// View personal software allocations, checkout covered assets, and self-release seats
// ==============================================================================

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  Compass,
  ExternalLink,
  LogOut,
} from 'lucide-react';
import { api } from '../../services/api';
import { LicenseAllocation } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { Modal } from '../../components/common/Modal';

export const MyLicensesPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [releaseAllocationId, setReleaseAllocationId] = useState<string | null>(null);
  const [releaseReason, setReleaseReason] = useState('Project completed / seat self-release');

  // Fetch current user's allocations
  const { data: allocationsData, isLoading } = useQuery<{
    data: LicenseAllocation[];
    meta: any;
  }>({
    queryKey: ['my-allocations', user?.id],
    queryFn: async () => {
      if (!user?.id) return { data: [], meta: {} };
      const res = await api.get<{ data: LicenseAllocation[]; meta: any }>(`/users/${user.id}/allocations`);
      return res;
    },
    enabled: !!user?.id,
  });

  // Self-release seat mutation
  const releaseMutation = useMutation({
    mutationFn: ({ allocationId, reason }: { allocationId: string; reason: string }) =>
      api.post(`/allocations/${allocationId}/release`, { reason }),
    onSuccess: () => {
      toast({
        title: 'Seat Released',
        message: 'Your license seat was successfully released and returned to tenant pool.',
        type: 'info',
      });
      setReleaseAllocationId(null);
      queryClient.invalidateQueries({ queryKey: ['my-allocations'] });
    },
    onError: (err: any) => {
      toast({
        title: 'Release Failed',
        message: err.message || 'Unable to release license seat.',
        type: 'error',
      });
    },
  });

  const allocations = allocationsData?.data || [];
  const activeAllocations = allocations.filter((a) => a.status === 'ACTIVE');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400">
              <Compass className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              My Software Allocations
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Personal software seat provisioning portal with direct access to covered assets.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            Active Seats: {activeAllocations.length}
          </span>
        </div>
      </div>

      {/* Main Content */}
      {isLoading ? (
        <LoadingSkeleton variant="card" count={3} />
      ) : activeAllocations.length === 0 ? (
        <EmptyState
          title="No Active License Allocations"
          message="You currently do not hold any assigned software license seats. Request access from your Tenant Administrator or Asset Manager."
          action={{
            label: 'Browse Digital Assets',
            onClick: () => navigate('/assets'),
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeAllocations.map((alloc) => {
            const license = alloc.license;
            return (
              <div
                key={alloc.id}
                className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col justify-between"
              >
                <div className="p-5 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        {license?.vendor?.name || 'Enterprise Software'}
                      </span>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                        {license?.name || 'Software License'}
                      </h3>
                    </div>
                    <StatusBadge status={alloc.status} size="sm" />
                  </div>

                  {/* Provisioning Meta */}
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-500">
                      <span>Allocated Date:</span>
                      <span className="text-slate-700 dark:text-slate-300 font-medium">
                        {new Date(alloc.allocatedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Expires:</span>
                      <span className="text-slate-700 dark:text-slate-300 font-medium">
                        {license?.endDate ? new Date(license.endDate).toLocaleDateString() : 'Perpetual'}
                      </span>
                    </div>
                  </div>

                  {/* License Key Display */}
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-semibold text-slate-400">Software Key</span>
                    <div className="p-2 rounded bg-slate-100 dark:bg-slate-800 text-xs font-mono text-slate-700 dark:text-slate-300 truncate">
                      {license?.licenseKey || '••••-••••-••••-••••'}
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 bg-slate-50/50 dark:bg-slate-850/50 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
                  <Link
                    to={`/licenses/${license?.id}`}
                    className="text-primary-600 dark:text-primary-400 font-semibold hover:underline inline-flex items-center"
                  >
                    View Details
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </Link>

                  <button
                    onClick={() => setReleaseAllocationId(alloc.id)}
                    className="text-rose-600 dark:text-rose-400 font-medium hover:underline inline-flex items-center"
                  >
                    <LogOut className="w-3.5 h-3.5 mr-1" />
                    Release Seat
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* RELEASE SEAT MODAL */}
      <Modal
        isOpen={!!releaseAllocationId}
        onClose={() => setReleaseAllocationId(null)}
        title="Self-Release License Seat"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600 dark:text-slate-300">
            Releasing this license seat will restore capacity to your organization and end your software entitlement.
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
              {releaseMutation.isPending ? 'Releasing...' : 'Confirm Release'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
