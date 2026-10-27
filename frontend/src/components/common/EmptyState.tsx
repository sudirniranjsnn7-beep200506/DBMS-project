// ==============================================================================
// AssetVault: EmptyState Component
// Course: BCSE307L Database Systems (Fall 2026-27)
// Helpful empty state with icon, title, message, and call-to-action button
// ==============================================================================

import React, { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: ReactNode;
  };
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  message,
  action,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-xl border border-dashed border-slate-300 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 my-4 ${className}`}
    >
      <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 mb-4 shadow-inner">
        {icon || <Inbox className="w-7 h-7" />}
      </div>
      <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-1">
        {title}
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-6 leading-relaxed">
        {message}
      </p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 active:bg-primary-800 rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        >
          {action.icon}
          {action.label}
        </button>
      )}
    </div>
  );
};
