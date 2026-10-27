// ==============================================================================
// AssetVault: RoleGate Component
// Course: BCSE307L Database Systems (Fall 2026-27)
// Conditionally renders UI actions or displays disabled tooltips for unauthorized roles
// ==============================================================================

import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { RoleName } from '../../types';

interface RoleGateProps {
  children: React.ReactNode;
  roles?: RoleName[];
  permission?: string;
  fallback?: React.ReactNode;
  disableInsteadOfHide?: boolean;
  tooltipText?: string;
}

export const RoleGate: React.FC<RoleGateProps> = ({
  children,
  roles,
  permission,
  fallback = null,
  disableInsteadOfHide = false,
  tooltipText = 'You do not have permission to perform this action',
}) => {
  const { hasRole, hasPermission } = useAuth();

  const isRoleAllowed = !roles || roles.length === 0 || hasRole(roles);
  const isPermissionAllowed = !permission || hasPermission(permission);
  const isAuthorized = isRoleAllowed && isPermissionAllowed;

  if (isAuthorized) {
    return <>{children}</>;
  }

  if (disableInsteadOfHide) {
    return (
      <div className="relative group inline-block" title={tooltipText}>
        <div className="opacity-50 pointer-events-none select-none cursor-not-allowed">
          {children}
        </div>
      </div>
    );
  }

  return <>{fallback}</>;
};
