/**
 * Users Controller
 * Handles user account management (admin functions)
 */

import { Request, Response } from 'express';
import { n8nClient } from '../services/airtable/n8nClient.js';
import { authService } from '../auth/auth.service.js';

const VALID_ROLES = ['client', 'kam', 'credit_team', 'nbfc', 'admin'];

export class UsersController {
  /**
   * GET /kam-users
   * List all KAM users
   */
  async listKAMUsers(req: Request, res: Response): Promise<void> {
    try {
      // Credit team and admin can list KAM users
      if (req.user!.role !== 'credit_team' && req.user!.role !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Forbidden',
        });
        return;
      }

      // Fetch only KAM Users table
      const kamUsers = await n8nClient.fetchTable('KAM Users');

      res.json({
        success: true,
        data: kamUsers.map((user: any) => ({
          id: user.id,
          kamId: user['KAM ID'],
          name: user.Name,
          email: user.Email,
          phone: user.Phone,
          managedClients: user['Managed Clients'],
          role: user.Role,
          status: user.Status,
        })),
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch KAM users',
      });
    }
  }

  /**
   * GET /kam-users/:id
   * Get single KAM user
   */
  async getKAMUser(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      // Fetch only KAM Users table
      const kamUsers = await n8nClient.fetchTable('KAM Users');
      
      const user = kamUsers.find((u: any) => u.id === id || u['KAM ID'] === id);

      if (!user) {
        res.status(404).json({
          success: false,
          error: 'KAM user not found',
        });
        return;
      }

      res.json({
        success: true,
        data: {
          id: user.id,
          kamId: user['KAM ID'],
          name: user.Name,
          email: user.Email,
          phone: user.Phone,
          managedClients: user['Managed Clients'],
          role: user.Role,
          status: user.Status,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch KAM user',
      });
    }
  }

  /**
   * POST /user-accounts
   * Create new user account (credit_team and admin)
   */
  async createUserAccount(req: Request, res: Response): Promise<void> {
    try {
      if (req.user!.role !== 'credit_team' && req.user!.role !== 'admin') {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      const { username, password, role, associatedProfile, accountStatus } = req.body;

      if (!username || typeof username !== 'string' || !username.trim()) {
        res.status(400).json({ success: false, error: 'Username (email) is required' });
        return;
      }
      if (!password || typeof password !== 'string' || password.length < 6) {
        res.status(400).json({ success: false, error: 'Password is required and must be at least 6 characters' });
        return;
      }
      const normalizedRole = (role && typeof role === 'string' && VALID_ROLES.includes(role)) ? role : 'client';
      const status = accountStatus === 'Inactive' ? 'Inactive' : 'Active';

      const hashedPassword = await authService.hashPassword(password);
      const newId = `USER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const userAccountData = {
        id: newId,
        Username: username.trim().toLowerCase(),
        Password: hashedPassword,
        Role: normalizedRole,
        'Associated Profile': associatedProfile != null ? String(associatedProfile).trim() : '',
        'Last Login': '',
        'Account Status': status,
      };

      await n8nClient.postUserAccount(userAccountData);

      await n8nClient.postAdminActivityLog({
        id: `ACT-${Date.now()}`,
        'Activity ID': `ACT-${Date.now()}`,
        Timestamp: new Date().toISOString(),
        'Performed By': req.user!.email,
        'Action Type': 'create_user_account',
        'Description/Details': `Created user account ${username}`,
        'Target Entity': 'user_account',
      });

      res.status(201).json({
        success: true,
        message: 'User account created successfully',
        data: { id: newId, username: userAccountData.Username, role: normalizedRole, accountStatus: status },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create user account',
      });
    }
  }

  /**
   * GET /user-accounts
   * List all user accounts (admin only)
   */
  async listUserAccounts(req: Request, res: Response): Promise<void> {
    try {
      // Credit team and admin can list all user accounts
      if (req.user!.role !== 'credit_team' && req.user!.role !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Forbidden',
        });
        return;
      }

      // Fetch only User Accounts table (bypass cache when ?fresh=true for post-create visibility)
      const bypassCache = req.query.fresh === 'true' || req.query.bypassCache === 'true';
      const userAccounts = await n8nClient.fetchTable('User Accounts', !bypassCache);

      res.json({
        success: true,
        data: userAccounts.map((account: any) => ({
          id: account.id,
          username: account.Username,
          role: account.Role,
          associatedProfile: account['Associated Profile'],
          lastLogin: account['Last Login'],
          accountStatus: account['Account Status'],
          // Don't return password
        })),
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch user accounts',
      });
    }
  }

  /**
   * GET /user-accounts/:id
   * Get single user account
   */
  async getUserAccount(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      // Fetch only User Accounts table
      const userAccounts = await n8nClient.fetchTable('User Accounts');
      
      const account = userAccounts.find((a: any) => a.id === id);

      if (!account) {
        res.status(404).json({
          success: false,
          error: 'User account not found',
        });
        return;
      }

      // Users can only see their own account unless credit team or admin
      if (req.user!.role !== 'credit_team' && req.user!.role !== 'admin' && account.id !== req.user!.id) {
        res.status(403).json({
          success: false,
          error: 'Forbidden',
        });
        return;
      }

      res.json({
        success: true,
        data: {
          id: account.id,
          username: account.Username,
          role: account.Role,
          associatedProfile: account['Associated Profile'],
          lastLogin: account['Last Login'],
          accountStatus: account['Account Status'],
          // Don't return password
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch user account',
      });
    }
  }

  /**
   * PATCH /user-accounts/:id
   * Update user account (admin only)
   */
  async updateUserAccount(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { accountStatus, role, associatedProfile } = req.body;

      // Credit team and admin can update user accounts
      if (req.user!.role !== 'credit_team' && req.user!.role !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Forbidden',
        });
        return;
      }

      // Fetch only User Accounts table
      const userAccounts = await n8nClient.fetchTable('User Accounts');
      const account = userAccounts.find((a: any) => a.id === id);

      if (!account) {
        res.status(404).json({
          success: false,
          error: 'User account not found',
        });
        return;
      }

      // Update account
      const updateData: any = {
        ...account,
      };

      if (accountStatus !== undefined) {
        updateData['Account Status'] = accountStatus;
      }

      if (role !== undefined) {
        updateData['Role'] = role;
      }

      if (associatedProfile !== undefined) {
        updateData['Associated Profile'] = associatedProfile;
      }

      await n8nClient.postUserAccount(updateData);

      // Log activity
      await n8nClient.postAdminActivityLog({
        id: `ACT-${Date.now()}`,
        'Activity ID': `ACT-${Date.now()}`,
        Timestamp: new Date().toISOString(),
        'Performed By': req.user!.email,
        'Action Type': 'update_user_account',
        'Description/Details': `Updated user account ${id}`,
        'Target Entity': 'user_account',
      });

      res.json({
        success: true,
        message: 'User account updated successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update user account',
      });
    }
  }

  /**
   * PATCH /user-accounts/:id/settings
   * Update current user's own settings (user can only update their own record)
   */
  async updateUserSettings(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { settings } = req.body;

      // User can only update their own settings
      if (req.user!.id !== id) {
        res.status(403).json({
          success: false,
          error: 'Forbidden: you can only update your own settings',
        });
        return;
      }

      if (!settings || typeof settings !== 'object') {
        res.status(400).json({
          success: false,
          error: 'Request body must include a settings object',
        });
        return;
      }

      const userAccounts = await n8nClient.fetchTable('User Accounts');
      const account = userAccounts.find((a: any) => a.id === id);

      if (!account) {
        res.status(404).json({
          success: false,
          error: 'User account not found',
        });
        return;
      }

      // Merge settings into record; store as JSON string in Settings or Preferences field
      const updateData: any = { ...account };
      updateData['Settings'] = JSON.stringify(settings);

      await n8nClient.postUserAccount(updateData);

      res.json({
        success: true,
        message: 'Settings saved successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to save settings',
      });
    }
  }
}

export const usersController = new UsersController();

