// ==============================================================================
// AssetVault: Reusable DatePicker Component
// Course: BCSE307L Database Systems (Fall 2026-27)
// Controlled date input with calendar icon, label, min/max bounds, error & clear button
// ==============================================================================

import React from 'react';
import { Calendar, X, AlertCircle } from 'lucide-react';

export interface DatePickerProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  minDate?: string;
  maxDate?: string;
  required?: boolean;
  error?: string | null;
  helperText?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  label,
  value,
  onChange,
  minDate,
  maxDate,
  required = false,
  error,
  helperText,
  disabled = false,
  className = '',
  id,
}) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!disabled) {
      onChange('');
    }
  };

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label
            htmlFor={inputId}
            className="text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            {label}
            {required && <span className="text-rose-500 ml-1">*</span>}
          </label>
        </div>
      )}

      <div className="relative flex items-center">
        <div className="absolute left-3 pointer-events-none text-slate-400 dark:text-slate-500">
          <Calendar className="w-4 h-4" />
        </div>

        <input
          id={inputId}
          type="date"
          value={value ?? ''}
          min={minDate}
          max={maxDate}
          required={required}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full pl-9 pr-8 py-2 text-xs rounded-lg border transition-colors bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed ${
            error
              ? 'border-rose-400 dark:border-rose-600 focus:ring-rose-500'
              : 'border-slate-300 dark:border-slate-700'
          }`}
        />

        {value && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            title="Clear date"
            aria-label="Clear date"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {error ? (
        <p className="flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400 font-medium mt-0.5 animate-fade-in">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : helperText ? (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{helperText}</p>
      ) : null}
    </div>
  );
};
