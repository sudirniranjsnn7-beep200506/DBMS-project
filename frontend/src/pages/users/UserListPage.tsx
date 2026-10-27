// ==============================================================================
// AssetVault: Modern Organization Team & User Management Interface
// Course: BCSE307L Database Systems (Fall 2026-27)
// Features: Inline Role Change, Optimistic Status Toggle, Invite Slide-Over,
// Bulk Selection & Deactivation, Real-Time Search, and Accessible Empty State
// ==============================================================================

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  UserPlus,
  KeyRound,
  Trash2,
  Search,
  X,
  Check,
  ChevronDown,
  UserX,
  Mail,
  Clock,
  RefreshCw,
  Sparkles,
  AlertCircle,
  Edit3,
} from 'lucide-react';
import { api } from '../../services/api';
import { User, RoleName } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  Button,
  Badge,
  Avatar,
  Input,
  Select,
  Skeleton,
} from '../../components/ui';
import { Pagination } from '../../components/common/Pagination';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { openGmailModal } from '../../components/notifications/SendGmailModal';

// ==============================================================================
// 1. Role Configuration & Styling Tokens
// ==============================================================================

export const ROLE_CONFIG: Record<
  RoleName,
  {
    label: string;
    description: string;
    badgeClass: string;
    dotClass: string;
  }
> = {
  SUPER_ADMIN: {
    label: 'Super Admin',
    description: 'Global system supervisor with complete root authority',
    badgeClass: 'bg-purple-950/60 text-purple-300 border-purple-800/60 hover:bg-purple-900/40',
    dotClass: 'bg-purple-400',
  },
  TENANT_ADMIN: {
    label: 'Tenant Admin',
    description: 'Full organizational authority over users, policies & billing',
    badgeClass: 'bg-indigo-950/60 text-indigo-300 border-indigo-800/60 hover:bg-indigo-900/40',
    dotClass: 'bg-indigo-400',
  },
  ASSET_MANAGER: {
    label: 'Asset Manager',
    description: 'Manage digital catalog assets, metadata and license seats',
    badgeClass: 'bg-blue-950/60 text-blue-300 border-blue-800/60 hover:bg-blue-900/40',
    dotClass: 'bg-blue-400',
  },
  MEMBER: {
    label: 'Member',
    description: 'Standard access to browse, checkout, and download assets',
    badgeClass: 'bg-slate-800/80 text-slate-300 border-slate-700/60 hover:bg-slate-750',
    dotClass: 'bg-slate-400',
  },
};

export const TENANT_ASSIGNABLE_ROLES: RoleName[] = [
  'TENANT_ADMIN',
  'ASSET_MANAGER',
  'MEMBER',
];

export function getRoleName(role: any): RoleName {
  if (!role) return 'MEMBER';
  if (typeof role === 'string') return role as RoleName;
  if (typeof role === 'object' && role.name) return role.name as RoleName;
  return 'MEMBER';
}

// ==============================================================================
// 2. Helper Utilities (Relative Time & Strong Password Generator)
// ==============================================================================

export function formatRelativeTime(dateString?: string | null): string {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Never';

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 0) return 'Just now';
  if (diffInSeconds < 60) return 'Just now';

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) return 'Yesterday';
  if (diffInDays < 7) return `${diffInDays}d ago`;

  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 5) return `${diffInWeeks}w ago`;

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) return `${diffInMonths}mo ago`;

  const diffInYears = Math.floor(diffInDays / 365);
  return `${diffInYears}y ago`;
}

export function generateSecurePassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%^&*';

  const pick = (chars: string) => chars[Math.floor(Math.random() * chars.length)];

  const parts = [
    pick(upper),
    pick(lower),
    pick(digits),
    pick(symbols),
    pick(upper),
    pick(lower),
    pick(digits),
    pick(symbols),
    pick(lower),
    pick(upper),
  ];

  return parts.sort(() => 0.5 - Math.random()).join('');
}

// ==============================================================================
// 3. Main UserListPage Component
// ==============================================================================

export const UserListPage: React.FC = () => {
  const { user: currentUser, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const toastContext = useToast();
  const toast = (toastContext as any).toast || toastContext;

  // Pagination & Filtering State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Bulk Selection State
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

  // Slide-over & Modal States
  const [isInviteDrawerOpen, setIsInviteDrawerOpen] = useState(false);
  const [roleDropdownUserId, setRoleDropdownUserId] = useState<string | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [editEmailUser, setEditEmailUser] = useState<User | null>(null);
  const [editEmailForm, setEditEmailForm] = useState({ fullName: '', email: '' });
  const [editEmailError, setEditEmailError] = useState('');
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const [showBulkDeactivateConfirm, setShowBulkDeactivateConfirm] = useState(false);

  // Invite Form State
  const [inviteForm, setInviteForm] = useState<{
    email: string;
    fullName: string;
    password: string;
    roleName: RoleName;
  }>({
    email: '',
    fullName: '',
    password: generateSecurePassword(),
    roleName: 'MEMBER',
  });
  const [inviteErrors, setInviteErrors] = useState<Record<string, string>>({});

  // Reset Password State
  const [newPassword, setNewPassword] = useState('');
  const [resetError, setResetError] = useState('');

  // Debounce search query to trigger server-side query after 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click outside listener for inline role dropdown
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!roleDropdownUserId) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !(e.target as HTMLElement).closest('[data-role-badge-btn]')
      ) {
        setRoleDropdownUserId(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setRoleDropdownUserId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [roleDropdownUserId]);

  // Escape key listener for invite slide-over
  useEffect(() => {
    if (!isInviteDrawerOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsInviteDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isInviteDrawerOpen]);

  // ============================================================================
  // Data Queries
  // ============================================================================

  const {
    data: usersResponse,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<{
    data: User[];
    meta: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }>({
    queryKey: ['users', page, limit, debouncedSearch, roleFilter, statusFilter],
    queryFn: async () => {
      const res = await api.get<{ data: User[]; meta: any }>('/users', {
        params: {
          page,
          limit,
          q: debouncedSearch || undefined,
          role: roleFilter || undefined,
          isActive: statusFilter || undefined,
        },
      });
      return res;
    },
  });

  const rawUsersList = usersResponse?.data || [];
  const meta = usersResponse?.meta || {
    page: 1,
    limit: 10,
    total: rawUsersList.length,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  };

  // Real-time client-side filter on loaded page
  const displayedUsers = useMemo(() => {
    if (!rawUsersList) return [];
    if (!searchQuery.trim()) return rawUsersList;
    const q = searchQuery.toLowerCase().trim();
    return rawUsersList.filter(
      (u) =>
        (u.fullName && u.fullName.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q))
    );
  }, [rawUsersList, searchQuery]);

  // Eligible users for bulk actions (exclude current user)
  const selectableUsers = useMemo(
    () => displayedUsers.filter((u) => u.id !== currentUser?.id),
    [displayedUsers, currentUser?.id]
  );

  const isAllSelected =
    selectableUsers.length > 0 &&
    selectableUsers.every((u) => selectedUserIds.has(u.id));

  const isSomeSelected =
    selectableUsers.some((u) => selectedUserIds.has(u.id)) && !isAllSelected;

  // Toggle selection for all users on current page
  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedUserIds(new Set());
    } else {
      const allIds = new Set(selectableUsers.map((u) => u.id));
      setSelectedUserIds(allIds);
    }
  };

  // Toggle single user selection
  const handleToggleSelectUser = (userId: string) => {
    if (userId === currentUser?.id) return;
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  // ============================================================================
  // Mutations
  // ============================================================================

  // 1. Invite / Create User Mutation
  const inviteMutation = useMutation({
    mutationFn: (data: typeof inviteForm) => api.post('/users', data),
    onSuccess: () => {
      toast.success('Team member invited and provisioned successfully');
      setIsInviteDrawerOpen(false);
      setInviteForm({
        email: '',
        fullName: '',
        password: generateSecurePassword(),
        roleName: 'MEMBER',
      });
      setInviteErrors({});
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to provision team member');
    },
  });

  // 2. Change Role Mutation (PATCH /users/:id/role)
  const changeRoleMutation = useMutation({
    mutationFn: ({ userId, roleName }: { userId: string; roleName: RoleName }) =>
      api.patch(`/users/${userId}/role`, { roleName }),
    onSuccess: (_, vars) => {
      toast.success(`Role updated to ${ROLE_CONFIG[vars.roleName]?.label || vars.roleName}`);
      setRoleDropdownUserId(null);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update member role');
    },
  });

  // 3. Optimistic Status Toggle Mutation (PATCH /users/:id/status)
  const toggleStatusMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      api.patch(`/users/${userId}/status`, { isActive }),
    onMutate: async ({ userId, isActive }) => {
      await queryClient.cancelQueries({ queryKey: ['users'] });

      // Snapshot previous query data across any active keys
      const previousData = queryClient.getQueryData([
        'users',
        page,
        limit,
        debouncedSearch,
        roleFilter,
        statusFilter,
      ]);

      // Optimistically update the user's status in cache
      queryClient.setQueryData(
        ['users', page, limit, debouncedSearch, roleFilter, statusFilter],
        (old: any) => {
          if (!old || !old.data) return old;
          return {
            ...old,
            data: old.data.map((u: User) => (u.id === userId ? { ...u, isActive } : u)),
          };
        }
      );

      return { previousData };
    },
    onError: (err: any, _vars, context: any) => {
      // Rollback to prior snapshot on failure
      if (context?.previousData) {
        queryClient.setQueryData(
          ['users', page, limit, debouncedSearch, roleFilter, statusFilter],
          context.previousData
        );
      }
      toast.error(err.message || 'Failed to update member status');
    },
    onSuccess: (_, vars) => {
      toast.success(
        vars.isActive
          ? 'Member account activated successfully'
          : 'Member account deactivated'
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  // 4. Bulk Deactivate Mutation
  const bulkDeactivateMutation = useMutation({
    mutationFn: async (userIds: string[]) => {
      const promises = userIds.map((id) =>
        api.patch(`/users/${id}/status`, { isActive: false })
      );
      return Promise.all(promises);
    },
    onSuccess: (_, userIds) => {
      toast.success(`Successfully deactivated ${userIds.length} team members`);
      setSelectedUserIds(new Set());
      setShowBulkDeactivateConfirm(false);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to execute bulk deactivation');
    },
  });

  // 5. Reset Password Mutation
  const resetPasswordMutation = useMutation({
    mutationFn: ({ userId, newPassword }: { userId: string; newPassword: string }) =>
      api.post(`/users/${userId}/reset-password`, { newPassword }),
    onSuccess: () => {
      toast.success('Member password reset successfully');
      setResetPasswordUser(null);
      setNewPassword('');
      setResetError('');
    },
    onError: (err: any) => {
      setResetError(err.message || 'Failed to reset password');
    },
  });

  // 6. Delete User Mutation
  const deleteMutation = useMutation({
    mutationFn: (userId: string) => api.delete(`/users/${userId}`),
    onSuccess: () => {
      toast.info('Member permanently removed from organization');
      setDeleteUser(null);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to remove user');
    },
  });

  // 7. Update User Email & Full Name Mutation
  const updateEmailMutation = useMutation({
    mutationFn: ({
      userId,
      email,
      fullName,
    }: {
      userId: string;
      email: string;
      fullName: string;
    }) => api.patch(`/users/${userId}`, { email, fullName }),
    onSuccess: async (_, vars) => {
      toast.success(`Updated email to ${vars.email}`);
      setEditEmailUser(null);
      setEditEmailError('');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['allocations'] });
      if (vars.userId === currentUser?.id) {
        try {
          await refreshProfile();
        } catch {}
      }
    },
    onError: (err: any) => {
      setEditEmailError(err.message || 'Failed to update user email');
    },
  });

  // ============================================================================
  // Form Submission Handlers
  // ============================================================================

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!inviteForm.fullName.trim() || inviteForm.fullName.trim().length < 2) {
      errors.fullName = 'Full name must be at least 2 characters';
    }

    if (!inviteForm.email.trim() || !/^\S+@\S+\.\S+$/.test(inviteForm.email)) {
      errors.email = 'Valid email address is required';
    }

    if (!inviteForm.password || inviteForm.password.length < 6) {
      errors.password = 'Password must be at least 6 characters long';
    }

    if (Object.keys(errors).length > 0) {
      setInviteErrors(errors);
      return;
    }

    inviteMutation.mutate(inviteForm);
  };

  const handleResetPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordUser) return;

    if (!newPassword || newPassword.length < 6) {
      setResetError('Password must be at least 6 characters long');
      return;
    }

    resetPasswordMutation.mutate({
      userId: resetPasswordUser.id,
      newPassword,
    });
  };

  const handleEditEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editEmailUser) return;

    const trimmedEmail = editEmailForm.email.trim().toLowerCase();
    const trimmedName = editEmailForm.fullName.trim();

    if (!trimmedName || trimmedName.length < 2) {
      setEditEmailError('Full name must be at least 2 characters');
      return;
    }

    if (!trimmedEmail || !/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setEditEmailError('Please enter a valid email address');
      return;
    }

    updateEmailMutation.mutate({
      userId: editEmailUser.id,
      email: trimmedEmail,
      fullName: trimmedName,
    });
  };

  return (
    <div className="space-y-6 pb-24">
      {/* ====================================================================== */}
      {/* 1. Header: Title, Description, and Create New User CTA                  */}
      {/* ====================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-950/60 border border-indigo-800/60 text-indigo-400">
              <Users className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight">
              Team &amp; Access Management
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Create new users, assign role permissions inline, manage active sessions, and oversee team credentials.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          iconLeft={<UserPlus className="w-4 h-4" />}
          onClick={() => {
            setInviteForm({
              email: '',
              fullName: '',
              password: generateSecurePassword(),
              roleName: 'MEMBER',
            });
            setInviteErrors({});
            setIsInviteDrawerOpen(true);
          }}
        >
          Create / Invite User
        </Button>
      </div>

      {/* ====================================================================== */}
      {/* 1B. Inline Create New User Bar (Direct Multi-Column User Creation)      */}
      {/* ====================================================================== */}
      <div className="p-4 sm:p-5 bg-slate-900/90 border border-indigo-500/30 rounded-xl shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-indigo-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-300">
              Create a New User
            </h2>
          </div>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            Add a team member directly to your organization
          </span>
        </div>

        <form
          onSubmit={handleInviteSubmit}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-start"
        >
          {/* Column 1: Full Name */}
          <div>
            <Input
              label="Full Name *"
              placeholder="e.g. Rahul Sharma"
              value={inviteForm.fullName}
              onChange={(e) => {
                setInviteForm({ ...inviteForm, fullName: e.target.value });
                if (inviteErrors.fullName) {
                  setInviteErrors((prev) => ({ ...prev, fullName: '' }));
                }
              }}
              error={inviteErrors.fullName}
            />
          </div>

          {/* Column 2: Work Email */}
          <div>
            <Input
              label="Work Email *"
              type="email"
              placeholder="rahul@organization.com"
              value={inviteForm.email}
              onChange={(e) => {
                setInviteForm({ ...inviteForm, email: e.target.value });
                if (inviteErrors.email) {
                  setInviteErrors((prev) => ({ ...prev, email: '' }));
                }
              }}
              error={inviteErrors.email}
            />
          </div>

          {/* Column 3: Role Assignment */}
          <div>
            <Select
              label="Role *"
              value={inviteForm.roleName}
              onChange={(e) =>
                setInviteForm({
                  ...inviteForm,
                  roleName: e.target.value as RoleName,
                })
              }
            >
              <option value="MEMBER">Member</option>
              <option value="ASSET_MANAGER">Asset Manager</option>
              <option value="TENANT_ADMIN">Tenant Admin</option>
            </Select>
          </div>

          {/* Column 4: Initial Password */}
          <div>
            <Input
              label="Password *"
              type="text"
              placeholder="Min 6 characters"
              value={inviteForm.password}
              onChange={(e) => {
                setInviteForm({ ...inviteForm, password: e.target.value });
                if (inviteErrors.password) {
                  setInviteErrors((prev) => ({ ...prev, password: '' }));
                }
              }}
              error={inviteErrors.password}
              className="font-mono text-xs"
              rightAction={
                <button
                  type="button"
                  onClick={() =>
                    setInviteForm({
                      ...inviteForm,
                      password: generateSecurePassword(),
                    })
                  }
                  className="p-1 text-slate-400 hover:text-indigo-400 transition-colors"
                  title="Generate secure password"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              }
            />
          </div>

          {/* Column 5: Submit Action */}
          <div className="pt-0 sm:pt-6">
            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full"
              iconLeft={<UserPlus className="w-4 h-4" />}
              isLoading={inviteMutation.isPending}
            >
              Create User
            </Button>
          </div>
        </form>
      </div>

      {/* ====================================================================== */}
      {/* 2. Filter & Search Toolbar                                              */}
      {/* ====================================================================== */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        {/* Real-Time Search Bar */}
        <div className="w-full sm:w-80">
          <Input
            placeholder="Search by name or email in real-time..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            iconLeft={<Search className="w-4 h-4 text-slate-500" />}
            rightAction={
              searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : undefined
            }
          />
        </div>

        {/* Filters: Role & Status */}
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Role Filter */}
          <Select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="w-36 text-xs"
            aria-label="Filter by role"
          >
            <option value="">All Roles</option>
            <option value="TENANT_ADMIN">Tenant Admin</option>
            <option value="ASSET_MANAGER">Asset Manager</option>
            <option value="MEMBER">Member</option>
          </Select>

          {/* Status Filter */}
          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="w-36 text-xs"
            aria-label="Filter by status"
          >
            <option value="">All Statuses</option>
            <option value="true">Active Only</option>
            <option value="false">Inactive Only</option>
          </Select>
        </div>
      </div>

      {/* Query Error Notice */}
      {isError && (
        <div className="p-4 bg-rose-950/40 border border-rose-900/60 rounded-xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-rose-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{(error as any)?.message || 'Failed to load organization members.'}</span>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="font-semibold text-rose-300 underline hover:no-underline"
          >
            Retry Query
          </button>
        </div>
      )}

      {/* ====================================================================== */}
      {/* 3. Team Members Table or Empty States                                   */}
      {/* ====================================================================== */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton variant="card" className="h-12 rounded-xl" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} variant="row" className="h-16" />
          ))}
        </div>
      ) : displayedUsers.length === 0 ? (
        // Empty State Handler
        searchQuery ? (
          <div className="text-center p-12 bg-slate-900 border border-slate-800 rounded-2xl max-w-md mx-auto my-6 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-400 mx-auto">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-200">No matching members found</h3>
            <p className="text-xs text-slate-400">
              No colleagues match the query &quot;<span className="text-slate-200">{searchQuery}</span>&quot;. Try clearing filters.
            </p>
            <Button variant="secondary" size="sm" onClick={() => setSearchQuery('')}>
              Clear Search Query
            </Button>
          </div>
        ) : (
          // Full Empty State with Illustration & CTA
          <div className="text-center p-12 bg-slate-900 border border-slate-800 rounded-2xl max-w-lg mx-auto my-8 space-y-5 shadow-sm">
            {/* Custom Modern SVG Illustration */}
            <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-indigo-500/10 blur-xl animate-pulse" />
              <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 border border-indigo-800/50 flex items-center justify-center shadow-lg">
                <Users className="w-10 h-10 text-indigo-400" />
                <div className="absolute -bottom-1 -right-1 p-1 rounded-lg bg-indigo-600 text-white shadow-md">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-extrabold text-slate-100 tracking-tight">
                No Team Members Yet
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                Invite colleagues to your organization to collaborate on digital assets, manage software licenses, and assign role-based privileges.
              </p>
            </div>

            <Button
              variant="primary"
              size="md"
              iconLeft={<UserPlus className="w-4 h-4" />}
              onClick={() => {
                setInviteForm({
                  email: '',
                  fullName: '',
                  password: generateSecurePassword(),
                  roleName: 'MEMBER',
                });
                setInviteErrors({});
                setIsInviteDrawerOpen(true);
              }}
            >
              Invite your first team member
            </Button>
          </div>
        )
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs divide-y divide-slate-800">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  {/* Select All Checkbox */}
                  <th className="py-3.5 pl-4 pr-2 w-10">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = isSomeSelected;
                      }}
                      onChange={handleToggleSelectAll}
                      className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      title="Select all members on this page"
                      aria-label="Select all members"
                    />
                  </th>
                  {/* Column 1: Avatar + Name */}
                  <th className="py-3.5 px-4">Avatar + Name</th>
                  {/* Column 2: Email */}
                  <th className="py-3.5 px-4">Email</th>
                  {/* Column 3: Role badge */}
                  <th className="py-3.5 px-4">Role</th>
                  {/* Column 4: Status toggle */}
                  <th className="py-3.5 px-4">Status</th>
                  {/* Column 5: Last Login */}
                  <th className="py-3.5 px-4">Last Login</th>
                  {/* Column 6: Actions */}
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800/80">
                {displayedUsers.map((u) => {
                  const roleName = getRoleName(u.role);
                  const roleMeta = ROLE_CONFIG[roleName] || ROLE_CONFIG.MEMBER;
                  const isCurrent = currentUser?.id === u.id;
                  const isSelected = selectedUserIds.has(u.id);
                  const isDropdownOpen = roleDropdownUserId === u.id;
                  const relativeLogin = formatRelativeTime(u.lastLoginAt);

                  return (
                    <tr
                      key={u.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isSelected ? 'bg-indigo-950/20' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 pl-4 pr-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={isCurrent}
                          onChange={() => handleToggleSelectUser(u.id)}
                          className={`w-4 h-4 rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-indigo-500 ${
                            isCurrent ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
                          }`}
                          aria-label={`Select ${u.fullName}`}
                        />
                      </td>

                      {/* Column 1: Avatar + Name */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <Avatar
                            name={u.fullName}
                            src={u.avatarUrl || undefined}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-100 truncate block">
                                {u.fullName}
                              </span>
                              {isCurrent && (
                                <Badge variant="info" size="sm" className="text-[10px] py-0">
                                  You
                                </Badge>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 font-mono truncate block sm:hidden">
                              {u.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Column 2: Email */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2 group">
                          <span className="font-mono text-slate-300 select-all flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span>{u.email}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditEmailUser(u);
                              setEditEmailForm({
                                fullName: u.fullName || '',
                                email: u.email || '',
                              });
                              setEditEmailError('');
                            }}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 hover:bg-indigo-600/30 text-indigo-300 border border-slate-700 hover:border-indigo-500/50 transition-colors cursor-pointer"
                            title="Edit email address"
                          >
                            <Edit3 className="w-2.5 h-2.5" />
                            <span>Edit Email</span>
                          </button>
                        </div>
                      </td>

                      {/* Column 3: Role badge (Interactive Inline Role Change) */}
                      <td className="py-3.5 px-4 relative">
                        <button
                          type="button"
                          data-role-badge-btn
                          onClick={() =>
                            setRoleDropdownUserId(isDropdownOpen ? null : u.id)
                          }
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer select-none ${roleMeta.badgeClass}`}
                          title="Click to change role"
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${roleMeta.dotClass}`}
                          />
                          <span>{roleMeta.label}</span>
                          <ChevronDown className="w-3 h-3 text-slate-400 ml-0.5" />
                        </button>

                        {/* Inline Role Dropdown Popover */}
                        {isDropdownOpen && (
                          <div
                            ref={dropdownRef}
                            data-role-dropdown
                            className="absolute left-4 top-12 z-30 w-64 p-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-150"
                          >
                            <div className="px-2 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                              Change Role for {u.fullName.split(' ')[0]}
                            </div>
                            <div className="mt-1 space-y-1">
                              {TENANT_ASSIGNABLE_ROLES.map((r) => {
                                const opt = ROLE_CONFIG[r];
                                const isSelectedRole = roleName === r;

                                return (
                                  <button
                                    key={r}
                                    type="button"
                                    onClick={() =>
                                      changeRoleMutation.mutate({
                                        userId: u.id,
                                        roleName: r,
                                      })
                                    }
                                    className={`w-full text-left p-2 rounded-lg text-xs transition-colors flex items-start justify-between gap-2 ${
                                      isSelectedRole
                                        ? 'bg-indigo-950/60 text-indigo-300 font-semibold'
                                        : 'hover:bg-slate-800 text-slate-300'
                                    }`}
                                  >
                                    <div>
                                      <div className="flex items-center gap-1.5">
                                        <span
                                          className={`w-1.5 h-1.5 rounded-full ${opt.dotClass}`}
                                        />
                                        <span>{opt.label}</span>
                                      </div>
                                      <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                                        {opt.description}
                                      </p>
                                    </div>
                                    {isSelectedRole && (
                                      <Check className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Column 4: Status toggle (Active/Inactive switch with optimistic update) */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={u.isActive}
                            disabled={isCurrent || toggleStatusMutation.isPending}
                            onClick={() =>
                              toggleStatusMutation.mutate({
                                userId: u.id,
                                isActive: !u.isActive,
                              })
                            }
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                              u.isActive ? 'bg-emerald-500' : 'bg-slate-700'
                            } ${isCurrent ? 'opacity-40 cursor-not-allowed' : ''}`}
                            title={
                              isCurrent
                                ? 'Cannot modify your own active account status'
                                : u.isActive
                                ? 'Click to deactivate member'
                                : 'Click to activate member'
                            }
                          >
                            <span className="sr-only">
                              {u.isActive ? 'Active Member' : 'Inactive Member'}
                            </span>
                            <span
                              aria-hidden="true"
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                u.isActive ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                          <span
                            className={`text-[11px] font-semibold ${
                              u.isActive ? 'text-emerald-400' : 'text-slate-500'
                            }`}
                          >
                            {u.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </td>

                      {/* Column 5: Last Login relative time */}
                      <td className="py-3.5 px-4">
                        <div
                          className="flex items-center gap-1.5 text-slate-300"
                          title={
                            u.lastLoginAt
                              ? new Date(u.lastLoginAt).toLocaleString()
                              : 'Never logged in'
                          }
                        >
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          <span>{relativeLogin}</span>
                        </div>
                      </td>

                      {/* Column 6: Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Send Gmail Notification Button */}
                          <button
                            type="button"
                            onClick={() =>
                              openGmailModal({
                                recipientName: u.fullName,
                                recipientEmail: u.email,
                                notificationTitle: 'Workspace Notification & License Update',
                              })
                            }
                            className="p-1.5 text-indigo-400 hover:text-indigo-200 hover:bg-indigo-950/50 rounded-lg transition-colors cursor-pointer"
                            title="Send email via Gmail"
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit Email & Name Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setEditEmailUser(u);
                              setEditEmailForm({
                                fullName: u.fullName || '',
                                email: u.email || '',
                              });
                              setEditEmailError('');
                            }}
                            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            title="Edit email & name"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Reset Password Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setResetPasswordUser(u);
                              setNewPassword(generateSecurePassword());
                              setResetError('');
                            }}
                            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            title="Reset password"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Member Button */}
                          {!isCurrent && (
                            <button
                              type="button"
                              onClick={() => setDeleteUser(u)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                              title="Remove user"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Pagination Footer */}
          <div className="p-3 border-t border-slate-800 bg-slate-950/40">
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

      {/* ====================================================================== */}
      {/* 4. Floating Bulk Actions Bar (Visible when selectedUserIds.size > 0)    */}
      {/* ====================================================================== */}
      {selectedUserIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-5 py-3 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-slate-700 shadow-2xl text-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <Badge variant="info" size="md" className="font-semibold">
            {selectedUserIds.size} Members Selected
          </Badge>

          <div className="h-5 w-px bg-slate-700" />

          {/* Bulk Deactivate Button */}
          <Button
            variant="danger"
            size="sm"
            iconLeft={<UserX className="w-3.5 h-3.5" />}
            onClick={() => setShowBulkDeactivateConfirm(true)}
          >
            Deactivate Selected
          </Button>

          {/* Deselect All Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedUserIds(new Set())}
          >
            Deselect All
          </Button>
        </div>
      )}

      {/* ====================================================================== */}
      {/* 5. Invite User Slide-Over Drawer                                        */}
      {/* ====================================================================== */}
      {isInviteDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
            onClick={() => setIsInviteDrawerOpen(false)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="relative w-screen max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-200">
              {/* Drawer Header */}
              <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-950/60 border border-indigo-800/60 text-indigo-400">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-slate-100 tracking-tight">
                      Invite Team Member
                    </h2>
                    <p className="text-xs text-slate-400">
                      Provision credentials and assign organizational roles
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsInviteDrawerOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition-colors"
                  aria-label="Close drawer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Form Body */}
              <form
                id="invite-user-form"
                onSubmit={handleInviteSubmit}
                className="flex-1 overflow-y-auto p-6 space-y-4"
              >
                {/* Full Name */}
                <Input
                  label="Full Name *"
                  placeholder="e.g. Elena Rostova"
                  value={inviteForm.fullName}
                  onChange={(e) => {
                    setInviteForm({ ...inviteForm, fullName: e.target.value });
                    if (inviteErrors.fullName) {
                      setInviteErrors((prev) => ({ ...prev, fullName: '' }));
                    }
                  }}
                  error={inviteErrors.fullName}
                  autoFocus
                />

                {/* Email Address */}
                <Input
                  label="Email Address *"
                  type="email"
                  placeholder="elena.rostova@organization.com"
                  value={inviteForm.email}
                  onChange={(e) => {
                    setInviteForm({ ...inviteForm, email: e.target.value });
                    if (inviteErrors.email) {
                      setInviteErrors((prev) => ({ ...prev, email: '' }));
                    }
                  }}
                  error={inviteErrors.email}
                />

                {/* Role Select */}
                <Select
                  label="Role Assignment *"
                  value={inviteForm.roleName}
                  onChange={(e) =>
                    setInviteForm({
                      ...inviteForm,
                      roleName: e.target.value as RoleName,
                    })
                  }
                >
                  <option value="MEMBER">Member — Standard asset checkout &amp; catalog consumer</option>
                  <option value="ASSET_MANAGER">Asset Manager — Upload assets and allocate licenses</option>
                  <option value="TENANT_ADMIN">Tenant Admin — Full organizational configuration &amp; oversight</option>
                </Select>

                {/* Initial Temporary Password */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300">
                      Initial Temporary Password *
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setInviteForm({
                          ...inviteForm,
                          password: generateSecurePassword(),
                        })
                      }
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Regenerate</span>
                    </button>
                  </div>

                  <Input
                    type="text"
                    value={inviteForm.password}
                    onChange={(e) => {
                      setInviteForm({ ...inviteForm, password: e.target.value });
                      if (inviteErrors.password) {
                        setInviteErrors((prev) => ({ ...prev, password: '' }));
                      }
                    }}
                    error={inviteErrors.password}
                    className="font-mono text-xs"
                  />
                  <p className="text-[11px] text-slate-500">
                    Meets complexity requirements (&ge;10 chars with uppercase, lowercase, number &amp; symbol). The user can reset it upon first sign-in.
                  </p>
                </div>
              </form>

              {/* Drawer Footer Actions */}
              <div className="p-5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end gap-2.5">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => setIsInviteDrawerOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  form="invite-user-form"
                  variant="primary"
                  size="md"
                  isLoading={inviteMutation.isPending}
                >
                  Send Invitation
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================== */}
      {/* 6. Modal: Reset Password Dialog                                         */}
      {/* ====================================================================== */}
      <Modal
        isOpen={Boolean(resetPasswordUser)}
        onClose={() => setResetPasswordUser(null)}
        title="Reset User Password"
        description={`Set a new temporary password for ${resetPasswordUser?.fullName}`}
        maxWidth="md"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setResetPasswordUser(null)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={resetPasswordMutation.isPending}
              onClick={handleResetPasswordSubmit}
            >
              Update Password
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="New Password *"
            type="text"
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              setResetError('');
            }}
            error={resetError}
            className="font-mono text-xs"
            rightAction={
              <button
                type="button"
                onClick={() => setNewPassword(generateSecurePassword())}
                className="p-1 text-slate-400 hover:text-indigo-400"
                title="Generate secure password"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            }
          />
          <p className="text-[11px] text-slate-400">
            Must contain at least 10 characters with upper/lowercase letters, a number, and a symbol.
          </p>
        </div>
      </Modal>

      {/* ====================================================================== */}
      {/* 6B. Modal: Edit User Email & Full Name Dialog                          */}
      {/* ====================================================================== */}
      <Modal
        isOpen={Boolean(editEmailUser)}
        onClose={() => setEditEmailUser(null)}
        title="Edit Member Email & Profile"
        description={`Update email address and display name for ${editEmailUser?.fullName}`}
        maxWidth="md"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setEditEmailUser(null)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={updateEmailMutation.isPending}
              onClick={handleEditEmailSubmit}
            >
              Save Email
            </Button>
          </>
        }
      >
        <form onSubmit={handleEditEmailSubmit} className="space-y-4">
          <Input
            label="Full Name *"
            type="text"
            value={editEmailForm.fullName}
            onChange={(e) => {
              setEditEmailForm({ ...editEmailForm, fullName: e.target.value });
              setEditEmailError('');
            }}
          />
          <Input
            label="Email Address *"
            type="email"
            value={editEmailForm.email}
            onChange={(e) => {
              setEditEmailForm({ ...editEmailForm, email: e.target.value });
              setEditEmailError('');
            }}
            error={editEmailError}
            className="font-mono text-xs"
            placeholder="e.g. sudirniranjsnn07@gmail.com"
          />
          <p className="text-[11px] text-slate-400">
            Updating a member&apos;s email immediately updates their recipient address for Gmail notifications and license seat allocations.
          </p>
        </form>
      </Modal>

      {/* ====================================================================== */}
      {/* 7. Confirm Dialog: Bulk Deactivation                                   */}
      {/* ====================================================================== */}
      <ConfirmDialog
        isOpen={showBulkDeactivateConfirm}
        onClose={() => setShowBulkDeactivateConfirm(false)}
        onConfirm={() =>
          bulkDeactivateMutation.mutate(Array.from(selectedUserIds))
        }
        title="Deactivate Selected Members"
        message={`Are you sure you want to deactivate ${selectedUserIds.size} team members? Their active sessions will be terminated and they will not be able to log in until reactivated.`}
        confirmText="Deactivate Members"
        variant="danger"
        isLoading={bulkDeactivateMutation.isPending}
      />

      {/* ====================================================================== */}
      {/* 8. Confirm Dialog: Delete Single User                                  */}
      {/* ====================================================================== */}
      <ConfirmDialog
        isOpen={Boolean(deleteUser)}
        onClose={() => setDeleteUser(null)}
        onConfirm={() => {
          if (deleteUser) deleteMutation.mutate(deleteUser.id);
        }}
        title="Remove Member from Organization"
        message={`Are you sure you want to remove ${deleteUser?.fullName}? This will revoke their seat allocations, purge their credentials, and remove them permanently.`}
        confirmText="Remove Member"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};
