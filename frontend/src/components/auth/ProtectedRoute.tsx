// ==============================================================================
// AssetVault: Protected Route Guard
// Course: BCSE307L Database Systems (Fall 2026-27)
// Redirects unauthenticated users to /login and handles session loading state
// ==============================================================================

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { RoleName } from '../../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: RoleName[];
  requiredPermission?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  requiredPermission,
}) => {
  const { isAuthenticated, isLoading, user, hasRole, hasPermission } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary-500/20 border-t-primary-600 rounded-full animate-spin" />
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium animate-pulse">
            Verifying security credentials...
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Role Gate: Direct URL access to forbidden roles renders 403 Forbidden
  if (allowedRoles && allowedRoles.length > 0 && !hasRole(allowedRoles)) {
    return <Navigate to="/403" replace />;
  }

  // Permission Gate: Direct URL access without permission renders 403
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to="/403" replace />;
  }

  return <>{children}</>;
};
