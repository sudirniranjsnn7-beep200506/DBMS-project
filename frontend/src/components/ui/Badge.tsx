// ==============================================================================
// AssetVault Design System: Badge Component
// ==============================================================================

import React, { forwardRef } from 'react';
import { cn } from '../../utils/cn';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
}

const variantStyles: Record<BadgeVariant, { badge: string; dot: string }> = {
  default: {
    badge: 'bg-slate-800 text-[var(--av-color-text-secondary,#94a3b8)] border border-[var(--av-color-border,#1e293b)]',
    dot: 'bg-slate-400',
  },
  success: {
    badge: 'bg-emerald-950/50 text-[var(--av-color-success,#10b981)] border border-emerald-800/40',
    dot: 'bg-[var(--av-color-success,#10b981)]',
  },
  warning: {
    badge: 'bg-amber-950/50 text-[var(--av-color-warning,#f59e0b)] border border-amber-800/40',
    dot: 'bg-[var(--av-color-warning,#f59e0b)]',
  },
  danger: {
    badge: 'bg-rose-950/50 text-[var(--av-color-danger,#f43f5e)] border border-rose-800/40',
    dot: 'bg-[var(--av-color-danger,#f43f5e)]',
  },
  info: {
    badge: 'bg-indigo-950/50 text-[var(--av-color-primary-light,#818cf8)] border border-indigo-800/40',
    dot: 'bg-[var(--av-color-primary,#6366f1)]',
  },
  outline: {
    badge: 'bg-transparent text-[var(--av-color-text-secondary,#94a3b8)] border border-[var(--av-color-border-subtle,#334155)]',
    dot: 'bg-[var(--av-color-text-muted,#64748b)]',
  },
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'text-[11px] px-2 py-0.5 gap-1.5 min-h-[20px]',
  md: 'text-xs px-2.5 py-1 gap-1.5 min-h-[24px]',
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      className,
      variant = 'default',
      size = 'md',
      dot = false,
      children,
      ...props
    },
    ref
  ) => {
    const { badge: badgeStyle, dot: dotStyle } = variantStyles[variant];

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center font-medium rounded-full select-none leading-none tracking-wide transition-colors',
          badgeStyle,
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {dot && (
          <span
            className={cn('w-1.5 h-1.5 rounded-full shrink-0 animate-pulse', dotStyle)}
            aria-hidden="true"
          />
        )}
        <span>{children}</span>
      </span>
    );
  }
);

Badge.displayName = 'Badge';
