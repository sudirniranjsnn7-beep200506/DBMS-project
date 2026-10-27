// ==============================================================================
// AssetVault Design System: Skeleton Component
// Animated shimmer placeholders for cards, table rows, and circular avatars
// ==============================================================================

import React, { forwardRef } from 'react';
import { cn } from '../../utils/cn';

export type SkeletonVariant = 'text' | 'card' | 'row' | 'avatar' | 'rect';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: SkeletonVariant;
  width?: string | number;
  height?: string | number;
}

export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, variant = 'rect', width, height, style, ...props }, ref) => {
    const inlineStyles: React.CSSProperties = {
      ...style,
      width: width !== undefined ? (typeof width === 'number' ? `${width}px` : width) : undefined,
      height: height !== undefined ? (typeof height === 'number' ? `${height}px` : height) : undefined,
    };

    if (variant === 'avatar') {
      return (
        <div
          ref={ref}
          style={inlineStyles}
          className={cn(
            'w-10 h-10 rounded-full bg-slate-800/80 animate-pulse shrink-0',
            className
          )}
          {...props}
        />
      );
    }

    if (variant === 'card') {
      return (
        <div
          ref={ref}
          style={inlineStyles}
          className={cn(
            'w-full p-5 rounded-[var(--av-radius-md,10px)] bg-slate-900 border border-[var(--av-color-border,#1e293b)] flex flex-col gap-3 animate-pulse',
            className
          )}
          {...props}
        >
          <div className="flex items-center justify-between">
            <div className="h-4 w-1/3 bg-slate-800 rounded-[var(--av-radius-sm,6px)]" />
            <div className="h-6 w-16 bg-slate-800 rounded-full" />
          </div>
          <div className="h-3 w-3/4 bg-slate-800/60 rounded-[var(--av-radius-sm,6px)]" />
          <div className="h-3 w-1/2 bg-slate-800/60 rounded-[var(--av-radius-sm,6px)] mt-2" />
        </div>
      );
    }

    if (variant === 'row') {
      return (
        <div
          ref={ref}
          style={inlineStyles}
          className={cn(
            'w-full h-12 flex items-center px-4 gap-4 bg-slate-900/50 border-b border-[var(--av-color-border,#1e293b)] animate-pulse',
            className
          )}
          {...props}
        >
          <div className="w-8 h-8 rounded-full bg-slate-800 shrink-0" />
          <div className="h-3.5 w-1/4 bg-slate-800 rounded-[var(--av-radius-sm,6px)]" />
          <div className="h-3.5 w-1/6 bg-slate-800/60 rounded-[var(--av-radius-sm,6px)]" />
          <div className="h-3.5 w-1/5 bg-slate-800/60 rounded-[var(--av-radius-sm,6px)] ml-auto" />
        </div>
      );
    }

    if (variant === 'text') {
      return (
        <div
          ref={ref}
          style={inlineStyles}
          className={cn(
            'h-4 w-full bg-slate-800/80 rounded-[var(--av-radius-sm,6px)] animate-pulse',
            className
          )}
          {...props}
        />
      );
    }

    // Default 'rect'
    return (
      <div
        ref={ref}
        style={inlineStyles}
        className={cn(
          'w-full h-24 bg-slate-800/80 rounded-[var(--av-radius-md,10px)] animate-pulse',
          className
        )}
        {...props}
      />
    );
  }
);

Skeleton.displayName = 'Skeleton';
