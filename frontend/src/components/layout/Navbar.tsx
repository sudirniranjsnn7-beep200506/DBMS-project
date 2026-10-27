// ==============================================================================
// AssetVault: Modern Top Navigation Bar (56px Blurred Glass Shell)
// Course: BCSE307L Database Systems (Fall 2026-27)
// Features: 56px height, backdrop-blur-md glass, breadcrumb trail on the left,
// Cmd+K global search trigger, notification bell with slide-over panel, and avatar dropdown.
// ==============================================================================

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Menu,
  Bell,
  Sun,
  Moon,
  LogOut,
  User as UserIcon,
  Settings,
  Shield,
  ChevronDown,
  ChevronRight,
  Search,
  Home,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { StatusBadge } from '../common/StatusBadge';
import { CommandPalette } from '../common/CommandPalette';
import { NotificationPanel } from '../notifications/NotificationPanel';
import { Avatar } from '../ui/Avatar';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { Notification } from '../../types';

export interface NavbarProps {
  onMobileMenuToggle: () => void;
}

const ROUTE_LABELS: Record<string, string> = {
  assets: 'Digital Assets',
  licenses: 'Licenses',
  'my-licenses': 'My Licenses',
  allocations: 'Seat Allocations',
  vendors: 'Vendors',
  categories: 'Categories',
  tags: 'Metadata Tags',
  users: 'Users & Roles',
  reports: 'Analytical Reports',
  'audit-logs': 'Audit Trail',
  notifications: 'Notifications',
  settings: 'Settings',
  platform: 'Platform',
  tenants: 'Tenants',
  plans: 'Plans',
};

export const Navbar: React.FC<NavbarProps> = ({ onMobileMenuToggle }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotifPanelOpen, setIsNotifPanelOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const userRole =
    typeof user?.role === 'object' && user?.role !== null
      ? (user.role as any).name
      : user?.role;

  // Dynamic Breadcrumb Trail
  const breadcrumbs = useMemo(() => {
    const segments = location.pathname.split('/').filter(Boolean);
    if (segments.length === 0) {
      return [{ label: 'Dashboard', path: '/' }];
    }

    const list = [{ label: 'Home', path: '/' }];
    let accumulatedPath = '';

    segments.forEach((seg) => {
      accumulatedPath += `/${seg}`;
      let label = ROUTE_LABELS[seg.toLowerCase()];
      if (!label) {
        if (seg.length > 12) {
          label = 'Details';
        } else {
          label = seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ');
        }
      }
      list.push({ label, path: accumulatedPath });
    });

    return list;
  }, [location.pathname]);

  // Global Ctrl+K / Cmd+K shortcut for Command Palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const userMenuRef = useRef<HTMLDivElement>(null);

  // Click outside listener for user dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Poll notifications count for topbar bell badge
  const { data: notifData } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await api.get<{ data: Notification[] }>('/notifications', { limit: 20 });
      return (res as any)?.data || (res as any) || [];
    },
    refetchInterval: 30000,
    enabled: !!user,
  });

  const unreadCount = Array.isArray(notifData)
    ? notifData.filter((n: Notification) => !n.isRead).length
    : 0;

  const handleLogout = async () => {
    try {
      await logout();
      toast.info('You have been logged out');
      navigate('/login');
    } catch {
      navigate('/login');
    }
  };

  return (
    <header className="h-14 px-3 sm:px-6 backdrop-blur-md bg-white/80 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 sticky top-0 z-30 transition-colors">
      {/* Left: Mobile Drawer Trigger & Breadcrumb Trail */}
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          onClick={onMobileMenuToggle}
          className="lg:hidden p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 rounded-lg transition-colors cursor-pointer"
          aria-label="Toggle navigation drawer"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Breadcrumb Trail */}
        <nav aria-label="Breadcrumbs" className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 min-w-0">
          <Link
            to="/"
            className="flex items-center hover:text-slate-900 dark:hover:text-slate-100 transition-colors shrink-0"
            title="Home"
          >
            <Home className="w-3.5 h-3.5" />
          </Link>

          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            // Skip the first "Home" crumb since we rendered the icon
            if (crumb.path === '/' && idx === 0) return null;

            return (
              <React.Fragment key={crumb.path}>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600 shrink-0" />
                {isLast ? (
                  <span className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[140px] sm:max-w-[200px]">
                    {crumb.label}
                  </span>
                ) : (
                  <Link
                    to={crumb.path}
                    className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors truncate max-w-[100px] sm:max-w-[160px]"
                  >
                    {crumb.label}
                  </Link>
                )}
              </React.Fragment>
            );
          })}
        </nav>
      </div>

      {/* Right: Global Search (Cmd+K), Theme, Notifications, Avatar */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Global Search Trigger (Cmd+K) */}
        <button
          type="button"
          onClick={() => setIsSearchOpen(true)}
          className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900/90 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-800 transition-all cursor-pointer shadow-xs"
          aria-label="Open global search (Cmd+K)"
        >
          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="hidden md:inline truncate text-[11px] font-medium">Search workspace...</span>
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold bg-white dark:bg-slate-950 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800 rounded shadow-xs">
            ⌘K
          </kbd>
        </button>

        {/* Gemini AI Chat Toggle Button */}
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('assetvault:toggle-ai-chat'))}
          aria-label="Toggle Gemini AI Chatbot"
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800/70 rounded-lg transition-colors cursor-pointer"
        >
          <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
          <span className="hidden sm:inline text-[11px]">AI Chat</span>
        </button>

        {/* Theme Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/80 rounded-lg transition-colors cursor-pointer"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Notification Bell Trigger (Opens Slide-Over Panel) */}
        <button
          type="button"
          onClick={() => setIsNotifPanelOpen(true)}
          aria-label="Notifications"
          className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/80 rounded-lg transition-colors relative cursor-pointer"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-950 animate-pulse" />
          )}
        </button>

        {/* User Avatar Dropdown */}
        <div className="relative" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setIsUserMenuOpen((prev) => !prev)}
            className="flex items-center gap-2 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
            aria-label="User profile menu"
          >
            <Avatar
              size="sm"
              name={user?.fullName}
              src={user?.avatarUrl}
              isOnline={true}
            />
            <div className="hidden sm:block text-left text-xs leading-tight">
              <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate max-w-[120px]">
                {user?.fullName}
              </span>
              <span className="text-[10px] text-slate-400 uppercase font-medium">
                {userRole?.replace('_', ' ')}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
          </button>

          {isUserMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl py-1.5 z-50 animate-fade-in text-xs divide-y divide-slate-100 dark:divide-slate-800">
              <div className="p-3">
                <p className="font-bold text-slate-900 dark:text-slate-100 truncate">
                  {user?.fullName}
                </p>
                <p className="text-slate-400 truncate mt-0.5">{user?.email}</p>
                <div className="mt-2">
                  <StatusBadge status={userRole} size="sm" />
                </div>
              </div>

              <div className="py-1">
                <Link
                  to="/settings"
                  onClick={() => setIsUserMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span>Profile & Password</span>
                </Link>
                {userRole === 'TENANT_ADMIN' && (
                  <Link
                    to="/settings"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5 text-slate-400" />
                    <span>Organization Settings</span>
                  </Link>
                )}
                {user?.isSuperAdmin && (
                  <Link
                    to="/platform/tenants"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Shield className="w-3.5 h-3.5 text-slate-400" />
                    <span>Platform Admin</span>
                  </Link>
                )}
              </div>

              <div className="py-1">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-2.5 w-full text-left px-3 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors font-medium cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Global Multi-Entity Command Palette Modal */}
      <CommandPalette isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

      {/* Slide-over Notification Panel */}
      <NotificationPanel isOpen={isNotifPanelOpen} onClose={() => setIsNotifPanelOpen(false)} />
    </header>
  );
};
