/**
 * Role-Based Access Control Middleware
 * Enforces role-based permissions on routes
 */

import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../config/constants.js';

export const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
      });
      return;
    }

    next();
  };
};

// Convenience middleware for each role
export const requireClient = requireRole(UserRole.CLIENT);
export const requireKAM = requireRole(UserRole.KAM);
export const requireCredit = requireRole(UserRole.CREDIT);
export const requireNBFC = requireRole(UserRole.NBFC);
export const requireCreditOrKAM = requireRole(UserRole.CREDIT, UserRole.KAM);

