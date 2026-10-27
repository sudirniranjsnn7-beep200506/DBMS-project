// ==============================================================================
// AssetVault: StatCard Component
// Course: BCSE307L Database Systems (Fall 2026-27)
// Executive KPI card displaying metric, icon, change indicator, and subtitle
// ==============================================================================

import React, { ReactNode } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  trend?: {
    value: string | number;
    positive?: boolean;
    label?: string;
  };
  color?: 'primary' | 'emerald' | 'amber' | 'rose' | 'indigo' | 'cyan';
  className?: string;
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  color = 'primary',
  className = '',
  onClick,
}) => {
  const colorStyles = {
    primary: 'bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 border-primary-100 dark:border-primary-900/30',
    emerald: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30',
    amber: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/30',
    rose: 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/30',
    indigo: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/30',
    cyan: 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 border-cyan-100 dark:border-cyan-900/30',
  }[color];

  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm transition-all duration-200 hover:shadow-md ${
        onClick ? 'cursor-pointer hover:border-slate-300 dark:hover:border-slate-700' : ''
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-4 mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
          {title}
        </span>
        <div className={`p-2.5 rounded-lg border ${colorStyles} shrink-0`}>
          {icon}
        </div>
      </div>

      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
          {value}
        </span>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-2">
        {subtitle && <span className="truncate">{subtitle}</span>}
        {trend && (
          <span
            className={`inline-flex items-center gap-1 font-semibold ml-auto shrink-0 ${
              trend.positive
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {trend.positive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {trend.value}
            {trend.label && <span className="font-normal text-slate-400 ml-0.5">{trend.label}</span>}
          </span>
        )}
      </div>
    </div>
  );
};
