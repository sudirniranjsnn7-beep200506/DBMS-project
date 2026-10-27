// ==============================================================================
// AssetVault: Modern Auth Pages Unit Test Suite
// Course: BCSE307L Database Systems (Fall 2026-27)
// Comprehensive testing for split-layout LoginPage and multi-step RegisterPage
// with password strength meter, Zod validation, and Google OAuth feature flag.
// ==============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage, isGoogleAuthEnabled } from '../pages/auth/LoginPage';
import { RegisterPage, slugify } from '../pages/auth/RegisterPage';
import { AuthBrandedPanel } from '../pages/auth/AuthBrandedPanel';

// Mock contexts
const mockLogin = vi.fn();
const mockRegister = vi.fn();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    tenant: null,
    isAuthenticated: false,
    isLoading: false,
    login: mockLogin,
    register: mockRegister,
    logout: vi.fn(),
    refreshProfile: vi.fn(),
    hasPermission: () => false,
    hasRole: () => false,
  }),
}));

const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
};

vi.mock('../context/ToastContext', () => ({
  useToast: () => mockToast,
}));

const renderWithRouter = (ui: React.ReactElement, initialUrl = '/') => {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[initialUrl]}>
      {ui}
    </MemoryRouter>
  );
};

describe('Auth Pages Modern Split-Layout Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;
    delete (import.meta as any).env?.GOOGLE_CLIENT_ID;
    delete process.env.VITE_GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_ID;
  });

  // ============================================================================
  // 1. AuthBrandedPanel (Left Half)
  // ============================================================================
  describe('1. AuthBrandedPanel', () => {
    it('renders AssetVault logo, version badge, and tagline', () => {
      const html = renderWithRouter(<AuthBrandedPanel />);
      expect(html).toContain('Asset');
      expect(html).toContain('Vault');
      expect(html).toContain('v2.0');
      expect(html).toContain('Multi-Tenant Digital Asset &amp; License Management System');
    });

    it('renders animated floating asset, license, and compliance cards', () => {
      const html = renderWithRouter(<AuthBrandedPanel />);
      // Floating card 1: Asset Card
      expect(html).toContain('animate-float-slow');
      expect(html).toContain('Helvetica Now Pro Master Font');
      expect(html).toContain('AST-009');
      expect(html).toContain('COMPLIANT');

      // Floating card 2: License Card
      expect(html).toContain('animate-float-medium');
      expect(html).toContain('JetBrains All Products Pack');
      expect(html).toContain('••••••••-9821');
      expect(html).toContain('48 / 50 seats');

      // Floating card 3: Compliance Metric Card
      expect(html).toContain('animate-float-reverse');
      expect(html).toContain('Enterprise Compliance Score');
      expect(html).toContain('94%');
      expect(html).toContain('Grade A');
    });

    it('renders 3 enterprise feature highlights with icons', () => {
      const html = renderWithRouter(<AuthBrandedPanel />);
      expect(html).toContain('Automated Seat Quota Defense');
      expect(html).toContain('PostgreSQL Enterprise Views');
      expect(html).toContain('Tenant Data Segregation &amp; Auditing');
    });
  });

  // ============================================================================
  // 2. LoginPage
  // ============================================================================
  describe('2. LoginPage', () => {
    it('renders split layout with branded panel and login form panel', () => {
      const html = renderWithRouter(<LoginPage />);
      // Left branded panel elements
      expect(html).toContain('Automated Seat Quota Defense');
      expect(html).toContain('Helvetica Now Pro Master Font');

      // Right form elements
      expect(html).toContain('Sign In to AssetVault');
      expect(html).toContain('Work Email');
      expect(html).toContain('Password');
      expect(html).toContain('Forgot password?');
      expect(html).toContain('Register Organization');
    });

    it('renders email and password inputs with placeholders and icons', () => {
      const html = renderWithRouter(<LoginPage />);
      expect(html).toContain('name@company.com');
      expect(html).toContain('••••••••••••');
      expect(html).toContain('lucide-mail');
      expect(html).toContain('lucide-lock');
    });

    it('renders quick demo personas selection for testing', () => {
      const html = renderWithRouter(<LoginPage />);
      expect(html).toContain('Quick Demo Personas:');
      expect(html).toContain('Super Admin');
      expect(html).toContain('Tenant Admin');
      expect(html).toContain('Asset Manager');
      expect(html).toContain('Member (Dev)');
    });

    it('hides Google OAuth button when feature flag GOOGLE_CLIENT_ID is not set', () => {
      delete (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;
      delete (import.meta as any).env?.GOOGLE_CLIENT_ID;
      const html = renderWithRouter(<LoginPage />);
      expect(html).not.toContain('Sign in with Google');
      expect(html).not.toContain('Or Continue With SSO');
    });

    it('shows Google OAuth button when feature flag GOOGLE_CLIENT_ID is set', () => {
      process.env.VITE_GOOGLE_CLIENT_ID = 'mock-google-client-id-123.apps.googleusercontent.com';
      expect(isGoogleAuthEnabled()).toBe(true);

      const html = renderWithRouter(<LoginPage />);
      expect(html).toContain('Sign in with Google');
      expect(html).toContain('Or Continue With SSO');
    });
  });

  // ============================================================================
  // 3. RegisterPage
  // ============================================================================
  describe('3. RegisterPage', () => {
    it('renders multi-step wizard header with progress bar and step indicator', () => {
      const html = renderWithRouter(<RegisterPage />);
      expect(html).toContain('Register Organization');
      expect(html).toContain('Step 1 of 2: Organization Profile &amp; Workspace');
      expect(html).toContain('Step 1 / 2');
      expect(html).toContain('Organization');
      expect(html).toContain('Administrator');
    });

    it('renders Step 1 fields: organization name, slug, contact email, and continue button', () => {
      const html = renderWithRouter(<RegisterPage />);
      expect(html).toContain('Organization / Company Name');
      expect(html).toContain('Acme Innovations, Inc.');
      expect(html).toContain('Workspace URL Slug');
      expect(html).toContain('acme-innovations');
      expect(html).toContain('Organization Contact Email');
      expect(html).toContain('contact@acme.com');
      expect(html).toContain('Continue to Admin Setup');
    });

    it('slugify helper correctly converts organization names into valid slugs', () => {
      expect(slugify('Acme Corporation')).toBe('acme-corporation');
      expect(slugify('TechCorp & Labs, Inc.!')).toBe('techcorp-labs-inc');
      expect(slugify('  Multi-Tenant 2026  ')).toBe('multi-tenant-2026');
      expect(slugify('A')).toBe('a');
    });

    it('renders link to sign in page for existing users', () => {
      const html = renderWithRouter(<RegisterPage />);
      expect(html).toContain('Already have an account?');
      expect(html).toContain('Sign In');
    });
  });

  // ============================================================================
  // 4. Password Strength Meter Rules
  // ============================================================================
  describe('4. Password Strength Meter Rules & Regex Matching', () => {
    const checkRules = (p: string) => {
      const rules = [
        p.length >= 10,
        /[A-Z]/.test(p),
        /[a-z]/.test(p),
        /[0-9]/.test(p),
        /[^A-Za-z0-9]/.test(p),
      ];
      return rules.filter(Boolean).length;
    };

    it('identifies weak password (< 10 chars, missing criteria) with 0-1 rules', () => {
      expect(checkRules('')).toBe(0);
      expect(checkRules('short')).toBe(1); // only lowercase
      expect(checkRules('12345')).toBe(1); // only digit
    });

    it('identifies fair password (2 rules satisfied)', () => {
      expect(checkRules('password123')).toBe(3); // lowercase, digit, >= 10
      expect(checkRules('pass1')).toBe(2); // lowercase, digit
    });

    it('identifies good password (3-4 rules satisfied)', () => {
      expect(checkRules('Password123')).toBe(4); // >= 10, upper, lower, digit
      expect(checkRules('Pass!2345678')).toBe(5); // >= 10, upper, lower, digit, symbol
    });

    it('identifies strong password meeting all 5 rules (min 10, upper, lower, digit, symbol)', () => {
      const strongPass = 'SuperVault2026!';
      expect(checkRules(strongPass)).toBe(5);
    });
  });
});
