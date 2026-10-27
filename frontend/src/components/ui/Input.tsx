// ==============================================================================
// AssetVault Design System: Input Component
// Label, helper text, error state, left icon slot & right action slot
// ==============================================================================

import React, { forwardRef, useId } from 'react';
import { cn } from '../../utils/cn';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  helperText?: string;
  error?: string;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  rightAction?: React.ReactNode;
  inputSize?: 'sm' | 'md' | 'lg';
}

const sizeStyles = {
  sm: 'text-xs h-8 px-2.5 rounded-[var(--av-radius-sm,6px)]',
  md: 'text-sm h-10 px-3.5 rounded-[var(--av-radius-md,10px)]',
  lg: 'text-base h-12 px-4 rounded-[var(--av-radius-md,10px)]',
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      id,
      label,
      helperText,
      error,
      iconLeft,
      iconRight,
      rightAction,
      inputSize = 'md',
      disabled,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const hasError = Boolean(error);
    const rightSlot = rightAction || iconRight;

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-medium text-[var(--av-color-text-secondary,#94a3b8)] select-none"
          >
            {label}
          </label>
        )}

        <div className="relative flex items-center w-full">
          {iconLeft && (
            <div className="absolute left-3 flex items-center pointer-events-none text-[var(--av-color-text-muted,#64748b)]">
              {iconLeft}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            aria-invalid={hasError ? 'true' : undefined}
            aria-describedby={
              hasError
                ? `${inputId}-error`
                : helperText
                ? `${inputId}-helper`
                : undefined
            }
            className={cn(
              'w-full bg-[var(--av-color-bg,#020617)] text-[var(--av-color-text-primary,#f8fafc)] placeholder:text-[var(--av-color-text-muted,#64748b)] border transition-all duration-150',
              'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--av-color-bg,#020617)]',
              hasError
                ? 'border-[var(--av-color-danger,#f43f5e)] focus:border-[var(--av-color-danger,#f43f5e)] focus:ring-[var(--av-color-danger,#f43f5e)]'
                : 'border-[var(--av-color-border,#1e293b)] hover:border-[var(--av-color-border-subtle,#334155)] focus:border-[var(--av-color-primary,#6366f1)] focus:ring-[var(--av-color-primary,#6366f1)]',
              disabled && 'opacity-50 cursor-not-allowed bg-slate-900/50',
              sizeStyles[inputSize],
              iconLeft ? 'pl-9' : '',
              rightSlot ? 'pr-10' : '',
              className
            )}
            {...props}
          />

          {rightSlot && (
            <div className="absolute right-3 flex items-center text-[var(--av-color-text-muted,#64748b)]">
              {rightSlot}
            </div>
          )}
        </div>

        {hasError && (
          <p id={`${inputId}-error`} className="text-xs text-[var(--av-color-danger,#f43f5e)] font-medium">
            {error}
          </p>
        )}

        {!hasError && helperText && (
          <p id={`${inputId}-helper`} className="text-xs text-[var(--av-color-text-muted,#64748b)]">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
