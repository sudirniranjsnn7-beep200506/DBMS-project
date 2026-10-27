// ==============================================================================
// AssetVault: CommandPalette Spotlight Search Unit Test Suite
// ==============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { CommandPalette } from '../components/common/CommandPalette';

// Mock contexts and api
vi.mock('../services/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

const mockSessionStorage = (() => {
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

Object.defineProperty(globalThis, 'sessionStorage', {
  value: mockSessionStorage,
  writable: true,
});

const renderPalette = (props: React.ComponentProps<typeof CommandPalette>, initialEntries = ['/']) => {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={initialEntries}>
      <CommandPalette {...props} />
    </MemoryRouter>
  );
};

describe('CommandPalette Spotlight Search Suite', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  describe('1. Structure and Visibility', () => {
    it('returns null when isOpen is false', () => {
      const html = renderPalette({ isOpen: false, onClose: vi.fn() });
      expect(html).toBe('');
    });

    it('renders centered modal (max-width 600px) with backdrop blur when isOpen is true', () => {
      const html = renderPalette({ isOpen: true, onClose: vi.fn() });
      expect(html).toContain('backdrop-blur-md');
      expect(html).toContain('max-w-[600px]');
      expect(html).toContain('animate-spotlight-modal');
      expect(html).toContain('animate-spotlight-backdrop');
    });

    it('renders search input with placeholder, ESC kbd badge, and footer shortcuts', () => {
      const html = renderPalette({ isOpen: true, onClose: vi.fn() });
      expect(html).toContain('placeholder="Search assets, licenses, vendors, tags..."');
      expect(html).toContain('ESC');
      expect(html).toContain('AssetVault Spotlight');
      expect(html).toContain('Navigate');
      expect(html).toContain('Open');
    });
  });

  describe('2. Empty State and sessionStorage Integration', () => {
    it('renders suggested quick links when sessionStorage has no recent pages', () => {
      const html = renderPalette({ isOpen: true, onClose: vi.fn() });
      expect(html).toContain('Suggested Quick Links');
      expect(html).toContain('Dashboard');
      expect(html).toContain('Digital Assets');
      expect(html).toContain('Software Licenses');
      expect(html).toContain('Compliance Hub');
      expect(html).toContain('Vendors');
    });

    it('renders recently visited pages from sessionStorage when available', () => {
      const sampleRecent = [
        {
          id: 'test-recent-1',
          type: 'asset',
          title: 'MacBook Pro M3 Max',
          subtitle: 'AST-1001 • HARDWARE',
          url: '/assets/ast-1001',
          status: 'ACTIVE',
        },
        {
          id: 'test-recent-2',
          type: 'license',
          title: 'JetBrains All Products Pack',
          subtitle: 'JetBrains • 25 seats',
          url: '/licenses/lic-2002',
        },
      ];
      sessionStorage.setItem('assetvault_recent_pages', JSON.stringify(sampleRecent));

      const html = renderPalette({ isOpen: true, onClose: vi.fn() });
      expect(html).toContain('Recently Visited');
      expect(html).toContain('Clear history');
      expect(html).toContain('MacBook Pro M3 Max');
      expect(html).toContain('AST-1001 • HARDWARE');
      expect(html).toContain('JetBrains All Products Pack');
      expect(html).toContain('JetBrains • 25 seats');
      expect(html).toContain('Recent');
    });
  });

  describe('3. Badges and Visual Indicators', () => {
    it('renders type badges and status indicators for items', () => {
      const sampleWithBadges = [
        {
          id: 'b-1',
          type: 'asset',
          title: 'Dell UltraSharp 32',
          subtitle: 'AST-3001 • HARDWARE',
          url: '/assets/b-1',
          status: 'ACTIVE',
        },
      ];
      sessionStorage.setItem('assetvault_recent_pages', JSON.stringify(sampleWithBadges));

      const html = renderPalette({ isOpen: true, onClose: vi.fn() });
      expect(html).toContain('Dell UltraSharp 32');
      expect(html).toContain('ACTIVE');
      expect(html).toContain('Asset');
    });
  });
});
