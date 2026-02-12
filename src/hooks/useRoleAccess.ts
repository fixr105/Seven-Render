/**
 * Hook for role-based access control
 * Provides utilities for checking user roles and permissions
 */

import { useAuth } from '../auth/AuthContext';
import { UserRole } from '../auth/types';

export function useRoleAccess() {
  const { user } = useAuth();

  const isClient = user?.role === 'client';
  const isKAM = user?.role === 'kam';
  const isCredit = user?.role === 'credit_team';
  const isNBFC = user?.role === 'nbfc';
  const isAdmin = user?.role === 'admin';
  /** Credit has full admin-level access; admin is treated as credit for dashboard/sidebar */
  const hasAdminAccess = isCredit || isAdmin;

  const canAccess = (requiredRole: UserRole | UserRole[]): boolean => {
    if (!user) return false;
    
    if (Array.isArray(requiredRole)) {
      return requiredRole.includes(user.role);
    }
    
    return user.role === requiredRole;
  };

  const canManageClients = isKAM || hasAdminAccess;
  const canApprovePayouts = hasAdminAccess;
  const canViewAllApplications = hasAdminAccess;
  const canAssignNBFC = hasAdminAccess;
  const canGenerateReports = isCredit || isKAM || isAdmin;

  return {
    user,
    isClient,
    isKAM,
    isCredit,
    isNBFC,
    isAdmin,
    hasAdminAccess,
    canAccess,
    canManageClients,
    canApprovePayouts,
    canViewAllApplications,
    canAssignNBFC,
    canGenerateReports,
  };
}

