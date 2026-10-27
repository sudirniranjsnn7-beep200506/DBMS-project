// ==============================================================================
// AssetVault: Modern NotificationPanel Unit Test Suite
// Requirements:
// - Opens as a right-side drawer overlay (not a full page navigation)
// - Tabs: All, Unread, Expiring, System
// - Each notification row: colored type icon (rose for EXPIRED, amber for EXPIRY_7/15, blue for EXPIRY_30),
//   message text, license name chip, relative timestamp, unread dot indicator
// - Click to mark as read (optimistic update), "Mark all as read" button in header
// - SSE real-time updates: connect to GET /api/notifications/stream on panel open,
//   append new notifications to the top with a slide-down animation, update unread count badge
// - Pull-to-refresh on mobile
// - Empty state: animated bell icon with "You're all caught up"
// ==============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  NotificationPanel,
  formatRelativeTime,
  getNotificationTypeMeta,
} from '../components/notifications/NotificationPanel';
import { Notification } from '../types';

// Mock Toast Context
vi.mock('../context/ToastContext', () => ({
  useToast: () => ({
    toast: {
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warning: vi.fn(),
    },
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}));

// Mock NotificationStreamClient
const mockStreamStart = vi.fn();
const mockStreamStop = vi.fn();

vi.mock('../services/notificationStream', () => {
  return {
    NotificationStreamClient: vi.fn().mockImplementation(() => ({
      start: mockStreamStart,
      stop: mockStreamStop,
      isStopped: vi.fn().mockReturnValue(false),
    })),
  };
});

const mockNotifications: Notification[] = [
  {
    id: 'notif-exp-01',
    tenantId: 't-1',
    type: 'EXPIRED',
    title: 'Autodesk AutoCAD Enterprise',
    message: 'The enterprise subscription license for Autodesk AutoCAD has expired.',
    isRead: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(), // 2 hours ago
    license: { id: 'lic-1', name: 'Autodesk AutoCAD Enterprise' },
  } as any,
  {
    id: 'notif-exp-07',
    tenantId: 't-1',
    type: 'EXPIRY_7',
    title: 'JetBrains All Products Pack',
    message: 'Contract expires in 7 days. Action required to prevent seat revocation.',
    isRead: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(), // Yesterday
    license: { id: 'lic-2', name: 'JetBrains All Products Pack' },
  } as any,
  {
    id: 'notif-exp-30',
    tenantId: 't-1',
    type: 'EXPIRY_30',
    title: 'Figma Organization Workspace',
    message: 'Annual agreement is up for renewal within 30 days. Budget review recommended.',
    isRead: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(), // 3d ago
    license: { id: 'lic-3', name: 'Figma Organization Workspace' },
  } as any,
  {
    id: 'notif-sys-01',
    tenantId: 't-1',
    type: 'SYSTEM',
    title: 'Scheduled Database Maintenance',
    message: 'PostgreSQL database connection pool optimization scheduled tonight at 02:00 UTC.',
    isRead: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15m ago
  },
];

// Mock API
vi.mock('../services/api', () => ({
  api: {
    get: vi.fn((url: string) => {
      if (url === '/notifications') {
        return Promise.resolve({
          data: mockNotifications,
          meta: { total: 4 },
        });
      }
      return Promise.resolve({ data: [] });
    }),
    patch: vi.fn().mockResolvedValue({ data: { success: true } }),
    post: vi.fn().mockResolvedValue({ data: { success: true } }),
  },
}));

function createTestQueryClient(notifs: Notification[] = mockNotifications) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
    },
  });

  queryClient.setQueryData(['notifications'], {
    data: notifs,
  });

  return queryClient;
}

describe('NotificationPanel Slide-Over Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. formatRelativeTime produces human-friendly relative timestamps', () => {
    const now = Date.now();
    expect(formatRelativeTime(null)).toBe('Just now');
    expect(formatRelativeTime(undefined)).toBe('Just now');
    expect(formatRelativeTime('invalid-date')).toBe('Just now');

    expect(formatRelativeTime(new Date(now - 1000 * 30).toISOString())).toBe('Just now');
    expect(formatRelativeTime(new Date(now - 1000 * 60 * 5).toISOString())).toBe('5m ago');
    expect(formatRelativeTime(new Date(now - 1000 * 60 * 120).toISOString())).toBe('2h ago');
    expect(formatRelativeTime(new Date(now - 1000 * 60 * 60 * 26).toISOString())).toBe('Yesterday');
    expect(formatRelativeTime(new Date(now - 1000 * 60 * 60 * 24 * 3).toISOString())).toBe('3d ago');
    expect(formatRelativeTime(new Date(now - 1000 * 60 * 60 * 24 * 14).toISOString())).toBe('2w ago');
  });

  it('2. getNotificationTypeMeta maps required colors: rose for EXPIRED, amber for EXPIRY_7/15, blue for EXPIRY_30', () => {
    const expiredMeta = getNotificationTypeMeta('EXPIRED');
    expect(expiredMeta.badgeClass).toContain('rose');

    const expiry7Meta = getNotificationTypeMeta('EXPIRY_7');
    expect(expiry7Meta.badgeClass).toContain('amber');

    const expiry15Meta = getNotificationTypeMeta('EXPIRY_15');
    expect(expiry15Meta.badgeClass).toContain('amber');

    const expiry30Meta = getNotificationTypeMeta('EXPIRY_30');
    expect(expiry30Meta.badgeClass).toContain('blue');

    const systemMeta = getNotificationTypeMeta('SYSTEM');
    expect(systemMeta.badgeClass).toContain('indigo');
  });

  it('3. does not render drawer overlay when isOpen is false', () => {
    const qc = createTestQueryClient();
    const html = renderToStaticMarkup(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <NotificationPanel isOpen={false} onClose={vi.fn()} />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(html).toBe('');
  });

  it('4. renders right-side drawer overlay with header, tabs, and unread count when isOpen is true', () => {
    const qc = createTestQueryClient();
    const html = renderToStaticMarkup(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <NotificationPanel isOpen={true} onClose={vi.fn()} />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(html).toContain('data-testid="notification-panel"');
    expect(html).toContain('Notifications');
    expect(html).toContain('2 New'); // 2 unread notifications
    expect(html).toContain('Mark all as read');
    expect(html).toContain('aria-label="Close notification panel"');

    // All 4 tabs rendered
    expect(html).toContain('All');
    expect(html).toContain('Unread');
    expect(html).toContain('Expiring');
    expect(html).toContain('System');
  });

  it('5. renders each notification row with colored icon, message, license name chip, relative timestamp, and unread dot', () => {
    const qc = createTestQueryClient();
    const html = renderToStaticMarkup(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <NotificationPanel isOpen={true} onClose={vi.fn()} />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Rose icon for EXPIRED
    expect(html).toContain('text-rose-400');
    expect(html).toContain('Autodesk AutoCAD Enterprise');
    expect(html).toContain('The enterprise subscription license for Autodesk AutoCAD has expired.');

    // Amber icon for EXPIRY_7
    expect(html).toContain('text-amber-400');
    expect(html).toContain('JetBrains All Products Pack');

    // Blue icon for EXPIRY_30
    expect(html).toContain('text-blue-400');
    expect(html).toContain('Figma Organization Workspace');

    // License name chip
    expect(html).toContain('Autodesk AutoCAD Enterprise');
    expect(html).toContain('JetBrains All Products Pack');
    expect(html).toContain('Figma Organization Workspace');

    // Relative timestamps
    expect(html).toContain('2h ago');
    expect(html).toContain('Yesterday');
    expect(html).toContain('3d ago');

    // Unread pulse dot
    expect(html).toContain('title="Unread alert"');
  });

  it('6. renders empty state with animated bell icon and "You\'re all caught up" when no notifications exist', () => {
    const emptyQc = createTestQueryClient([]);
    const html = renderToStaticMarkup(
      <QueryClientProvider client={emptyQc}>
        <MemoryRouter>
          <NotificationPanel isOpen={true} onClose={vi.fn()} />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(html).toContain('You&#x27;re all caught up');
    expect(html).toContain('animate-bounce');
  });
});
