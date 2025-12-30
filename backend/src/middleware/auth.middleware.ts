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
    
    // Allow test tokens (bypass authentication for development/testing)
    if (token.startsWith('test-token-')) {
      const tokenParts = token.split('-');
      const role = tokenParts[2] as any; // 'client', 'kam', 'credit_team', 'nbfc'
      
      // Map test user emails to roles
      const testUsers: Record<string, { email: string; role: any; clientId?: string; kamId?: string; nbfcId?: string; name: string }> = {
        'client': {
          email: 'client@test.com',
          role: 'client',
          clientId: 'TEST-CLIENT-001',
          name: 'Test Client',
        },
        'kam': {
          email: 'kam@test.com',
          role: 'kam',
          kamId: 'TEST-KAM-001',
          name: 'Test KAM',
        },
        'credit_team': {
          email: 'credit@test.com',
          role: 'credit_team',
          name: 'Test Credit',
        },
        'nbfc': {
          email: 'nbfc@test.com',
          role: 'nbfc',
          nbfcId: 'TEST-NBFC-001',
          name: 'Test NBFC',
        },
      };
      
      const testUser = testUsers[role];
      if (testUser) {
        req.user = {
          id: `test-${role}-${Date.now()}`,
          email: testUser.email,
          role: testUser.role,
          clientId: testUser.clientId,
          kamId: testUser.kamId,
          nbfcId: testUser.nbfcId,
          name: testUser.name,
        };
        console.log(`[AuthMiddleware] Test token authenticated: ${testUser.email} (${testUser.role})`);
        next();
        return;
      }
    }
    
    // Verify real JWT token
    const user = authService.verifyToken(token);
    req.user = user;
    
    // Debug logging for client role
    if (user.role === 'client') {
      console.log(`[AuthMiddleware] Authenticated client: ${user.email}, clientId: ${user.clientId}`);
    }
    
    next();
  } catch (error: any) {
    res.status(401).json({
      success: false,
      error: error.message || 'Invalid token',
    });
  }
};

