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

function getTokenFromRequest(req: Request): string | null {
  const fromCookie = req.cookies?.[authConfig.cookieName];
  if (fromCookie) return fromCookie;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7).trim();
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

    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/563cd7b3-2e60-463f-bd89-f5fcf7921d98',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.middleware.ts:authenticate',message:'Token verified user',data:{email:user.email,role:user.role,path:req.path},timestamp:Date.now(),hypothesisId:'H4'})}).catch(()=>{});
    // #endregion
    req.user = user;
    next();
  } catch (err: any) {
    defaultLogger.error('Auth middleware error', { error: err.message });
    res.status(401).json({ success: false, error: 'Authentication failed.' });
  }
};
