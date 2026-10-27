// ==============================================================================
// AssetVault: 403 Forbidden Access Page
// Course: BCSE307L Database Systems (Fall 2026-27)
// Rendered when authenticated users attempt to access unauthorized role resources
// ==============================================================================

import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, Home, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const ForbiddenPage: React.FC = () => {
  const { user } = useAuth();
  const roleName = typeof user?.role === 'object' && user?.role !== null ? (user.role as any).name : user?.role;

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6 animate-fade-in">
      <div className="w-16 h-16 flex items-center justify-center rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 mb-6 shadow-inner ring-8 ring-rose-50 dark:ring-rose-950/30">
        <ShieldAlert className="w-9 h-9" />
      </div>

      <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight mb-2">
        403 - Access Forbidden
      </h1>

      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mb-2 leading-relaxed">
        Your current role (<strong className="text-slate-700 dark:text-slate-300 font-semibold">{roleName}</strong>) does not have permission to view or execute operations on this resource.
      </p>

      <p className="text-xs text-slate-400 dark:text-slate-500 mb-8">
        If you require access, please contact your organization&apos;s Tenant Administrator.
      </p>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Go Back
        </button>

        <Link
          to="/"
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 active:bg-primary-800 rounded-xl shadow-sm transition-all"
        >
          <Home className="w-4 h-4" />
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
};
