// ==============================================================================
// AssetVault: Modern Spotlight-Style Command Palette (Ctrl+K / Cmd+K)
// Course: BCSE307L Database Systems (Fall 2026-27)
// Features: Full-screen backdrop blur, 600px centered modal, debounced 300ms search,
// grouped results (Assets, Licenses, Vendors, Tags), recent pages via sessionStorage,
// keyboard navigation, loading skeleton, and scale+opacity open/close transitions.
// ==============================================================================

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Search,
  Package,
  KeyRound,
  Building2,
  Tag as TagIcon,
  X,
  CornerDownLeft,
  Clock,
  Compass,
} from 'lucide-react';
import { api } from '../../services/api';
import { Badge } from '../ui/Badge';
import { Skeleton } from '../ui/Skeleton';
import { cn } from '../../utils/cn';

export interface SearchResultItem {
  id: string;
  type: 'asset' | 'license' | 'vendor' | 'tag' | 'page';
  title: string;
  subtitle: string;
  url: string;
  status?: string;
  meta?: any;
}

export interface SearchResponse {
  query: string;
  results: {
    assets: SearchResultItem[];
    licenses: SearchResultItem[];
    vendors: SearchResultItem[];
    tags: SearchResultItem[];
  };
  total: number;
}

export interface RecentPageItem {
  id: string;
  type: 'asset' | 'license' | 'vendor' | 'tag' | 'page';
  title: string;
  subtitle: string;
  url: string;
  status?: string;
  visitedAt?: number;
}

export interface CommandPaletteProps {
  isOpen?: boolean;
  onClose?: () => void;
  onOpen?: () => void;
}

const RECENT_PAGES_KEY = 'assetvault_recent_pages';

const DEFAULT_SUGGESTED: RecentPageItem[] = [
  { id: 'sug-1', type: 'page', title: 'Dashboard', subtitle: 'Executive overview & active alerts', url: '/' },
  { id: 'sug-2', type: 'asset', title: 'Digital Assets', subtitle: 'Hardware and software catalog', url: '/assets' },
  { id: 'sug-3', type: 'license', title: 'Software Licenses', subtitle: 'Contracts and seat allocations', url: '/licenses' },
  { id: 'sug-4', type: 'page', title: 'Compliance Hub', subtitle: 'Audit readiness score and breakdown', url: '/compliance' },
  { id: 'sug-5', type: 'vendor', title: 'Vendors', subtitle: 'Supplier directory and agreements', url: '/vendors' },
];

const getSafeStorage = (): Storage | null => {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    return window.sessionStorage;
  }
  if (typeof globalThis !== 'undefined' && (globalThis as any).sessionStorage) {
    return (globalThis as any).sessionStorage;
  }
  return null;
};

const getRecentPagesFromStorage = (): RecentPageItem[] => {
  const storage = getSafeStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(RECENT_PAGES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveRecentPageToStorage = (item: RecentPageItem) => {
  const storage = getSafeStorage();
  if (!storage) return;
  try {
    const existing = getRecentPagesFromStorage();
    const filtered = existing.filter((p) => p.url !== item.url);
    const updated = [
      {
        ...item,
        visitedAt: Date.now(),
      },
      ...filtered,
    ].slice(0, 8);
    storage.setItem(RECENT_PAGES_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage quota or security errors
  }
};

const clearRecentPagesFromStorage = () => {
  const storage = getSafeStorage();
  if (!storage) return;
  try {
    storage.removeItem(RECENT_PAGES_KEY);
  } catch {
    // Ignore storage quota or security errors
  }
};

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, onOpen }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isModalOpen = isOpen !== undefined ? isOpen : uncontrolledOpen;

  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [results, setResults] = useState<SearchResponse['results']>({
    assets: [],
    licenses: [],
    vendors: [],
    tags: [],
  });
  const [total, setTotal] = useState(0);
  const [recentPages, setRecentPages] = useState<RecentPageItem[]>(() => getRecentPagesFromStorage());

  const inputRef = useRef<HTMLInputElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  // Close handler with smooth scale-down and opacity exit transition
  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      if (onClose) {
        onClose();
      } else {
        setUncontrolledOpen(false);
      }
      setSearchTerm('');
    }, 150);
  }, [onClose]);

  // Track page visits from route changes into sessionStorage
  useEffect(() => {
    const storage = getSafeStorage();
    if (!storage) return;
    const path = location.pathname;
    if (!path || path === '/login' || path === '/register') return;

    const routeMetadata: Record<string, { title: string; subtitle: string; type: 'page' | 'asset' | 'license' | 'vendor' }> = {
      '/': { title: 'Dashboard', subtitle: 'Executive overview & active alerts', type: 'page' },
      '/assets': { title: 'Digital Assets', subtitle: 'Hardware and software catalog', type: 'asset' },
      '/licenses': { title: 'Software Licenses', subtitle: 'Contracts and seat allocations', type: 'license' },
      '/allocations': { title: 'Seat Allocations', subtitle: 'Employee license seat assignments', type: 'license' },
      '/compliance': { title: 'Compliance Hub', subtitle: 'Audit readiness score and breakdown', type: 'page' },
      '/reports': { title: 'Reports & Export', subtitle: 'PDF and CSV data generation', type: 'page' },
      '/vendors': { title: 'Vendors', subtitle: 'Supplier directory and agreements', type: 'vendor' },
      '/users': { title: 'User Management', subtitle: 'Tenant users, roles, and status', type: 'page' },
      '/audit-logs': { title: 'Audit Logs', subtitle: 'System event trail & security log', type: 'page' },
      '/settings': { title: 'Settings', subtitle: 'Workspace preferences & security', type: 'page' },
    };

    const info = routeMetadata[path];
    if (info) {
      saveRecentPageToStorage({
        id: `route-${path}`,
        title: info.title,
        subtitle: info.subtitle,
        url: path,
        type: info.type,
      });
    }
  }, [location.pathname]);

  // Reset state and load recent pages when opening
  useEffect(() => {
    if (isModalOpen) {
      setSearchTerm('');
      setResults({ assets: [], licenses: [], vendors: [], tags: [] });
      setTotal(0);
      setSelectedIndex(0);
      setIsClosing(false);
      setRecentPages(getRecentPagesFromStorage());
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isModalOpen]);

  // Global Cmd+K / Ctrl+K keyboard shortcut listener
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isModalOpen) {
          handleClose();
        } else if (isOpen === undefined) {
          setUncontrolledOpen(true);
        } else if (onOpen) {
          onOpen();
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isModalOpen, isOpen, onOpen, handleClose]);

  // Live debounced search (300ms) hitting GET /api/search?q=...
  useEffect(() => {
    if (!isModalOpen) return;
    const term = searchTerm.trim();
    if (term.length === 0) {
      setResults({ assets: [], licenses: [], vendors: [], tags: [] });
      setTotal(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    const debounceTimer = setTimeout(async () => {
      try {
        const res = await api.get<any>(`/search?q=${encodeURIComponent(term)}`);
        const searchPayload = res?.data || res;
        const assets = searchPayload?.results?.assets || [];
        const licenses = searchPayload?.results?.licenses || [];
        const vendors = searchPayload?.results?.vendors || [];
        const tags = searchPayload?.results?.tags || [];
        const totalCount =
          typeof searchPayload?.total === 'number'
            ? searchPayload.total
            : assets.length + licenses.length + vendors.length + tags.length;

        setResults({ assets, licenses, vendors, tags });
        setTotal(totalCount);
        setSelectedIndex(0);
      } catch {
        setResults({ assets: [], licenses: [], vendors: [], tags: [] });
        setTotal(0);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchTerm, isModalOpen]);

  const isQueryEmpty = searchTerm.trim().length === 0;

  // Flattened items for seamless keyboard navigation
  const flatItems = useMemo<SearchResultItem[]>(() => {
    if (isQueryEmpty) {
      return recentPages.length > 0 ? recentPages : DEFAULT_SUGGESTED;
    }
    return [
      ...(results?.assets || []),
      ...(results?.licenses || []),
      ...(results?.vendors || []),
      ...(results?.tags || []),
    ];
  }, [isQueryEmpty, recentPages, results]);

  // Keyboard navigation: ArrowUp, ArrowDown, Enter, and Escape
  useEffect(() => {
    if (!isModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setSearchTerm('');
        handleClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (flatItems.length > 0 ? (prev + 1) % flatItems.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (flatItems.length > 0 ? (prev - 1 + flatItems.length) % flatItems.length : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (flatItems[selectedIndex]) {
          const item = flatItems[selectedIndex];
          saveRecentPageToStorage(item);
          navigate(item.url);
          handleClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, flatItems, selectedIndex, navigate, handleClose]);

  // Keep active item scrolled into view
  useEffect(() => {
    const el = document.getElementById(`cp-item-${selectedIndex}`);
    if (el) {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isModalOpen && !isClosing) return null;

  // Render a result row with icon, title, subtitle, and type badge
  const renderResultRow = (item: SearchResultItem, itemIndex: number) => {
    const isSelected = itemIndex === selectedIndex;

    const iconMap = {
      asset: { icon: Package, style: 'text-sky-400 bg-sky-950/70 border-sky-800/40' },
      license: { icon: KeyRound, style: 'text-emerald-400 bg-emerald-950/70 border-emerald-800/40' },
      vendor: { icon: Building2, style: 'text-purple-400 bg-purple-950/70 border-purple-800/40' },
      tag: { icon: TagIcon, style: 'text-amber-400 bg-amber-950/70 border-amber-800/40' },
      page: { icon: Compass, style: 'text-indigo-400 bg-indigo-950/70 border-indigo-800/40' },
    };

    const iconEntry = iconMap[item.type] || iconMap.page;
    const IconComponent = iconEntry.icon;

    const badgeMap: Record<string, { variant: 'info' | 'success' | 'outline' | 'warning' | 'default'; label: string }> = {
      asset: { variant: 'info', label: 'Asset' },
      license: { variant: 'success', label: 'License' },
      vendor: { variant: 'outline', label: 'Vendor' },
      tag: { variant: 'warning', label: 'Tag' },
      page: { variant: 'default', label: isQueryEmpty && recentPages.length > 0 ? 'Recent' : 'Page' },
    };

    const badgeInfo = badgeMap[item.type] || { variant: 'default', label: item.type };

    return (
      <div
        key={`${item.type}-${item.id}`}
        id={`cp-item-${itemIndex}`}
        onClick={() => {
          saveRecentPageToStorage(item);
          navigate(item.url);
          handleClose();
        }}
        onMouseEnter={() => setSelectedIndex(itemIndex)}
        className={cn(
          'group flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer transition-all duration-150',
          isSelected
            ? 'bg-indigo-950/60 text-white border-l-4 border-l-[var(--av-color-primary,#6366f1)] shadow-sm'
            : 'hover:bg-slate-800/50 text-slate-300 border-l-4 border-l-transparent'
        )}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border', iconEntry.style)}>
            <IconComponent className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold truncate text-slate-100 group-hover:text-white">
              {item.title}
            </div>
            <div className="text-xs text-slate-400 truncate">
              {item.subtitle}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-3">
          {item.status && (
            <Badge
              variant={item.status === 'ACTIVE' ? 'success' : item.status === 'EXPIRED' ? 'danger' : 'outline'}
              size="sm"
            >
              {item.status}
            </Badge>
          )}
          <Badge variant={badgeInfo.variant} size="sm">
            {badgeInfo.label}
          </Badge>
          <span
            className={cn(
              'text-xs transition-opacity',
              isSelected ? 'opacity-100 text-indigo-300' : 'opacity-0'
            )}
          >
            <CornerDownLeft className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    );
  };

  let currentIndexTracker = 0;

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-start justify-center pt-[10vh] sm:pt-[14vh] px-4 bg-slate-950/75 backdrop-blur-md transition-opacity duration-200',
        isClosing ? 'opacity-0' : 'opacity-100 animate-spotlight-backdrop'
      )}
    >
      {/* Click outside backdrop layer */}
      <div
        className="fixed inset-0"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Centered Spotlight Modal (Max-width 600px) */}
      <div
        className={cn(
          'relative w-full max-w-[600px] bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh] z-10 transition-all duration-200',
          isClosing ? 'opacity-0 scale-95 -translate-y-2' : 'opacity-100 scale-100 translate-y-0 animate-spotlight-modal'
        )}
      >
        {/* Top Search Input Bar with Icon and Escape badge */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-800 gap-3 bg-slate-900/95 shrink-0">
          <Search className="w-5 h-5 text-[var(--av-color-primary,#6366f1)] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search assets, licenses, vendors, tags..."
            className="flex-1 bg-transparent border-0 outline-none text-slate-100 placeholder:text-slate-500 text-base font-normal tracking-wide"
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
          />

          {searchTerm && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                inputRef.current?.focus();
              }}
              aria-label="Clear search input"
              className="p-1 hover:bg-slate-800 rounded-md text-slate-400 hover:text-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 text-[11px] font-mono font-semibold text-slate-400 bg-slate-800 rounded border border-slate-700 select-none">
            ESC
          </kbd>
        </div>

        {/* Results Container */}
        <div
          ref={resultsContainerRef}
          className="flex-1 overflow-y-auto p-2.5 divide-y divide-slate-800/40 focus:outline-none"
        >
          {/* Loading Skeleton Placeholder (Debounced 300ms) */}
          {loading ? (
            <div className="p-3 space-y-2.5 animate-fade-in">
              <div className="px-2 py-1 flex items-center gap-2">
                <Skeleton className="w-4 h-4 rounded" />
                <Skeleton className="w-28 h-3.5 rounded" />
              </div>
              {[1, 2, 3, 4, 5].map((idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-800/40 border border-slate-800/60 animate-pulse"
                >
                  <div className="flex items-center gap-3 w-3/4">
                    <Skeleton variant="avatar" className="w-8 h-8 rounded-lg" />
                    <div className="space-y-1.5 flex-1">
                      <Skeleton className="w-2/5 h-3.5 rounded" />
                      <Skeleton className="w-3/5 h-2.5 rounded" />
                    </div>
                  </div>
                  <Skeleton className="w-16 h-5 rounded-full" />
                </div>
              ))}
            </div>
          ) : isQueryEmpty ? (
            /* Empty State: Shows Recent Pages Visited from sessionStorage */
            <div className="py-1">
              <div className="px-3.5 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <Clock className="w-3.5 h-3.5 text-[var(--av-color-primary,#6366f1)]" />
                  <span>{recentPages.length > 0 ? 'Recently Visited' : 'Suggested Quick Links'}</span>
                </div>
                {recentPages.length > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearRecentPagesFromStorage();
                      setRecentPages([]);
                      setSelectedIndex(0);
                    }}
                    className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                  >
                    Clear history
                  </button>
                )}
              </div>
              <div className="mt-1 space-y-1">
                {(recentPages.length > 0 ? recentPages : DEFAULT_SUGGESTED).map((item, idx) =>
                  renderResultRow(item, idx)
                )}
              </div>
            </div>
          ) : total === 0 ? (
            /* No Results Empty State */
            <div className="py-12 px-4 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-800/60 border border-slate-700/50 flex items-center justify-center mx-auto mb-3 text-slate-400">
                <Search className="w-5 h-5 text-slate-500" />
              </div>
              <p className="text-sm font-semibold text-slate-200">No results found for "{searchTerm}"</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                No matching assets, licenses, vendors, or tags found in your tenant workspace.
              </p>
            </div>
          ) : (
            /* Grouped Results Sections */
            <div className="space-y-3 py-1">
              {/* 1. Assets Group */}
              {results.assets.length > 0 && (
                <div className="space-y-1">
                  <div className="px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sky-400">
                      <Package className="w-4 h-4 text-sky-400" />
                      <span>Assets</span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-500">
                      {results.assets.length}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {results.assets.map((item) => {
                      const itemIdx = currentIndexTracker++;
                      return renderResultRow(item, itemIdx);
                    })}
                  </div>
                </div>
              )}

              {/* 2. Licenses Group */}
              {results.licenses.length > 0 && (
                <div className="space-y-1">
                  <div className="px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-400">
                      <KeyRound className="w-4 h-4 text-emerald-400" />
                      <span>Licenses</span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-500">
                      {results.licenses.length}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {results.licenses.map((item) => {
                      const itemIdx = currentIndexTracker++;
                      return renderResultRow(item, itemIdx);
                    })}
                  </div>
                </div>
              )}

              {/* 3. Vendors Group */}
              {results.vendors.length > 0 && (
                <div className="space-y-1">
                  <div className="px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider flex items-center justify-between">
                    <div className="flex items-center gap-2 text-purple-400">
                      <Building2 className="w-4 h-4 text-purple-400" />
                      <span>Vendors</span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-500">
                      {results.vendors.length}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {results.vendors.map((item) => {
                      const itemIdx = currentIndexTracker++;
                      return renderResultRow(item, itemIdx);
                    })}
                  </div>
                </div>
              )}

              {/* 4. Tags Group */}
              {results.tags.length > 0 && (
                <div className="space-y-1">
                  <div className="px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider flex items-center justify-between">
                    <div className="flex items-center gap-2 text-amber-400">
                      <TagIcon className="w-4 h-4 text-amber-400" />
                      <span>Tags</span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-500">
                      {results.tags.length}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {results.tags.map((item) => {
                      const itemIdx = currentIndexTracker++;
                      return renderResultRow(item, itemIdx);
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Shortcut Bar */}
        <div className="px-4 py-2.5 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 select-none shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-[10px] font-mono">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-[10px] font-mono">↓</kbd>
              <span className="text-[11px]">Navigate</span>
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-[10px] font-mono flex items-center gap-0.5">
                <CornerDownLeft className="w-2.5 h-2.5" />
              </kbd>
              <span className="text-[11px]">Open</span>
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-[10px] font-mono">ESC</kbd>
              <span className="text-[11px]">Close</span>
            </span>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">AssetVault Spotlight</span>
        </div>
      </div>
    </div>
  );
};
