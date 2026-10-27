// ==============================================================================
// AssetVault Design System: Button Component
// ==============================================================================

import React, { forwardRef } from 'react';
import { cn } from '../../utils/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  loading?: boolean;
  loadingText?: string;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--av-color-primary,#6366f1)] hover:bg-[var(--av-color-primary-hover,#4f46e5)] text-white shadow-sm hover:shadow active:scale-[0.98]',
  secondary:
    'bg-[var(--av-color-card,#0f172a)] hover:bg-[var(--av-color-card-hover,#1e293b)] text-[var(--av-color-text-primary,#f8fafc)] border border-[var(--av-color-border,#1e293b)] hover:border-[var(--av-color-border-subtle,#334155)] shadow-sm active:scale-[0.98]',
  ghost:
    'bg-transparent hover:bg-slate-800/50 text-[var(--av-color-text-secondary,#94a3b8)] hover:text-[var(--av-color-text-primary,#f8fafc)] active:scale-[0.98]',
  danger:
    'bg-[var(--av-color-danger,#f43f5e)] hover:bg-[var(--av-color-danger-hover,#e11d48)] text-white shadow-sm hover:shadow active:scale-[0.98]',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'text-xs px-2.5 py-1.5 rounded-[var(--av-radius-sm,6px)] gap-1.5 min-h-[32px]',
  md: 'text-sm px-4 py-2 rounded-[var(--av-radius-md,10px)] gap-2 min-h-[40px]',
  lg: 'text-base px-5 py-2.5 rounded-[var(--av-radius-md,10px)] gap-2.5 min-h-[48px]',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      loading = false,
      loadingText,
      iconLeft,
      iconRight,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const isSpinning = isLoading || loading;
    const isDisabled = disabled || isSpinning;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          'inline-flex items-center justify-center font-medium transition-all duration-150 select-none focus:outline-none focus:ring-2 focus:ring-[var(--av-color-primary,#6366f1)] focus:ring-offset-2 focus:ring-offset-[var(--av-color-bg,#020617)] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 disabled:shadow-none',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {isSpinning ? (
          <>
            <svg
              className="animate-spin -ml-0.5 h-3.5 w-3.5 text-current shrink-0"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>{loadingText || children}</span>
          </>
        ) : (
          <>
            {iconLeft && <span className="shrink-0">{iconLeft}</span>}
            <span>{children}</span>
            {iconRight && <span className="shrink-0">{iconRight}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
