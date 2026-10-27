// ==============================================================================
// AssetVault Design System: Select Component
// Styled native select with custom chevron icon, label, helperText & error
// ==============================================================================

import React, { forwardRef, useId } from 'react';
import { cn } from '../../utils/cn';

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string;
  helperText?: string;
  error?: string;
  options?: SelectOption[];
  selectSize?: 'sm' | 'md' | 'lg';
}

const sizeStyles = {
  sm: 'text-xs h-8 pl-2.5 pr-8 rounded-[var(--av-radius-sm,6px)]',
  md: 'text-sm h-10 pl-3.5 pr-10 rounded-[var(--av-radius-md,10px)]',
  lg: 'text-base h-12 pl-4 pr-12 rounded-[var(--av-radius-md,10px)]',
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      id,
      label,
      helperText,
      error,
      options,
      selectSize = 'md',
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const selectId = id || generatedId;
    const hasError = Boolean(error);

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={selectId}
            className="text-xs font-medium text-[var(--av-color-text-secondary,#94a3b8)] select-none"
          >
            {label}
          </label>
        )}

        <div className="relative flex items-center w-full">
          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            aria-invalid={hasError ? 'true' : undefined}
            aria-describedby={
              hasError
                ? `${selectId}-error`
                : helperText
                ? `${selectId}-helper`
                : undefined
            }
            className={cn(
              'w-full appearance-none cursor-pointer bg-[var(--av-color-bg,#020617)] text-[var(--av-color-text-primary,#f8fafc)] border transition-all duration-150',
              'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--av-color-bg,#020617)]',
              hasError
                ? 'border-[var(--av-color-danger,#f43f5e)] focus:border-[var(--av-color-danger,#f43f5e)] focus:ring-[var(--av-color-danger,#f43f5e)]'
                : 'border-[var(--av-color-border,#1e293b)] hover:border-[var(--av-color-border-subtle,#334155)] focus:border-[var(--av-color-primary,#6366f1)] focus:ring-[var(--av-color-primary,#6366f1)]',
              disabled && 'opacity-50 cursor-not-allowed bg-slate-900/50',
              sizeStyles[selectSize],
              className
            )}
            {...props}
          >
            {options
              ? options.map((opt) => (
                  <option
                    key={opt.value}
                    value={opt.value}
                    disabled={opt.disabled}
                    className="bg-slate-900 text-slate-100 py-1"
                  >
                    {opt.label}
                  </option>
                ))
              : children}
          </select>

          {/* Styled Chevron Icon */}
          <div className="absolute right-3 pointer-events-none flex items-center text-[var(--av-color-text-muted,#64748b)]">
            <svg
              className="w-4 h-4 text-current"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </div>
        </div>

        {hasError && (
          <p id={`${selectId}-error`} className="text-xs text-[var(--av-color-danger,#f43f5e)] font-medium">
            {error}
          </p>
        )}

        {!hasError && helperText && (
          <p id={`${selectId}-helper`} className="text-xs text-[var(--av-color-text-muted,#64748b)]">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
