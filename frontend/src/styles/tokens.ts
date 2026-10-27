// ==============================================================================
// AssetVault: Modern Design System Tokens (TypeScript)
// Course: BCSE307L Database Systems (Fall 2026-27)
// Provides strongly-typed tokens and CSS custom property references for React components
// ==============================================================================

export const colorTokens = {
  // Dark-first Core Theme Palette
  background: '#020617', // slate-950
  card: '#0f172a',       // slate-900
  cardHover: '#1e293b',  // slate-800
  border: '#1e293b',     // slate-800
  borderSubtle: '#334155', // slate-700
  primary: '#6366f1',    // indigo-500
  primaryHover: '#4f46e5', // indigo-600
  primaryLight: '#818cf8', // indigo-400
  success: '#10b981',    // emerald-500
  successHover: '#059669', // emerald-600
  warning: '#f59e0b',    // amber-500
  warningHover: '#d97706', // amber-600
  danger: '#f43f5e',     // rose-500
  dangerHover: '#e11d48', // rose-600

  // Text Hierarchy
  text: {
    primary: '#f8fafc',   // slate-50
    secondary: '#94a3b8', // slate-400
    muted: '#64748b',     // slate-500
  },

  // Extended Slate Palette
  slate: {
    950: '#020617',
    900: '#0f172a',
    800: '#1e293b',
    700: '#334155',
    600: '#475569',
    500: '#64748b',
    400: '#94a3b8',
    300: '#cbd5e1',
    200: '#e2e8f0',
    100: '#f1f5f9',
    50: '#f8fafc',
  },

  // Accent Scales
  indigo: {
    400: '#818cf8',
    500: '#6366f1',
    600: '#4f46e5',
  },
  emerald: {
    500: '#10b981',
    600: '#059669',
  },
  amber: {
    500: '#f59e0b',
    600: '#d97706',
  },
  rose: {
    500: '#f43f5e',
    600: '#e11d48',
  },
} as const;

export const typographyTokens = {
  // Fluid Typography Scale (11px to 32px)
  scale: {
    xs: 'clamp(0.6875rem, 0.65rem + 0.15vw, 0.75rem)',   // 11px - 12px
    sm: 'clamp(0.75rem, 0.72rem + 0.2vw, 0.875rem)',     // 12px - 14px
    base: 'clamp(0.875rem, 0.85rem + 0.25vw, 1rem)',     // 14px - 16px
    lg: 'clamp(1rem, 0.95rem + 0.35vw, 1.125rem)',       // 16px - 18px
    xl: 'clamp(1.125rem, 1.05rem + 0.5vw, 1.25rem)',     // 18px - 20px
    '2xl': 'clamp(1.25rem, 1.15rem + 0.75vw, 1.5rem)',   // 20px - 24px
    '3xl': 'clamp(1.5rem, 1.35rem + 1.25vw, 2rem)',      // 24px - 32px
  },
  minPx: 11,
  maxPx: 32,
  fontFamily: {
    sans: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
} as const;

export const spacingTokens = {
  baseUnitPx: 4,
  1: '4px',    // 0.25rem
  2: '8px',    // 0.5rem
  3: '12px',   // 0.75rem
  4: '16px',   // 1rem
  5: '20px',   // 1.25rem
  6: '24px',   // 1.5rem
  8: '32px',   // 2rem
  10: '40px',  // 2.5rem
  12: '48px',  // 3rem
  16: '64px',  // 4rem
} as const;

export const radiusTokens = {
  sm: '6px',
  md: '10px',
  lg: '16px',
  xl: '24px',
  full: '9999px',
} as const;

export const shadowTokens = {
  elevation1: '0 1px 3px 0 rgba(0, 0, 0, 0.4), 0 1px 2px -1px rgba(0, 0, 0, 0.4)',
  elevation2: '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -2px rgba(0, 0, 0, 0.5)',
  elevation3: '0 10px 15px -3px rgba(0, 0, 0, 0.6), 0 4px 6px -4px rgba(0, 0, 0, 0.6)',
} as const;

export const noiseTokens = {
  svgDataUri: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.035'/%3E%3C/svg%3E\")",
} as const;

/**
 * CSS Custom Property Variable Name References
 */
export const cssVarTokens = {
  colors: {
    bg: 'var(--av-color-bg)',
    card: 'var(--av-color-card)',
    cardHover: 'var(--av-color-card-hover)',
    border: 'var(--av-color-border)',
    borderSubtle: 'var(--av-color-border-subtle)',
    primary: 'var(--av-color-primary)',
    primaryHover: 'var(--av-color-primary-hover)',
    primaryLight: 'var(--av-color-primary-light)',
    success: 'var(--av-color-success)',
    successHover: 'var(--av-color-success-hover)',
    warning: 'var(--av-color-warning)',
    warningHover: 'var(--av-color-warning-hover)',
    danger: 'var(--av-color-danger)',
    dangerHover: 'var(--av-color-danger-hover)',
    textPrimary: 'var(--av-color-text-primary)',
    textSecondary: 'var(--av-color-text-secondary)',
    textMuted: 'var(--av-color-text-muted)',
  },
  typography: {
    xs: 'var(--av-text-xs)',
    sm: 'var(--av-text-sm)',
    base: 'var(--av-text-base)',
    lg: 'var(--av-text-lg)',
    xl: 'var(--av-text-xl)',
    '2xl': 'var(--av-text-2xl)',
    '3xl': 'var(--av-text-3xl)',
    fontSans: 'var(--av-font-sans)',
    fontMono: 'var(--av-font-mono)',
  },
  spacing: {
    1: 'var(--av-space-1)',
    2: 'var(--av-space-2)',
    3: 'var(--av-space-3)',
    4: 'var(--av-space-4)',
    5: 'var(--av-space-5)',
    6: 'var(--av-space-6)',
    8: 'var(--av-space-8)',
    10: 'var(--av-space-10)',
    12: 'var(--av-space-12)',
    16: 'var(--av-space-16)',
  },
  borderRadius: {
    sm: 'var(--av-radius-sm)',
    md: 'var(--av-radius-md)',
    lg: 'var(--av-radius-lg)',
    xl: 'var(--av-radius-xl)',
    full: 'var(--av-radius-full)',
  },
  boxShadow: {
    elevation1: 'var(--av-shadow-elevation-1)',
    elevation2: 'var(--av-shadow-elevation-2)',
    elevation3: 'var(--av-shadow-elevation-3)',
  },
  noise: 'var(--av-noise-overlay)',
} as const;

/**
 * Unified Design System Tokens Object
 */
export const tokens = {
  colors: colorTokens,
  typography: typographyTokens,
  spacing: spacingTokens,
  borderRadius: radiusTokens,
  boxShadow: shadowTokens,
  noise: noiseTokens,
  cssVars: cssVarTokens,
} as const;

export type DesignTokens = typeof tokens;
export type ColorTokens = typeof colorTokens;
export type TypographyTokens = typeof typographyTokens;
export type SpacingTokens = typeof spacingTokens;
export type RadiusTokens = typeof radiusTokens;
export type ShadowTokens = typeof shadowTokens;

export default tokens;
