/**
 * Users Controller
 * Handles user account management (admin functions)
 */

import { Request, Response } from 'express';
import { n8nClient } from '../services/airtable/n8nClient.js';

export class UsersController {
  /**
   * GET /kam-users
   * List all KAM users
   */
  async listKAMUsers(req: Request, res: Response): Promise<void> {
    try {
      // Only credit team and admin can list KAM users
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
   * GET /user-accounts
   * List all user accounts (admin only)
   */
  async listUserAccounts(req: Request, res: Response): Promise<void> {
    try {
      // Only admin can list all user accounts
      if (req.user!.role !== 'admin' && req.user!.role !== 'credit_team') {
        res.status(403).json({
          success: false,
          error: 'Forbidden',
        });
        return;
      }

      // Fetch only User Accounts table
      const userAccounts = await n8nClient.fetchTable('User Accounts');

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

      // Users can only see their own account unless admin
      if (req.user!.role !== 'admin' && account.id !== req.user!.id) {
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

      // Only admin can update user accounts
      if (req.user!.role !== 'admin') {
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
}

export const usersController = new UsersController();

