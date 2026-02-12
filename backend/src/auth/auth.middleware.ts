/**
 * Authentication Middleware
 * Validates JWT from HTTP-only cookie and attaches user to request
 */

import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service.js';
import { authConfig } from '../config/auth.js';
import { AuthUser } from '../types/auth.js';
import { defaultLogger } from '../utils/logger.js';

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
    const token = req.cookies?.[authConfig.cookieName];
    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Authentication required. Please login.',
        code: 'LOGIN_REQUIRED',
      });
      return;
    }

    const user = await authService.verifyToken(token);
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Session expired. Please login again.',
        code: 'LOGIN_REQUIRED',
      });
      return;
    }

    req.user = user;
    next();
  } catch (err: any) {
    defaultLogger.error('Auth middleware error', { error: err.message });
    res.status(401).json({ success: false, error: 'Authentication failed.' });
  }
};
