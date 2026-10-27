// ==============================================================================
// AssetVault: FilterBar Component
// Course: BCSE307L Database Systems (Fall 2026-27)
// Responsive filter toolbar with active filter chips and clear triggers
// ==============================================================================

import React, { ReactNode } from 'react';
import { Filter, X, RotateCcw } from 'lucide-react';

interface ActiveFilter {
  key: string;
  label: string;
  value: string;
}

interface FilterBarProps {
  children?: ReactNode;
  activeFilters?: ActiveFilter[];
  onRemoveFilter?: (key: string) => void;
  onResetFilters?: () => void;
  className?: string;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  children,
  activeFilters = [],
  onRemoveFilter,
  onResetFilters,
  className = '',
}) => {
  const hasActiveFilters = activeFilters.length > 0;

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[260px]">
          {children}
        </div>

        {hasActiveFilters && onResetFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset filters</span>
          </button>
        )}
      </div>

      {/* Active Filter Chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <span className="inline-flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 font-medium">
            <Filter className="w-3 h-3" />
            Active:
          </span>
          {activeFilters.map((af) => (
            <span
              key={af.key}
              className="inline-flex items-center gap-1.5 py-0.5 pl-2.5 pr-1.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 animate-fade-in"
            >
              <span>
                <strong className="text-slate-500 dark:text-slate-400">{af.label}:</strong> {af.value}
              </span>
              {onRemoveFilter && (
                <button
                  type="button"
                  onClick={() => onRemoveFilter(af.key)}
                  className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full"
                  aria-label={`Remove filter for ${af.label}`}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
