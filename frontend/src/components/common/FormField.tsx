// ==============================================================================
// AssetVault: FormField Component
// Course: BCSE307L Database Systems (Fall 2026-27)
// Accessible form control wrapper with label, error display, and helper texts
// ==============================================================================

import React, { ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

interface FormFieldProps {
  label: string;
  error?: string | null;
  helperText?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
  id?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  error,
  helperText,
  required = false,
  children,
  className = '',
  id,
}) => {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex items-center justify-between">
        <label
          htmlFor={id}
          className="text-xs font-semibold text-slate-700 dark:text-slate-300"
        >
          {label}
          {required && <span className="text-rose-500 ml-1">*</span>}
        </label>
      </div>

      <div className="relative">{children}</div>

      {error ? (
        <p className="flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400 font-medium mt-0.5 animate-fade-in">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : helperText ? (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {helperText}
        </p>
      ) : null}
    </div>
  );
};
