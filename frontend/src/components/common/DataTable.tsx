// ==============================================================================
// AssetVault: Reusable Enterprise DataTable Component
// Course: BCSE307L Database Systems (Fall 2026-27)
// Responsive: Full table on desktop, stacked card layout below 640px.
// Features: Sorting indicators, loading skeletons, empty states, and pagination
// ==============================================================================

import type { ReactNode } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Pagination } from './Pagination';
import { TableSkeleton } from './LoadingSkeleton';
import { EmptyState } from './EmptyState';
import { PaginationMeta } from '../../types';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
  className?: string;
  mobileCardLabel?: boolean; // Show label in stacked mobile card
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  meta?: PaginationMeta;
  isLoading?: boolean;
  onPageChange?: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  emptyTitle?: string;
  emptyMessage?: string;
  emptyAction?: { label: string; onClick: () => void; icon?: ReactNode };
  onRowClick?: (row: T) => void;
  keyExtractor: (row: T) => string;
  className?: string;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  meta,
  isLoading = false,
  onPageChange,
  onLimitChange,
  sortBy,
  sortOrder,
  onSort,
  emptyTitle = 'No records found',
  emptyMessage = 'There are no items matching the current criteria.',
  emptyAction,
  onRowClick,
  keyExtractor,
  className = '',
}: DataTableProps<T>) {
  if (isLoading) {
    return <TableSkeleton rows={meta?.limit ? Math.min(meta.limit, 8) : 5} columns={columns.length} />;
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <EmptyState
          title={emptyTitle}
          message={emptyMessage}
          action={emptyAction}
        />
      </div>
    );
  }

  const renderSortIcon = (columnKey: string) => {
    if (sortBy !== columnKey) {
      return <ArrowUpDown className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 transition-opacity" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
    );
  };

  return (
    <div
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col ${className}`}
    >
      {/* 1. Desktop & Tablet Table View (Hidden on mobile < 640px) */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800">
              {columns.map((col) => {
                const isSortable = col.sortable && onSort;
                return (
                  <th
                    key={col.key}
                    onClick={() => isSortable && onSort(col.key)}
                    className={`py-3.5 px-4 font-semibold text-slate-600 dark:text-slate-300 select-none ${
                      isSortable ? 'cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-800/80 group' : ''
                    } ${col.className || ''}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{col.header}</span>
                      {isSortable && renderSortIcon(col.key)}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200">
            {data.map((row) => (
              <tr
                key={keyExtractor(row)}
                onClick={() => onRowClick && onRowClick(row)}
                className={`transition-colors duration-150 hover:bg-slate-50 dark:hover:bg-slate-850/50 ${
                  onRowClick ? 'cursor-pointer' : ''
                }`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`py-3 px-4 align-middle ${col.className || ''}`}
                  >
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 2. Mobile Responsive Stacked Card View (Shown ONLY on < 640px) */}
      <div className="block sm:hidden divide-y divide-slate-100 dark:divide-slate-800 p-2">
        {data.map((row) => (
          <div
            key={keyExtractor(row)}
            onClick={() => onRowClick && onRowClick(row)}
            className={`p-3.5 space-y-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 shadow-xs my-1.5 ${
              onRowClick ? 'active:bg-slate-50 dark:active:bg-slate-800 cursor-pointer' : ''
            }`}
          >
            {columns.map((col) => (
              <div
                key={col.key}
                className="flex items-center justify-between text-xs gap-2 py-0.5"
              >
                <span className="font-semibold text-slate-500 dark:text-slate-400">
                  {col.header}
                </span>
                <span className="text-right text-slate-900 dark:text-slate-100">
                  {col.render ? col.render(row) : row[col.key]}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* 3. Server-side Pagination Bar */}
      {meta && onPageChange && (
        <Pagination
          meta={meta}
          onPageChange={onPageChange}
          onLimitChange={onLimitChange}
        />
      )}
    </div>
  );
}
