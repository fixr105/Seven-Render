/**
 * Role Guard Component
 * Conditionally renders children based on user role
 */

import React, { ReactNode } from 'react';
import { useApiAuth } from '../contexts/ApiAuthContext';
import { UserRole } from '../services/api';

interface RoleGuardProps {
  allowedRoles: UserRole[];
  children: ReactNode;
  fallback?: ReactNode;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({
  allowedRoles,
  children,
  fallback = null,
}) => {
  const { user } = useApiAuth();

  if (!user) {
    return <>{fallback}</>;
  }

  if (allowedRoles.includes(user.role)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
};

