// ==============================================================================
// AssetVault: LoadingSkeleton Component
// Course: BCSE307L Database Systems (Fall 2026-27)
// Accessible, animated skeleton placeholders for tables, cards, and forms
// ==============================================================================

import React from 'react';

export const TableSkeleton: React.FC<{ rows?: number; columns?: number }> = ({
  rows = 5,
  columns = 5,
}) => {
  return (
    <div className="w-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm animate-pulse">
      {/* Header skeleton */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 p-4 gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <div
            key={i}
            className="h-4 bg-slate-200 dark:bg-slate-800 rounded flex-1"
          />
        ))}
      </div>
      {/* Row skeletons */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800/60 p-2">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex p-3.5 gap-4 items-center">
            {Array.from({ length: columns }).map((_, c) => (
              <div
                key={c}
                className="h-3.5 bg-slate-100 dark:bg-slate-800/80 rounded flex-1"
                style={{ width: `${60 + ((c * 17) % 35)}%` }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export const CardSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3"
        >
          <div className="flex justify-between items-center">
            <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-24" />
            <div className="w-9 h-9 bg-slate-100 dark:bg-slate-800 rounded-lg" />
          </div>
          <div className="h-7 bg-slate-200 dark:bg-slate-800 rounded w-16" />
          <div className="h-3 bg-slate-100 dark:bg-slate-800/80 rounded w-32" />
        </div>
      ))}
    </div>
  );
};

export const DetailSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-1/3" />
        <div className="h-4 bg-slate-100 dark:bg-slate-800/80 rounded w-1/2" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded" />
          <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded" />
          <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded" />
        </div>
      </div>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 h-64" />
    </div>
  );
};

export const LoadingSkeleton: React.FC<{
  variant?: 'table' | 'card' | 'detail';
  count?: number;
  rows?: number;
  columns?: number;
}> = ({ variant = 'card', count, rows, columns }) => {
  if (variant === 'table') return <TableSkeleton rows={rows} columns={columns} />;
  if (variant === 'detail') return <DetailSkeleton />;
  return <CardSkeleton count={count} />;
};
