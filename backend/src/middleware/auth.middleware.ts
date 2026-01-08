/**
 * Authentication Middleware
 * Validates JWT tokens and attaches user to request
 */

import { Request, Response, NextFunction } from 'express';
import { authService, AuthUser } from '../services/auth/auth.service.js';
import { createLogger } from '../utils/logger.js';

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
  const logger = createLogger({ requestId: req.headers['x-request-id'] as string });
  logger.debug('Authentication middleware called', { method: req.method, path: req.path });
  try {
    const authHeader = req.headers.authorization;
    logger.debug('Auth header check', { hasAuthHeader: !!authHeader });

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('No valid auth header', { headersSent: res.headersSent });
      
      // Ensure response is sent properly in serverless environment
      // CRITICAL: In serverless-http, we must ensure the response is fully sent
      // before returning from middleware, otherwise the function may timeout
      if (!res.headersSent) {
        try {
          // Send response and ensure it's completed
          res.status(401).json({
            success: false,
            error: 'No token provided',
          });
          logger.debug('401 response sent', { headersSent: res.headersSent });
        } catch (error: any) {
          logger.error('Error sending 401 response', { error: error.message });
          if (!res.headersSent) {
            res.status(500).json({
              success: false,
              error: 'Internal server error',
            });
          }
        }
      } else {
        logger.warn('Response already sent, cannot send 401');
      }
      // Return immediately - don't call next() when sending error response
      return;
    }

    const token = authHeader.substring(7);
    logger.debug('Token extracted', { 
      tokenLength: token.length, 
      isTestToken: token.startsWith('test-token-') 
    });
    
    // Allow test tokens (bypass authentication for development/testing)
    // Token format: test-token-{role}@{timestamp}
    // This format allows roles with underscores (e.g., credit_team)
    if (token.startsWith('test-token-')) {
      logger.debug('Processing test token');
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
        logger.info('Test token authenticated', { email: testUser.email, role: testUser.role });
        next();
        return;
      } else {
        logger.warn('Unknown test role', { role });
      }
    }
    
    // Verify real JWT token
    logger.debug('Verifying JWT token');
    const user = await authService.verifyToken(token);
    logger.info('Token verified', { email: user.email, role: user.role, userId: user.id });
    req.user = user;
    
    // Debug logging for client role
    if (user.role === 'client') {
      logger.debug('Authenticated client', { email: user.email, clientId: user.clientId });
    }
    
    logger.debug('Authentication successful, continuing to route handler');
    next();
  } catch (error: any) {
    logger.error('Authentication error', { error: error.message, stack: error.stack });
    res.status(401).json({
      success: false,
      error: error.message || 'Invalid token',
    });
  }
};

