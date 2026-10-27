// ==============================================================================
// AssetVault: Pagination Component
// Course: BCSE307L Database Systems (Fall 2026-27)
// Responsive server-side pagination bar with limit selector and page jumping
// ==============================================================================

import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { PaginationMeta } from '../../types';

interface PaginationProps {
  meta?: PaginationMeta;
  currentPage?: number;
  totalPages?: number;
  totalItems?: number;
  pageSize?: number;
  onPageChange: (newPage: number) => void;
  onLimitChange?: (newLimit: number) => void;
  onPageSizeChange?: (newLimit: number) => void;
  limitOptions?: number[];
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  meta,
  currentPage = 1,
  totalPages: propTotalPages = 1,
  totalItems = 0,
  pageSize = 10,
  onPageChange,
  onLimitChange,
  onPageSizeChange,
  limitOptions = [10, 25, 50, 100],
  className = '',
}) => {
  const page = meta?.page ?? currentPage;
  const limit = meta?.limit ?? pageSize;
  const total = meta?.total ?? totalItems;
  const totalPages = meta?.totalPages ?? propTotalPages;
  const hasNext = meta?.hasNext ?? page < totalPages;
  const hasPrev = meta?.hasPrev ?? page > 1;
  const handleLimitChange = onLimitChange || onPageSizeChange;

  const startItem = total === 0 ? 0 : (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-4 py-3 px-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 ${className}`}
    >
      {/* Left: Summary and limit selector */}
      <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
        <span>
          Showing <span className="font-semibold text-slate-900 dark:text-slate-100">{startItem}</span> to{' '}
          <span className="font-semibold text-slate-900 dark:text-slate-100">{endItem}</span> of{' '}
          <span className="font-semibold text-slate-900 dark:text-slate-100">{total}</span> results
        </span>

        {handleLimitChange && (
          <div className="flex items-center gap-1.5 ml-2">
            <span className="hidden sm:inline">Rows:</span>
            <select
              value={limit}
              onChange={(e) => handleLimitChange(Number(e.target.value))}
              aria-label="Rows per page"
              className="py-1 px-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              {limitOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right: Page navigation */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={!hasPrev || page === 1}
          aria-label="First page"
          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPrev}
          aria-label="Previous page"
          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <span className="px-3 py-1 font-medium text-slate-700 dark:text-slate-300">
          Page {page} of {Math.max(1, totalPages)}
        </span>

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNext}
          aria-label="Next page"
          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={!hasNext || page === totalPages}
          aria-label="Last page"
          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
