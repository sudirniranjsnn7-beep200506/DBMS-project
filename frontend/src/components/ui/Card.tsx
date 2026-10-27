// ==============================================================================
// AssetVault Design System: Card Component
// Base card with header, body, footer slots, hover elevation & glass-morphism
// ==============================================================================

import React, { forwardRef } from 'react';
import { cn } from '../../utils/cn';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverElevation?: boolean;
  glass?: boolean;
  variant?: 'default' | 'glass';
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className,
      hoverElevation = false,
      glass = false,
      variant = 'default',
      children,
      ...props
    },
    ref
  ) => {
    const isGlass = glass || variant === 'glass';

    return (
      <div
        ref={ref}
        className={cn(
          'rounded-[var(--av-radius-md,10px)] border transition-all duration-200 overflow-hidden',
          isGlass
            ? 'bg-slate-900/60 backdrop-blur-md border-slate-700/50 shadow-[var(--av-shadow-elevation-2)]'
            : 'bg-[var(--av-color-card,#0f172a)] border-[var(--av-color-border,#1e293b)] shadow-[var(--av-shadow-elevation-1)]',
          hoverElevation &&
            'hover:-translate-y-0.5 hover:shadow-[var(--av-shadow-elevation-2)] hover:border-[var(--av-color-border-subtle,#334155)] cursor-pointer',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  action?: React.ReactNode;
}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, action, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center justify-between px-5 py-4 border-b border-[var(--av-color-border,#1e293b)]',
          className
        )}
        {...props}
      >
        <div className="space-y-0.5 flex-1">{children}</div>
        {action && <div className="shrink-0 ml-4">{action}</div>}
      </div>
    );
  }
);

CardHeader.displayName = 'CardHeader';

export interface CardBodyProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardBody = forwardRef<HTMLDivElement, CardBodyProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('p-5', className)} {...props}>
        {children}
      </div>
    );
  }
);

CardBody.displayName = 'CardBody';

// Alias for flexibility
export const CardContent = CardBody;

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center justify-between px-5 py-3.5 bg-slate-950/30 border-t border-[var(--av-color-border,#1e293b)] text-xs text-[var(--av-color-text-secondary,#94a3b8)]',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardFooter.displayName = 'CardFooter';
