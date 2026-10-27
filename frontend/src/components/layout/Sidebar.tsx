// ==============================================================================
// AssetVault: Modern Collapsible Sidebar & Mobile Drawer Shell
// Course: BCSE307L Database Systems (Fall 2026-27)
// Features: 64px collapsed / 240px expanded states, localStorage persistence,
// grouped sections (Main, Manage, Platform, Settings), active indigo accent,
// tooltips when collapsed, and unread notification badge on bell icon.
// ==============================================================================

import React, { useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderLock,
  KeyRound,
  Layers,
  Users,
  Store,
  FolderTree,
  Tag as TagIcon,
  Bell,
  FileSpreadsheet,
  History,
  Settings,
  Shield,
  Building,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  X,
  Compass,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Tooltip } from '../ui/Tooltip';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { Notification } from '../../types';

export interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onMobileClose: () => void;
}

interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: React.ReactNode;
  permission?: string;
  roles?: string[];
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onMobileClose,
}) => {
  const { user, hasPermission, hasRole } = useAuth();
  const location = useLocation();

  // Query unread notifications count for bell badge
  const { data: notifData } = useQuery<Notification[]>({
    queryKey: ['notifications', 'sidebar-badge'],
    queryFn: async () => {
      const res = await api.get<{ data: Notification[] }>('/notifications', { limit: 10 });
      return res.data;
    },
    refetchInterval: 60000,
    enabled: !!user,
  });

  const unreadCount = notifData?.filter((n: Notification) => !n.isRead).length || 0;

  // Grouped Navigation Schema: Main, Manage, Platform, Settings
  const sections: NavSection[] = useMemo(() => {
    const roleName =
      typeof user?.role === 'object' && user?.role !== null
        ? (user.role as any).name
        : user?.role;

    if (user?.isSuperAdmin) {
      return [
        {
          title: 'Main',
          items: [
            {
              id: 'dashboard',
              label: 'Platform Overview',
              path: '/',
              icon: <Shield className="w-5 h-5 shrink-0" />,
            },
          ],
        },
        {
          title: 'Platform',
          items: [
            {
              id: 'tenants',
              label: 'Tenants',
              path: '/platform/tenants',
              icon: <Building className="w-5 h-5 shrink-0" />,
              permission: 'tenants:read_platform',
            },
            {
              id: 'plans',
              label: 'Subscription Plans',
              path: '/platform/plans',
              icon: <CreditCard className="w-5 h-5 shrink-0" />,
              permission: 'plans:read',
            },
          ],
        },
        {
          title: 'Settings',
          items: [
            {
              id: 'notifications',
              label: 'Notifications',
              path: '/notifications',
              icon: <Bell className="w-5 h-5 shrink-0" />,
            },
            {
              id: 'settings',
              label: 'Settings',
              path: '/settings',
              icon: <Settings className="w-5 h-5 shrink-0" />,
            },
          ],
        },
      ];
    }

    // Tenant / Organization Structure
    const mainItems: NavItem[] = [
      {
        id: 'dashboard',
        label: 'Dashboard',
        path: '/',
        icon: <LayoutDashboard className="w-5 h-5 shrink-0" />,
      },
      {
        id: 'assets',
        label: 'Digital Assets',
        path: '/assets',
        icon: <FolderLock className="w-5 h-5 shrink-0" />,
        permission: 'assets:read',
      },
    ];

    if (roleName === 'MEMBER') {
      mainItems.push({
        id: 'my_licenses',
        label: 'My Licenses',
        path: '/my-licenses',
        icon: <Compass className="w-5 h-5 shrink-0" />,
      });
    }

    const manageItems: NavItem[] = [];
    if (roleName === 'TENANT_ADMIN' || roleName === 'ASSET_MANAGER') {
      manageItems.push(
        {
          id: 'licenses',
          label: 'Licenses',
          path: '/licenses',
          icon: <KeyRound className="w-5 h-5 shrink-0" />,
          permission: 'licenses:read',
        },
        {
          id: 'allocations',
          label: 'Seat Allocations',
          path: '/allocations',
          icon: <Layers className="w-5 h-5 shrink-0" />,
          permission: 'allocations:read',
        },
        {
          id: 'vendors',
          label: 'Vendors',
          path: '/vendors',
          icon: <Store className="w-5 h-5 shrink-0" />,
          permission: 'vendors:read',
        },
        {
          id: 'categories',
          label: 'Categories',
          path: '/categories',
          icon: <FolderTree className="w-5 h-5 shrink-0" />,
          permission: 'categories:read',
        },
        {
          id: 'tags',
          label: 'Metadata Tags',
          path: '/tags',
          icon: <TagIcon className="w-5 h-5 shrink-0" />,
          permission: 'tags:read',
        },
        {
          id: 'reports',
          label: 'Analytical Reports',
          path: '/reports',
          icon: <FileSpreadsheet className="w-5 h-5 shrink-0" />,
        }
      );
    }

    if (roleName === 'TENANT_ADMIN') {
      manageItems.push(
        {
          id: 'users',
          label: 'Users & Roles',
          path: '/users',
          icon: <Users className="w-5 h-5 shrink-0" />,
          permission: 'users:read',
        },
        {
          id: 'audit_logs',
          label: 'Audit Trail',
          path: '/audit-logs',
          icon: <History className="w-5 h-5 shrink-0" />,
          permission: 'audit:read',
        }
      );
    }

    const settingsItems: NavItem[] = [
      {
        id: 'notifications',
        label: 'Notifications',
        path: '/notifications',
        icon: <Bell className="w-5 h-5 shrink-0" />,
      },
      {
        id: 'settings',
        label: 'Settings',
        path: '/settings',
        icon: <Settings className="w-5 h-5 shrink-0" />,
      },
    ];

    const result: NavSection[] = [{ title: 'Main', items: mainItems }];
    if (manageItems.length > 0) {
      result.push({ title: 'Manage', items: manageItems });
    }
    result.push({ title: 'Settings', items: settingsItems });

    return result;
  }, [user]);

  // Filter items by client-side RBAC permissions
  const filteredSections = useMemo(() => {
    return sections
      .map((sec) => ({
        title: sec.title,
        items: sec.items.filter((item) => {
          if (item.roles && !hasRole(item.roles as any)) return false;
          if (item.permission && !hasPermission(item.permission)) return false;
          return true;
        }),
      }))
      .filter((sec) => sec.items.length > 0);
  }, [sections, hasPermission, hasRole]);

  const isExpanded = !isCollapsed || isMobileOpen;

  const renderNavItem = (item: NavItem) => {
    const isBell = item.id === 'notifications';
    const isActive =
      location.pathname === item.path ||
      (item.path !== '/' && location.pathname.startsWith(item.path));

    const linkContent = (
      <NavLink
        to={item.path}
        onClick={isMobileOpen ? onMobileClose : undefined}
        className={`group relative flex items-center h-10 transition-all duration-150 select-none ${
          isExpanded ? 'px-3.5 gap-3 rounded-lg mx-2' : 'justify-center mx-2 rounded-lg'
        } ${
          isActive
            ? 'bg-indigo-950/60 text-white font-medium border-l-4 border-l-[var(--av-color-primary,#6366f1)] shadow-sm'
            : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 border-l-4 border-l-transparent'
        }`}
      >
        <span
          className={`relative flex items-center justify-center shrink-0 transition-colors ${
            isActive
              ? 'text-[var(--av-color-primary,#6366f1)]'
              : 'text-slate-400 group-hover:text-slate-200'
          }`}
        >
          {item.icon}
          {/* Notification red dot when collapsed */}
          {isBell && unreadCount > 0 && !isExpanded && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-slate-950 animate-pulse" />
          )}
        </span>

        {isExpanded && (
          <span className="truncate text-xs tracking-wide flex-1">{item.label}</span>
        )}

        {/* Unread count badge when expanded */}
        {isBell && unreadCount > 0 && isExpanded && (
          <span className="ml-auto px-1.5 py-0.5 text-[10px] font-bold bg-rose-500 text-white rounded-full leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </NavLink>
    );

    // If collapsed and desktop, wrap in Tooltip
    if (!isExpanded) {
      return (
        <Tooltip key={item.id} content={item.label} position="right">
          {linkContent}
        </Tooltip>
      );
    }

    return <React.Fragment key={item.id}>{linkContent}</React.Fragment>;
  };

  const navContent = (
    <div className="flex flex-col h-full bg-[var(--av-color-bg,#020617)] border-r border-[var(--av-color-border,#1e293b)] select-none">
      {/* Brand Header */}
      <div className="h-14 flex items-center justify-between px-3.5 border-b border-[var(--av-color-border,#1e293b)] shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[var(--av-color-primary-hover,#4f46e5)] to-[var(--av-color-primary,#6366f1)] flex items-center justify-center text-white font-black text-sm shadow-sm shrink-0">
            AV
          </div>
          {isExpanded && (
            <div className="flex flex-col truncate">
              <span className="font-bold text-sm tracking-tight text-slate-100">
                AssetVault
              </span>
              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-medium">
                Enterprise
              </span>
            </div>
          )}
        </div>

        {/* Mobile Close Button */}
        {isMobileOpen && (
          <button
            type="button"
            onClick={onMobileClose}
            aria-label="Close sidebar"
            className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 py-3 space-y-4 overflow-y-auto overflow-x-hidden">
        {filteredSections.map((sec, secIdx) => (
          <div key={sec.title} className="space-y-1">
            {isExpanded ? (
              <div className="px-5 pt-1 pb-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                {sec.title}
              </div>
            ) : (
              secIdx > 0 && <div className="my-2 border-t border-slate-800/60 mx-3" />
            )}
            <div className="space-y-0.5">{sec.items.map(renderNavItem)}</div>
          </div>
        ))}
      </nav>

      {/* Desktop Collapse / Pin Toggle Footer */}
      <div className="hidden lg:flex items-center justify-between p-2.5 border-t border-[var(--av-color-border,#1e293b)] shrink-0">
        {isExpanded && (
          <span className="text-[11px] text-slate-400 font-medium pl-2">
            Pin sidebar
          </span>
        )}
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={isCollapsed ? 'Expand sidebar (240px)' : 'Collapse sidebar (64px)'}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-lg transition-colors ml-auto flex items-center gap-1 cursor-pointer"
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar: 64px collapsed, 240px expanded with smooth transition */}
      <aside
        className={`hidden lg:block shrink-0 transition-all duration-300 ease-in-out ${
          isCollapsed ? 'w-[64px]' : 'w-[240px]'
        }`}
      >
        <div
          className={`fixed top-0 bottom-0 left-0 z-40 transition-all duration-300 ease-in-out ${
            isCollapsed ? 'w-[64px]' : 'w-[240px]'
          }`}
        >
          {navContent}
        </div>
      </aside>

      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm transition-opacity animate-fade-in"
            onClick={onMobileClose}
            aria-hidden="true"
          />
          <div className="relative w-[240px] max-w-[85vw] flex-1 z-50 animate-slide-in shadow-2xl">
            {navContent}
          </div>
        </div>
      )}
    </>
  );
};
