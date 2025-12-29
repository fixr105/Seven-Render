/**
 * Authentication Controller
 */

import { Request, Response } from 'express';
import { authService } from '../services/auth/auth.service.js';
import { n8nClient } from '../services/airtable/n8nClient.js';
import { loginSchema } from '../utils/validators.js';

export class AuthController {
  /**
   * POST /auth/login
   */
  async login(req: Request, res: Response): Promise<void> {
    try {
      // Validate input
      const { email, password } = loginSchema.parse(req.body);

      // Wrap login in a timeout to prevent Vercel function timeout
      // Reduced to 5 seconds since role data is now non-blocking
      // Only getUserAccounts call should take time (3s max)
      const loginPromise = authService.login(email, password);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Login request timed out. The server may be experiencing high load. Please try again in a moment.')), 5000)
      );

      const result = await Promise.race([loginPromise, timeoutPromise]);

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      // Provide better error messages for timeout scenarios
      let statusCode = 401;
      let errorMessage = error.message || 'Login failed';

      if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
        statusCode = 504; // Gateway Timeout
        errorMessage = 'Login request timed out. Please check your connection and try again.';
      } else if (errorMessage.includes('webhook') && errorMessage.includes('timeout')) {
        statusCode = 504;
        errorMessage = 'Unable to connect to authentication service. Please try again in a moment.';
      }

      res.status(statusCode).json({
        success: false,
        error: errorMessage,
      });
    }
  }

  /**
   * GET /auth/me
   */
  async getMe(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Not authenticated',
        });
        return;
      }

      // Get name from role-specific table
      let name = req.user.email.split('@')[0];

      // Try to get name from role-specific table
      if (req.user.role === 'kam') {
        const kamUsers = await n8nClient.fetchTable('KAM Users');
        const kamUser = kamUsers.find((k) => k.id === req.user.kamId);
        if (kamUser) name = kamUser.Name;
      } else if (req.user.role === 'credit_team') {
        const creditUsers = await n8nClient.fetchTable('Credit Team Users');
        // Use case-insensitive comparison to match login flow behavior
        const creditUser = creditUsers.find((c) => c.Email?.toLowerCase() === req.user.email?.toLowerCase());
        if (creditUser) name = creditUser.Name;
      }

      res.json({
        success: true,
        data: {
          id: req.user.id,
          email: req.user.email,
          role: req.user.role,
          clientId: req.user.clientId,
          kamId: req.user.kamId,
          nbfcId: req.user.nbfcId,
          name,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get user info',
      });
    }
  }
}

export const authController = new AuthController();

