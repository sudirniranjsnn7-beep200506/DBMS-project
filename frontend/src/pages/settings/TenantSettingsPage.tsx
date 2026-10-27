// ==============================================================================
// AssetVault: Organization & User Account Settings
// Course: BCSE307L Database Systems (Fall 2026-27)
// Profile settings, tenant workspace info, and session security
// ==============================================================================

import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Settings,
  Building,
  User as UserIcon,
  Shield,
  LogOut,
  Download,
  Database,
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';

export const TenantSettingsPage: React.FC = () => {
  const { user, tenant, logout, hasPermission } = useAuth();
  const canExportTenant = hasPermission('tenants:update_own');
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'profile' | 'organization' | 'security'>('profile');
  const [isLogoutAllOpen, setIsLogoutAllOpen] = useState(false);
  const [isExportingTenant, setIsExportingTenant] = useState(false);

  const handleExportTenantData = async () => {
    setIsExportingTenant(true);
    try {
      const response = await api.get('/tenant/export');
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(response, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute(
        'download',
        `tenant-archive-${tenant?.slug || 'export'}-${new Date().toISOString().slice(0, 10)}.json`
      );
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast({
        title: 'Tenant Archive Exported',
        message: 'Full GDPR & compliance JSON archive generated successfully.',
        type: 'success',
      });
    } catch (err: any) {
      toast({
        title: 'Export Failed',
        message: err.message || 'Failed to generate tenant export archive.',
        type: 'error',
      });
    } finally {
      setIsExportingTenant(false);
    }
  };

  // Logout All Devices Mutation (POST /api/auth/logout-all)
  const logoutAllMutation = useMutation({
    mutationFn: () => api.post('/auth/logout-all', {}),
    onSuccess: async () => {
      toast({
        title: 'Sessions Revoked',
        message: 'All active refresh tokens revoked. Please log in again.',
        type: 'info',
      });
      await logout();
    },
    onError: (err: any) => {
      toast({
        title: 'Error',
        message: err.message || 'Failed to revoke active sessions.',
        type: 'error',
      });
    },
  });

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center space-x-2">
          <div className="p-2 rounded-lg bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400">
            <Settings className="w-5 h-5" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Account & Workspace Settings
          </h1>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Manage your personal profile, tenant organization configuration, and session security.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav className="flex space-x-6" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('profile')}
            className={`py-3 px-1 border-b-2 text-xs font-medium transition-colors flex items-center ${
              activeTab === 'profile'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <UserIcon className="w-3.5 h-3.5 mr-1.5" />
            User Profile
          </button>

          {!user?.isSuperAdmin && (
            <button
              onClick={() => setActiveTab('organization')}
              className={`py-3 px-1 border-b-2 text-xs font-medium transition-colors flex items-center ${
                activeTab === 'organization'
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
              }`}
            >
              <Building className="w-3.5 h-3.5 mr-1.5" />
              Organization Workspace
            </button>
          )}

          <button
            onClick={() => setActiveTab('security')}
            className={`py-3 px-1 border-b-2 text-xs font-medium transition-colors flex items-center ${
              activeTab === 'security'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <Shield className="w-3.5 h-3.5 mr-1.5" />
            Session Security
          </button>
        </nav>
      </div>

      {/* TAB 1: USER PROFILE */}
      {activeTab === 'profile' && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 rounded-full bg-primary-100 dark:bg-primary-950/80 text-primary-700 dark:text-primary-300 flex items-center justify-center font-bold text-lg uppercase shadow-sm">
              {user?.fullName?.slice(0, 2) || 'AV'}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">{user?.fullName}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">{user?.email}</p>
              <div className="mt-1.5">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-primary-50 text-primary-700 dark:bg-primary-950/60 dark:text-primary-300 border border-primary-200 dark:border-primary-800">
                  <Shield className="w-3 h-3 mr-1" />
                  {typeof user?.role === 'object' && user?.role !== null ? (user.role as any).name : user?.role}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
            <div>
              <span className="text-slate-500 block mb-0.5">Account User ID</span>
              <span className="font-mono text-slate-800 dark:text-slate-200">{user?.id}</span>
            </div>
            <div>
              <span className="text-slate-500 block mb-0.5">Assigned Tenant ID</span>
              <span className="font-mono text-slate-800 dark:text-slate-200">{user?.tenantId || 'Platform-Level'}</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ORGANIZATION WORKSPACE */}
      {activeTab === 'organization' && !user?.isSuperAdmin && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">{tenant?.name || 'Organization'}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                Workspace Slug: {tenant?.slug || 'default'}
              </p>
            </div>
            <StatusBadge status={tenant?.status || 'ACTIVE'} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
            <div>
              <span className="text-slate-500 block mb-0.5">Subscription Tier</span>
              <span className="font-bold text-slate-900 dark:text-white">
                {tenant?.plan?.name || `Plan #${tenant?.planId || 1}`}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block mb-0.5">Contact Email</span>
              <span className="text-slate-800 dark:text-slate-200 font-mono">{tenant?.contactEmail || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-500 block mb-0.5">Created Date</span>
              <span className="text-slate-800 dark:text-slate-200">
                {tenant?.createdAt ? new Date(tenant.createdAt).toLocaleDateString() : 'N/A'}
              </span>
            </div>
          </div>

          {/* Data Lifecycle / GDPR Archive Section */}
          {canExportTenant && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-primary-500" />
                  Data Lifecycle & Compliance Archive
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Download an export archive of all organization assets, versions, licenses, seat allocations, categories, and tags.
                </p>
              </div>
              <button
                onClick={handleExportTenantData}
                disabled={isExportingTenant}
                className="inline-flex items-center px-3.5 py-2 text-xs font-semibold rounded-lg text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors shadow-sm disabled:opacity-50 shrink-0"
              >
                <Download className="w-3.5 h-3.5 mr-1.5 text-primary-500" />
                {isExportingTenant ? 'Archiving...' : 'Export Tenant Data (JSON)'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SESSION SECURITY */}
      {activeTab === 'security' && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Active Sessions & Token Rotation</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              AssetVault uses short-lived in-memory JWT access tokens (15-minute expiration) paired with SHA-256 hashed
              httpOnly rotating refresh tokens. If a token reuse attempt is detected, all sessions are automatically
              invalidated.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-xs font-bold text-rose-900 dark:text-rose-200">Revoke All Device Sessions</h4>
              <p className="text-xs text-rose-700 dark:text-rose-400 mt-0.5">
                Invalidates all active refresh tokens for your account across all browsers and devices.
              </p>
            </div>
            <button
              onClick={() => setIsLogoutAllOpen(true)}
              className="inline-flex items-center px-3.5 py-2 text-xs font-semibold rounded-lg text-white bg-rose-600 hover:bg-rose-700 transition-colors shrink-0 shadow-sm"
            >
              <LogOut className="w-3.5 h-3.5 mr-1.5" />
              Logout All Devices
            </button>
          </div>
        </div>
      )}

      {/* CONFIRM LOGOUT ALL */}
      <ConfirmDialog
        isOpen={isLogoutAllOpen}
        onClose={() => setIsLogoutAllOpen(false)}
        onConfirm={() => logoutAllMutation.mutate()}
        title="Revoke All Active Sessions"
        message="Are you sure you want to log out of all active sessions across every device? You will be returned to the login screen immediately."
        confirmText="Revoke All Sessions"
        variant="danger"
        isLoading={logoutAllMutation.isPending}
      />
    </div>
  );
};
