// ==============================================================================
// AssetVault Design System: Avatar Component
// Circular avatar with image, initials fallback & status indicator dot
// ==============================================================================

import React, { forwardRef, useState } from 'react';
import { cn } from '../../utils/cn';

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';
export type AvatarStatus = 'online' | 'offline' | 'busy' | 'away';

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  alt?: string;
  name?: string;
  initials?: string;
  size?: AvatarSize;
  status?: AvatarStatus;
  isOnline?: boolean;
}

const sizeStyles: Record<AvatarSize, { container: string; text: string; dot: string }> = {
  sm: {
    container: 'w-7 h-7',
    text: 'text-[11px]',
    dot: 'w-2 h-2 ring-1',
  },
  md: {
    container: 'w-9 h-9',
    text: 'text-xs',
    dot: 'w-2.5 h-2.5 ring-2',
  },
  lg: {
    container: 'w-11 h-11',
    text: 'text-sm font-semibold',
    dot: 'w-3 h-3 ring-2',
  },
  xl: {
    container: 'w-14 h-14',
    text: 'text-base font-bold',
    dot: 'w-3.5 h-3.5 ring-2',
  },
};

const statusStyles: Record<AvatarStatus, string> = {
  online: 'bg-[var(--av-color-success,#10b981)]',
  offline: 'bg-slate-500',
  busy: 'bg-[var(--av-color-danger,#f43f5e)]',
  away: 'bg-[var(--av-color-warning,#f59e0b)]',
};

function getInitials(name?: string, fallbackInitials?: string): string {
  if (fallbackInitials) return fallbackInitials.toUpperCase().slice(0, 2);
  if (!name) return 'AV';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  (
    {
      className,
      src,
      alt,
      name,
      initials,
      size = 'md',
      status,
      isOnline,
      ...props
    },
    ref
  ) => {
    const [imageError, setImageError] = useState(false);
    const resolvedStatus: AvatarStatus | undefined =
      status || (isOnline !== undefined ? (isOnline ? 'online' : 'offline') : undefined);
    const initialsText = getInitials(name, initials);
    const { container, text, dot } = sizeStyles[size];

    const hasValidImage = Boolean(src) && !imageError;

    return (
      <div
        ref={ref}
        className={cn(
          'relative inline-flex items-center justify-center rounded-full shrink-0 select-none overflow-visible',
          container,
          className
        )}
        {...props}
      >
        <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-gradient-to-br from-indigo-900 to-slate-900 border border-[var(--av-color-border,#1e293b)] text-[var(--av-color-text-primary,#f8fafc)]">
          {hasValidImage ? (
            <img
              src={src!}
              alt={alt || name || 'Avatar'}
              onError={() => setImageError(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className={cn('font-medium leading-none tracking-wider', text)}>
              {initialsText}
            </span>
          )}
        </div>

        {resolvedStatus && (
          <span
            className={cn(
              'absolute bottom-0 right-0 rounded-full ring-[var(--av-color-bg,#020617)] translate-x-[15%] translate-y-[15%]',
              statusStyles[resolvedStatus],
              dot
            )}
            aria-label={`Status: ${resolvedStatus}`}
            title={`Status: ${resolvedStatus}`}
          />
        )}
      </div>
    );
  }
);

Avatar.displayName = 'Avatar';
