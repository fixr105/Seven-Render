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
    // Token format: test-token-{role}@{timestamp}
    // This format allows roles with underscores (e.g., credit_team)
    if (token.startsWith('test-token-')) {
      // Extract role from token: test-token-{role}@{timestamp}
      // Split by '@' first to separate role from timestamp
      const roleAndTimestamp = token.replace('test-token-', '');
      const atIndex = roleAndTimestamp.indexOf('@');
      const role = atIndex > 0 ? roleAndTimestamp.substring(0, atIndex) : roleAndTimestamp;
      
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
      } else {
        console.warn(`[AuthMiddleware] Unknown test role: ${role}`);
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

