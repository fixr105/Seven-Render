/**
 * Authentication Middleware
 * Validates JWT from Bearer header (per-tab) or HTTP-only cookie and attaches user to request.
 * Bearer is preferred over cookie so each tab keeps its own session when multiple users
 * are logged in across tabs (cookie is shared; sessionStorage/Bearer is per-tab).
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

function getTokenFromRequest(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }
  const fromCookie = req.cookies?.[authConfig.cookieName];
  if (fromCookie) return fromCookie;
  return null;
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = getTokenFromRequest(req);
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
