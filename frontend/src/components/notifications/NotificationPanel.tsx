// ==============================================================================
// AssetVault: Modern Slide-Over Notification Panel
// Course: BCSE307L Database Systems (Fall 2026-27)
// Slide-over right drawer, 4 tabs (All, Unread, Expiring, System),
// Colored type icons (rose=EXPIRED, amber=EXPIRY_7/15, blue=EXPIRY_30),
// License name chip, relative time, unread dot indicator, optimistic mark-as-read,
// Real-time SSE listener with slide-down animation, mobile pull-to-refresh,
// and animated bell empty state ("You're all caught up").
// ==============================================================================

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  CheckCheck,
  X,
  Clock,
  AlertTriangle,
  AlertOctagon,
  Info,
  Users2,
  RefreshCw,
  KeyRound,
  Calendar,
  Check,
} from 'lucide-react';
import { api } from '../../services/api';
import { Notification } from '../../types';
import { useToast } from '../../context/ToastContext';
import { NotificationStreamClient } from '../../services/notificationStream';
import { Badge, Skeleton } from '../ui';

export interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export type NotificationTab = 'all' | 'unread' | 'expiring' | 'system';

// ==============================================================================
// 1. Helper: Relative Time Formatter
// ==============================================================================

export function formatRelativeTime(dateString?: string | null): string {
  if (!dateString) return 'Just now';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Just now';

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 0 || diffInSeconds < 60) return 'Just now';

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

// ==============================================================================
// 2. Helper: Notification Type Icon & Color Mapping
// Requirements:
// - rose for EXPIRED
// - amber for EXPIRY_7/15
// - blue for EXPIRY_30
// ==============================================================================

export function getNotificationTypeMeta(type: string) {
  switch (type) {
    case 'EXPIRED':
      return {
        icon: AlertOctagon,
        badgeClass: 'text-rose-400 bg-rose-950/60 border-rose-800/60',
        dotClass: 'bg-rose-500',
        label: 'Expired',
      };
    case 'EXPIRY_7':
    case 'EXPIRY_15':
      return {
        icon: AlertTriangle,
        badgeClass: 'text-amber-400 bg-amber-950/60 border-amber-800/60',
        dotClass: 'bg-amber-500',
        label: type === 'EXPIRY_7' ? 'Expires in 7d' : 'Expires in 15d',
      };
    case 'EXPIRY_30':
    case 'LICENSE_EXPIRY':
      return {
        icon: Calendar,
        badgeClass: 'text-blue-400 bg-blue-950/60 border-blue-800/60',
        dotClass: 'bg-blue-500',
        label: 'Expires in 30d',
      };
    case 'OVER_ALLOCATION':
    case 'SEAT_LIMIT':
      return {
        icon: Users2,
        badgeClass: 'text-purple-400 bg-purple-950/60 border-purple-800/60',
        dotClass: 'bg-purple-500',
        label: 'Seat Quota Alert',
      };
    case 'SYSTEM':
    default:
      return {
        icon: Info,
        badgeClass: 'text-indigo-400 bg-indigo-950/60 border-indigo-800/60',
        dotClass: 'bg-indigo-500',
        label: 'System Notice',
      };
  }
}

// ==============================================================================
// 3. NotificationPanel Component
// ==============================================================================

export const NotificationPanel: React.FC<NotificationPanelProps> = ({
  isOpen,
  onClose,
}) => {
  const queryClient = useQueryClient();
  const toastContext = useToast();
  const toast = (toastContext as any).toast || toastContext;

  // Active Tab State: All, Unread, Expiring, System
  const [activeTab, setActiveTab] = useState<NotificationTab>('all');

  // Real-time incoming notifications from SSE
  const [liveNotifications, setLiveNotifications] = useState<Notification[]>([]);
  const [newArrivalIds, setNewArrivalIds] = useState<Set<string>>(new Set());

  // Mobile pull-to-refresh state
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // ============================================================================
  // Data Queries
  // ============================================================================

  const {
    data: notifResponse,
    isLoading,
    refetch,
  } = useQuery<{ data: Notification[] } | Notification[]>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await api.get<{ data: Notification[] }>('/notifications', {
        params: { limit: 50 },
      });
      return res;
    },
    enabled: isOpen,
  });

  const serverNotifications: Notification[] = useMemo(() => {
    if (!notifResponse) return [];
    if (Array.isArray(notifResponse)) return notifResponse;
    return (notifResponse as any)?.data || [];
  }, [notifResponse]);

  // Combined notifications (merging live SSE arrivals + server response)
  const allNotifications = useMemo(() => {
    const map = new Map<string, Notification>();
    // Prepend live arrivals
    for (const n of liveNotifications) {
      map.set(n.id, n);
    }
    // Add server notifications
    for (const n of serverNotifications) {
      if (!map.has(n.id)) {
        map.set(n.id, n);
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [liveNotifications, serverNotifications]);

  // Tab Filtering Counts
  const counts = useMemo(() => {
    const total = allNotifications.length;
    const unread = allNotifications.filter((n) => !n.isRead).length;
    const expiring = allNotifications.filter((n) =>
      ['EXPIRY_30', 'EXPIRY_15', 'EXPIRY_7', 'EXPIRED', 'LICENSE_EXPIRY'].includes(
        n.type
      )
    ).length;
    const system = allNotifications.filter(
      (n) =>
        ['SYSTEM', 'OVER_ALLOCATION', 'SEAT_LIMIT'].includes(n.type) ||
        !['EXPIRY_30', 'EXPIRY_15', 'EXPIRY_7', 'EXPIRED', 'LICENSE_EXPIRY'].includes(
          n.type
        )
    ).length;
    return { total, unread, expiring, system };
  }, [allNotifications]);

  // Filtered Notifications based on activeTab
  const displayedNotifications = useMemo(() => {
    switch (activeTab) {
      case 'unread':
        return allNotifications.filter((n) => !n.isRead);
      case 'expiring':
        return allNotifications.filter((n) =>
          [
            'EXPIRY_30',
            'EXPIRY_15',
            'EXPIRY_7',
            'EXPIRED',
            'LICENSE_EXPIRY',
          ].includes(n.type)
        );
      case 'system':
        return allNotifications.filter(
          (n) =>
            ['SYSTEM', 'OVER_ALLOCATION', 'SEAT_LIMIT'].includes(n.type) ||
            ![
              'EXPIRY_30',
              'EXPIRY_15',
              'EXPIRY_7',
              'EXPIRED',
              'LICENSE_EXPIRY',
            ].includes(n.type)
        );
      case 'all':
      default:
        return allNotifications;
    }
  }, [allNotifications, activeTab]);

  // ============================================================================
  // SSE Real-time Updates: Connect to GET /api/notifications/stream on panel open
  // ============================================================================

  useEffect(() => {
    if (!isOpen) return;

    const streamClient = new NotificationStreamClient({
      onNotification: (payload: any) => {
        const incomingId = payload.id || `notif-stream-${Date.now()}`;
        const newNotif: Notification = {
          id: incomingId,
          tenantId: payload.tenantId || '',
          userId: payload.userId,
          licenseId: payload.licenseId,
          type: payload.type || 'SYSTEM',
          title: payload.title || 'New Alert',
          message: payload.message || '',
          isRead: false,
          createdAt: payload.createdAt || new Date().toISOString(),
          ...(payload.license ? { license: payload.license } : {}),
        };

        // Mark as new arrival for slide-down animation
        setNewArrivalIds((prev) => new Set(prev).add(incomingId));

        // Prepend to live notifications state
        setLiveNotifications((prev) => [
          newNotif,
          ...prev.filter((item) => item.id !== incomingId),
        ]);

        // Invalidate query to update unread badge in topbar
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      },
    });

    streamClient.start();

    return () => {
      streamClient.stop();
    };
  }, [isOpen, queryClient]);

  // ============================================================================
  // Mutations: Optimistic Mark as Read & Mark All as Read
  // ============================================================================

  // Single Mark as Read (optimistic update)
  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`, {}),
    onMutate: async (id: string) => {
      // 1. Optimistically update local live state
      setLiveNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );

      // 2. Optimistically update React Query cache
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      const previousData = queryClient.getQueryData(['notifications']);

      queryClient.setQueriesData({ queryKey: ['notifications'] }, (old: any) => {
        if (!old) return old;
        if (Array.isArray(old)) {
          return old.map((n: Notification) =>
            n.id === id ? { ...n, isRead: true } : n
          );
        }
        if (old.data && Array.isArray(old.data)) {
          return {
            ...old,
            data: old.data.map((n: Notification) =>
              n.id === id ? { ...n, isRead: true } : n
            ),
          };
        }
        return old;
      });

      return { previousData };
    },
    onError: (_err, _id, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['notifications'], context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Mark All as Read (optimistic update)
  const markAllReadMutation = useMutation({
    mutationFn: () => api.patch('/notifications/read-all', {}),
    onMutate: async () => {
      setLiveNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true }))
      );

      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      const previousData = queryClient.getQueryData(['notifications']);

      queryClient.setQueriesData({ queryKey: ['notifications'] }, (old: any) => {
        if (!old) return old;
        if (Array.isArray(old)) {
          return old.map((n: Notification) => ({ ...n, isRead: true }));
        }
        if (old.data && Array.isArray(old.data)) {
          return {
            ...old,
            data: old.data.map((n: Notification) => ({ ...n, isRead: true })),
          };
        }
        return old;
      });

      return { previousData };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['notifications'], context.previousData);
      }
      toast.error('Failed to mark all notifications as read');
    },
    onSuccess: () => {
      toast.success('All notifications marked as read');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Trigger License Expiry Scan
  const runExpiryCheckMutation = useMutation({
    mutationFn: () =>
      api.post('/notifications/run-expiry-check', { lookaheadDays: 30 }),
    onSuccess: (data: any) => {
      const generated = data?.data?.notificationsGenerated || data?.notificationsGenerated || 0;
      toast.success(
        generated > 0
          ? `Scanned contracts: Generated ${generated} new license expiry alerts`
          : 'Scanned contracts: All active licenses are currently compliant'
      );
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to execute contract expiry check');
    },
  });

  // ============================================================================
  // Mobile Pull-to-Refresh Handlers
  // ============================================================================

  const handleTouchStart = (e: React.TouchEvent) => {
    if (scrollContainerRef.current && scrollContainerRef.current.scrollTop === 0) {
      touchStartY.current = e.touches[0].clientY;
    } else {
      touchStartY.current = null;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === null || isRefreshing) return;
    const currentY = e.touches[0].clientY;
    const delta = currentY - touchStartY.current;

    if (delta > 0 && scrollContainerRef.current?.scrollTop === 0) {
      // Apply rubberband dampening
      const distance = Math.min(delta * 0.45, 80);
      setPullDistance(distance);
    } else {
      setPullDistance(0);
    }
  };

  const handleTouchEnd = async () => {
    if (touchStartY.current === null) return;
    touchStartY.current = null;

    if (pullDistance >= 50 && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(50);
      try {
        await refetch();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" data-testid="notification-panel">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over Right Drawer Container */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10 z-50">
        <div className="relative w-screen max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-200">
          {/* ================================================================== */}
          {/* 1. Header: Title, Unread Count, Mark All Read, Close               */}
          {/* ================================================================== */}
          <div className="p-4 sm:px-6 sm:py-5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-950/60 border border-indigo-800/60 text-indigo-400">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-extrabold text-slate-100 tracking-tight">
                    Notifications
                  </h2>
                  {counts.unread > 0 && (
                    <Badge variant="info" size="sm" className="font-mono text-[10px] py-0 px-1.5">
                      {counts.unread} New
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">
                  Real-time contract alerts &amp; system updates
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Mark all as read button */}
              {counts.unread > 0 && (
                <button
                  type="button"
                  onClick={() => markAllReadMutation.mutate()}
                  disabled={markAllReadMutation.isPending}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  title="Mark all notifications as read"
                >
                  <CheckCheck className="w-4 h-4" />
                  <span className="hidden sm:inline">Mark all as read</span>
                </button>
              )}

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Close notification panel"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* ================================================================== */}
          {/* 2. Tabs: All, Unread, Expiring, System                             */}
          {/* ================================================================== */}
          <div className="flex items-center border-b border-slate-800 bg-slate-950/40 text-xs px-2 overflow-x-auto scrollbar-none">
            {[
              { id: 'all', label: 'All', count: counts.total },
              { id: 'unread', label: 'Unread', count: counts.unread },
              { id: 'expiring', label: 'Expiring', count: counts.expiring },
              { id: 'system', label: 'System', count: counts.system },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as NotificationTab)}
                  className={`flex items-center gap-1.5 px-3 py-2.5 font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'border-indigo-500 text-indigo-400 bg-indigo-950/20'
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-850/50'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.count > 0 && (
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                        isActive
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ================================================================== */}
          {/* 3. Pull-To-Refresh Indicator (Mobile Touch)                        */}
          {/* ================================================================== */}
          {pullDistance > 0 && (
            <div
              className="flex items-center justify-center gap-2 py-2 text-xs text-indigo-400 bg-indigo-950/30 border-b border-indigo-900/40 transition-all overflow-hidden"
              style={{ height: `${pullDistance}px` }}
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  isRefreshing ? 'animate-spin' : pullDistance >= 50 ? 'rotate-180' : ''
                } transition-transform duration-200`}
              />
              <span className="font-semibold text-[11px]">
                {isRefreshing
                  ? 'Refreshing notifications...'
                  : pullDistance >= 50
                  ? 'Release to refresh'
                  : 'Pull down to refresh'}
              </span>
            </div>
          )}

          {/* ================================================================== */}
          {/* 4. Notification List / Rows / Empty State                          */}
          {/* ================================================================== */}
          <div
            ref={scrollContainerRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="flex-1 overflow-y-auto p-4 space-y-2.5 divide-y-0"
          >
            {isLoading ? (
              <div className="space-y-3 pt-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} variant="card" className="h-24 rounded-xl" />
                ))}
              </div>
            ) : displayedNotifications.length === 0 ? (
              /* Empty State: Animated Bell + "You're all caught up" */
              <div className="flex flex-col items-center justify-center p-10 text-center my-auto min-h-[340px] space-y-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-slate-800/90 border border-slate-700/80 flex items-center justify-center text-slate-400 shadow-inner">
                    <Bell className="w-8 h-8 text-indigo-400 animate-bounce" />
                  </div>
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 ring-4 ring-slate-900 flex items-center justify-center shadow-sm">
                    <Check className="w-3 h-3 text-white stroke-[3]" />
                  </span>
                </div>

                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-100">
                    You&apos;re all caught up
                  </h3>
                  <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                    No notifications in this view right now. Check back later for license renewals and quota advisories.
                  </p>
                </div>
              </div>
            ) : (
              displayedNotifications.map((n) => {
                const meta = getNotificationTypeMeta(n.type);
                const IconComponent = meta.icon;
                const relativeTime = formatRelativeTime(n.createdAt);
                const isNew = newArrivalIds.has(n.id);

                // Extract license name chip
                const licenseName =
                  (n as any).license?.name ||
                  n.title ||
                  n.message.match(/license\s+['"]?([^'"]+)['"]?/i)?.[1] ||
                  'Enterprise License';

                return (
                  <div
                    key={n.id}
                    onClick={() => {
                      if (!n.isRead) {
                        markReadMutation.mutate(n.id);
                      }
                    }}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer relative ${
                      isNew ? 'animate-in slide-in-from-top-3 duration-300 ring-1 ring-indigo-500/50' : ''
                    } ${
                      !n.isRead
                        ? 'bg-slate-900 border-indigo-900/60 hover:bg-slate-850 hover:border-indigo-700/70 shadow-sm'
                        : 'bg-slate-950/60 border-slate-800/70 hover:bg-slate-900/80 hover:border-slate-700 opacity-80'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Colored Type Icon */}
                      <div
                        className={`p-2 rounded-xl border shrink-0 mt-0.5 ${meta.badgeClass}`}
                      >
                        <IconComponent className="w-4 h-4" />
                      </div>

                      {/* Content Column */}
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          {/* License Name Chip */}
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 border border-slate-700 text-slate-300 truncate max-w-[200px]">
                            <KeyRound className="w-3 h-3 text-indigo-400 shrink-0" />
                            <span className="truncate">{licenseName}</span>
                          </span>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Relative Timestamp */}
                            <span className="text-[10px] text-slate-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{relativeTime}</span>
                            </span>

                            {/* Unread Dot Indicator */}
                            {!n.isRead && (
                              <span
                                className="w-2 h-2 rounded-full bg-indigo-500 ring-2 ring-indigo-400/40 shrink-0 animate-pulse ml-0.5"
                                title="Unread alert"
                              />
                            )}
                          </div>
                        </div>

                        {/* Message Text */}
                        <p className="text-xs text-slate-200 font-medium leading-relaxed select-text">
                          {n.message}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* ================================================================== */}
          {/* 5. Footer: Expiry Scan Action & Indicator                          */}
          {/* ================================================================== */}
          <div className="p-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
            <span className="text-[11px] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Real-time SSE Sync Active</span>
            </span>

            <button
              type="button"
              onClick={() => runExpiryCheckMutation.mutate()}
              disabled={runExpiryCheckMutation.isPending}
              className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
              title="Run automated database scan for contracts expiring within 30 days"
            >
              <RefreshCw
                className={`w-3 h-3 ${
                  runExpiryCheckMutation.isPending ? 'animate-spin' : ''
                }`}
              />
              <span>Scan Expirations</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
