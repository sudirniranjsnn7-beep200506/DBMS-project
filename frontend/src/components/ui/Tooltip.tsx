// ==============================================================================
// AssetVault Design System: Tooltip Component
// Pure CSS accessible hover tooltip (no external library required)
// ==============================================================================

import React, { forwardRef, useId } from 'react';
import { cn } from '../../utils/cn';

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'content'> {
  content: React.ReactNode;
  position?: TooltipPosition;
  delay?: 'none' | 'normal';
}

const positionStyles: Record<TooltipPosition, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

const arrowStyles: Record<TooltipPosition, string> = {
  top: 'top-full left-1/2 -translate-x-1/2 border-t-[var(--av-color-border,#1e293b)] border-x-transparent border-b-transparent border-t-4 border-x-4 border-b-0',
  bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-[var(--av-color-border,#1e293b)] border-x-transparent border-t-transparent border-b-4 border-x-4 border-t-0',
  left: 'left-full top-1/2 -translate-y-1/2 border-l-[var(--av-color-border,#1e293b)] border-y-transparent border-r-transparent border-l-4 border-y-4 border-r-0',
  right: 'right-full top-1/2 -translate-y-1/2 border-r-[var(--av-color-border,#1e293b)] border-y-transparent border-l-transparent border-r-4 border-y-4 border-l-0',
};

export const Tooltip = forwardRef<HTMLDivElement, TooltipProps>(
  (
    {
      className,
      content,
      position = 'top',
      children,
      ...props
    },
    ref
  ) => {
    const tooltipId = useId();

    if (!content) {
      return <>{children}</>;
    }

    return (
      <div
        ref={ref}
        className={cn('relative inline-flex items-center group', className)}
        aria-describedby={tooltipId}
        {...props}
      >
        {children}

        <div
          id={tooltipId}
          role="tooltip"
          className={cn(
            'absolute z-50 pointer-events-none whitespace-nowrap opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 group-focus-within:opacity-100 group-focus-within:scale-100 transition-all duration-150 ease-out',
            positionStyles[position]
          )}
        >
          <div className="relative px-2.5 py-1.5 text-[11px] font-medium leading-tight text-[var(--av-color-text-primary,#f8fafc)] bg-slate-900 border border-[var(--av-color-border,#1e293b)] rounded-[var(--av-radius-sm,6px)] shadow-[var(--av-shadow-elevation-2)] backdrop-blur-sm">
            {content}
            <div
              className={cn('absolute w-0 h-0', arrowStyles[position])}
              aria-hidden="true"
            />
          </div>
        </div>
      </div>
    );
  }
);

Tooltip.displayName = 'Tooltip';
