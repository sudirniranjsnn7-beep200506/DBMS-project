// ==============================================================================
// AssetVault: Modern Layout Shell Unit Test Suite
// ==============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Navbar } from '../components/layout/Navbar';
import { Sidebar } from '../components/layout/Sidebar';
import { AppLayout } from '../components/layout/AppLayout';

// Mock contexts
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'usr-1',
      fullName: 'Alex Admin',
      email: 'alex@example.com',
      role: 'TENANT_ADMIN',
      isSuperAdmin: false,
    },
    tenant: { id: 't-1', name: 'TechCorp', status: 'ACTIVE' },
    hasPermission: () => true,
    hasRole: () => true,
    logout: vi.fn(),
  }),
}));

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: 'dark',
    toggleTheme: vi.fn(),
  }),
}));

vi.mock('../context/ToastContext', () => ({
  useToast: () => ({
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const renderWithProviders = (ui: React.ReactElement, initialEntries = ['/']) => {
  return renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
};

const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    clear: () => {
      store = {};
    },
    removeItem: (key: string) => {
      delete store[key];
    },
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

describe('AssetVault Modern Layout Shell Suite', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('1. Topbar (Navbar)', () => {
    it('renders with 56px height (h-14) and blurred glass background', () => {
      const html = renderWithProviders(<Navbar onMobileMenuToggle={vi.fn()} />);
      expect(html).toContain('h-14');
      expect(html).toContain('backdrop-blur-md');
    });

    it('renders dynamic breadcrumbs for nested routes', () => {
      const html = renderWithProviders(
        <Navbar onMobileMenuToggle={vi.fn()} />,
        ['/assets/1234567890abcdef']
      );
      expect(html).toContain('Digital Assets');
      expect(html).toContain('Details');
    });

    it('renders search trigger (Cmd+K), notification bell, and user avatar', () => {
      const html = renderWithProviders(<Navbar onMobileMenuToggle={vi.fn()} />);
      expect(html).toContain('⌘K');
      expect(html).toContain('Search workspace...');
      expect(html).toContain('aria-label="Notifications"');
      expect(html).toContain('Alex Admin');
    });
  });

  describe('2. Sidebar Shell', () => {
    it('renders 240px expanded state with grouped sections', () => {
      const html = renderWithProviders(
        <Sidebar
          isCollapsed={false}
          onToggleCollapse={vi.fn()}
          isMobileOpen={false}
          onMobileClose={vi.fn()}
        />
      );
      expect(html).toContain('w-[240px]');
      expect(html).toContain('Main');
      expect(html).toContain('Manage');
      expect(html).toContain('Settings');
      expect(html).toContain('Digital Assets');
      expect(html).toContain('Seat Allocations');
    });

    it('renders 64px collapsed state with tooltips', () => {
      const html = renderWithProviders(
        <Sidebar
          isCollapsed={true}
          onToggleCollapse={vi.fn()}
          isMobileOpen={false}
          onMobileClose={vi.fn()}
        />
      );
      expect(html).toContain('w-[64px]');
      expect(html).toContain('role="tooltip"');
    });

    it('highlights active route with indigo accent and left border', () => {
      const html = renderWithProviders(
        <Sidebar
          isCollapsed={false}
          onToggleCollapse={vi.fn()}
          isMobileOpen={false}
          onMobileClose={vi.fn()}
        />,
        ['/assets']
      );
      expect(html).toContain('border-l-4');
      expect(html).toContain('bg-indigo-950/60');
    });
  });

  describe('3. AppLayout Container', () => {
    it('renders max-1400px centered main content area', () => {
      const html = renderWithProviders(<AppLayout />);
      expect(html).toContain('max-w-[1400px]');
      expect(html).toContain('overflow-y-auto');
    });
  });
});
