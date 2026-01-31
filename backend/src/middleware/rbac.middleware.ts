/**
 * Module 0: Role-Based Access Control Middleware
 * 
 * Enforces role-based permissions on routes and actions.
 * Provides both route guards and action guards.
 */

import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../config/constants.js';
import { AuthUser } from '../types/auth.js';

/**
 * Route guard middleware factory
 * Returns middleware that checks if user has one of the allowed roles
 */
export const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        requiredRoles: allowedRoles,
        userRole: req.user.role,
      });
      return;
    }

    next();
  };
};

/**
 * Action guard function (for use in controllers)
 * Checks if user has permission to perform an action
 * 
 * @param user - The authenticated user
 * @param allowedRoles - Roles allowed to perform the action
 * @returns true if allowed, false otherwise
 */
export function canPerformAction(user: AuthUser | undefined, ...allowedRoles: UserRole[]): boolean {
  if (!user) {
    return false;
  }
  return allowedRoles.includes(user.role);
}

/**
 * Action guard that throws an error if not allowed
 * Useful for early returns in controllers
 */
export function requireActionPermission(
  user: AuthUser | undefined,
  ...allowedRoles: UserRole[]
): asserts user is AuthUser {
  if (!user) {
    throw new Error('Authentication required');
  }
  if (!allowedRoles.includes(user.role)) {
    throw new Error(`Insufficient permissions. Required roles: ${allowedRoles.join(', ')}`);
  }
}

/**
 * Check if user can access a specific resource
 * Used for resource-level access control (e.g., client can only see their own data)
 */
export function canAccessResource(
  user: AuthUser | undefined,
  resourceOwnerId?: string,
  resourceOwnerField?: 'clientId' | 'kamId' | 'nbfcId'
): boolean {
  if (!user) {
    return false;
  }

  // If no resource owner specified, allow access (public resource or admin)
  if (!resourceOwnerId) {
    return true;
  }

  // Check if user owns the resource
  if (resourceOwnerField) {
    const userOwnerId = user[resourceOwnerField];
    return userOwnerId === resourceOwnerId || userOwnerId === resourceOwnerId?.toString();
  }

  // Default: check clientId for CLIENT role
  if (user.role === UserRole.CLIENT) {
    return user.clientId === resourceOwnerId || user.clientId === resourceOwnerId?.toString();
  }

  // KAM can access resources of their managed clients
  if (user.role === UserRole.KAM) {
    // This would need to check if resourceOwnerId is in KAM's managed clients list
    // For now, KAM has broader access (handled in dataFilterService)
    return true;
  }

  // CREDIT and NBFC have role-specific access (handled in dataFilterService)
  return true;
}

// Convenience middleware for each role
export const requireClient = requireRole(UserRole.CLIENT);
export const requireKAM = requireRole(UserRole.KAM);
export const requireCredit = requireRole(UserRole.CREDIT);
export const requireNBFC = requireRole(UserRole.NBFC);
export const requireCreditOrKAM = requireRole(UserRole.CREDIT, UserRole.KAM);
export const requireCreditOrNBFC = requireRole(UserRole.CREDIT, UserRole.NBFC);

