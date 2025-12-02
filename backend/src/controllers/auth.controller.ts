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

      const result = await authService.login(email, password);

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      res.status(401).json({
        success: false,
        error: error.message || 'Login failed',
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

      // Get fresh data from n8n to include name
      const allData = await n8nClient.getAllData();
      let name = req.user.email.split('@')[0];

      // Try to get name from role-specific table
      if (req.user.role === 'kam') {
        const kamUsers = allData['KAM Users'] || [];
        const kamUser = kamUsers.find((k) => k.id === req.user.kamId);
        if (kamUser) name = kamUser.Name;
      } else if (req.user.role === 'credit_team') {
        const creditUsers = allData['Credit Team Users'] || [];
        const creditUser = creditUsers.find((c) => c.Email === req.user.email);
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

