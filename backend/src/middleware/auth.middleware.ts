/**
 * Authentication Middleware
 * Validates JWT tokens and attaches user to request
 */

import { Request, Response, NextFunction } from 'express';
import { authService, AuthUser } from '../services/auth/auth.service.js';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'No token provided',
      });
      return;
    }

    const token = authHeader.substring(7);
    const user = authService.verifyToken(token);
    req.user = user;
    next();
  } catch (error: any) {
    res.status(401).json({
      success: false,
      error: error.message || 'Invalid token',
    });
  }
};

