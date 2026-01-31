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

  const canAccess = (requiredRole: UserRole | UserRole[]): boolean => {
    if (!user) return false;
    
    if (Array.isArray(requiredRole)) {
      return requiredRole.includes(user.role);
    }
    
    return user.role === requiredRole;
  };

  const canManageClients = isKAM || isCredit || isAdmin;
  const canApprovePayouts = isCredit || isAdmin;
  const canViewAllApplications = isCredit || isAdmin;
  const canAssignNBFC = isCredit || isAdmin;
  const canGenerateReports = isCredit || isKAM || isAdmin;

  return {
    user,
    isClient,
    isKAM,
    isCredit,
    isNBFC,
    isAdmin,
    canAccess,
    canManageClients,
    canApprovePayouts,
    canViewAllApplications,
    canAssignNBFC,
    canGenerateReports,
  };
}

