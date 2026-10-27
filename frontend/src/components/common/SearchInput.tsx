// ==============================================================================
// AssetVault: Debounced SearchInput Component
// Course: BCSE307L Database Systems (Fall 2026-27)
// Automatically debounces search input (300ms) with clear button and accessible label
// ==============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { Search, X } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value: externalValue,
  onChange,
  placeholder = 'Search...',
  debounceMs = 300,
  className = '',
}) => {
  const [internalValue, setInternalValue] = useState(externalValue ?? '');

  // Sync internal value when external changes
  useEffect(() => {
    setInternalValue(externalValue ?? '');
  }, [externalValue]);

  // Debounced callback
  useEffect(() => {
    const handler = setTimeout(() => {
      if (internalValue !== externalValue) {
        onChange(internalValue);
      }
    }, debounceMs);

    return () => clearTimeout(handler);
  }, [internalValue, debounceMs, onChange, externalValue]);

  const handleClear = useCallback(() => {
    setInternalValue('');
    onChange('');
  }, [onChange]);

  return (
    <div className={`relative flex items-center w-full max-w-md ${className}`}>
      <Search className="absolute left-3 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
      <input
        type="text"
        value={internalValue ?? ''}
        onChange={(e) => setInternalValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full pl-9 pr-8 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all shadow-sm"
      />
      {internalValue && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded transition-colors"
          aria-label="Clear search"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
