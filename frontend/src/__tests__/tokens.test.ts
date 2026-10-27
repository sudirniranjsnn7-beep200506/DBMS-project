// ==============================================================================
// AssetVault: Design System Tokens Unit & Verification Test Suite
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { describe, it, expect } from 'vitest';
import {
  tokens,
  colorTokens,
  typographyTokens,
  spacingTokens,
  radiusTokens,
  shadowTokens,
  noiseTokens,
  cssVarTokens,
} from '../styles/tokens';
import fs from 'fs';
import path from 'path';

describe('AssetVault Design System Tokens Suite', () => {
  describe('1. Dark-First Color Palette', () => {
    it('defines expected dark-first palette tokens', () => {
      expect(colorTokens.background).toBe('#020617'); // slate-950
      expect(colorTokens.card).toBe('#0f172a');       // slate-900
      expect(colorTokens.border).toBe('#1e293b');     // slate-800
      expect(colorTokens.primary).toBe('#6366f1');    // indigo-500
      expect(colorTokens.success).toBe('#10b981');    // emerald-500
      expect(colorTokens.warning).toBe('#f59e0b');    // amber-500
      expect(colorTokens.danger).toBe('#f43f5e');     // rose-500
    });

    it('contains full text hierarchy and accent hover states', () => {
      expect(colorTokens.text.primary).toBe('#f8fafc');
      expect(colorTokens.text.secondary).toBe('#94a3b8');
      expect(colorTokens.primaryHover).toBe('#4f46e5');
      expect(colorTokens.successHover).toBe('#059669');
      expect(colorTokens.warningHover).toBe('#d97706');
      expect(colorTokens.dangerHover).toBe('#e11d48');
    });
  });

  describe('2. Fluid Typography Scale', () => {
    it('covers fluid typography scale spanning 11px to 32px', () => {
      expect(typographyTokens.minPx).toBe(11);
      expect(typographyTokens.maxPx).toBe(32);

      expect(typographyTokens.scale.xs).toContain('clamp(');
      expect(typographyTokens.scale['3xl']).toContain('clamp(');
      expect(typographyTokens.fontFamily.sans).toContain('Inter');
      expect(typographyTokens.fontFamily.mono).toContain('JetBrains Mono');
    });
  });

  describe('3. Spacing Scale (4px Base Unit)', () => {
    it('follows 4px base unit scaling progression', () => {
      expect(spacingTokens.baseUnitPx).toBe(4);
      expect(spacingTokens[1]).toBe('4px');
      expect(spacingTokens[2]).toBe('8px');
      expect(spacingTokens[3]).toBe('12px');
      expect(spacingTokens[4]).toBe('16px');
      expect(spacingTokens[5]).toBe('20px');
      expect(spacingTokens[6]).toBe('24px');
      expect(spacingTokens[8]).toBe('32px');
      expect(spacingTokens[10]).toBe('40px');
      expect(spacingTokens[12]).toBe('48px');
      expect(spacingTokens[16]).toBe('64px');
    });
  });

  describe('4. Border-Radius Tokens', () => {
    it('provides exact requested radius tokens (sm: 6px, md: 10px, lg: 16px, xl: 24px)', () => {
      expect(radiusTokens.sm).toBe('6px');
      expect(radiusTokens.md).toBe('10px');
      expect(radiusTokens.lg).toBe('16px');
      expect(radiusTokens.xl).toBe('24px');
      expect(radiusTokens.full).toBe('9999px');
    });
  });

  describe('5. Box-Shadow Elevation Tokens', () => {
    it('provides card elevation levels 1 through 3', () => {
      expect(shadowTokens.elevation1).toBeDefined();
      expect(shadowTokens.elevation2).toBeDefined();
      expect(shadowTokens.elevation3).toBeDefined();

      expect(shadowTokens.elevation1).toContain('rgba(0, 0, 0,');
      expect(shadowTokens.elevation2).toContain('rgba(0, 0, 0,');
      expect(shadowTokens.elevation3).toContain('rgba(0, 0, 0,');
    });
  });

  describe('6. Subtle Noise Texture Overlay', () => {
    it('contains an SVG data URI noise filter', () => {
      expect(noiseTokens.svgDataUri).toContain('data:image/svg+xml');
      expect(noiseTokens.svgDataUri).toContain('feTurbulence');
      expect(noiseTokens.svgDataUri).toContain('fractalNoise');
    });
  });

  describe('7. CSS Custom Properties in tokens.css', () => {
    it('has tokens.css file with matching CSS variables', () => {
      const cssPath = path.resolve(__dirname, '../styles/tokens.css');
      expect(fs.existsSync(cssPath)).toBe(true);

      const cssContent = fs.readFileSync(cssPath, 'utf-8');
      expect(cssContent).toContain('--av-color-bg: #020617;');
      expect(cssContent).toContain('--av-color-card: #0f172a;');
      expect(cssContent).toContain('--av-color-border: #1e293b;');
      expect(cssContent).toContain('--av-color-primary: #6366f1;');
      expect(cssContent).toContain('--av-color-success: #10b981;');
      expect(cssContent).toContain('--av-color-warning: #f59e0b;');
      expect(cssContent).toContain('--av-color-danger: #f43f5e;');
      expect(cssContent).toContain('--av-radius-sm: 6px;');
      expect(cssContent).toContain('--av-radius-md: 10px;');
      expect(cssContent).toContain('--av-radius-lg: 16px;');
      expect(cssContent).toContain('--av-radius-xl: 24px;');
      expect(cssContent).toContain('--av-shadow-elevation-1:');
      expect(cssContent).toContain('--av-shadow-elevation-2:');
      expect(cssContent).toContain('--av-shadow-elevation-3:');
      expect(cssContent).toContain('--av-noise-overlay:');
    });

    it('exposes corresponding CSS variable references in TypeScript', () => {
      expect(cssVarTokens.colors.bg).toBe('var(--av-color-bg)');
      expect(cssVarTokens.colors.card).toBe('var(--av-color-card)');
      expect(cssVarTokens.borderRadius.md).toBe('var(--av-radius-md)');
      expect(cssVarTokens.boxShadow.elevation1).toBe('var(--av-shadow-elevation-1)');
      expect(cssVarTokens.noise).toBe('var(--av-noise-overlay)');
      expect(tokens.cssVars).toBe(cssVarTokens);
    });
  });
});
