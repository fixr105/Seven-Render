/**
 * Credit Team Users Controller
 * Manages Credit Team User CRUD operations
 * All operations POST to CREDITTEAMUSERS webhook
 */

import { Request, Response } from 'express';
import { n8nClient } from '../services/airtable/n8nClient.js';
import { UserRole, AccountStatus } from '../config/constants.js';

export class CreditTeamUsersController {
  /**
   * GET /credit-team-users
   * List all credit team users
   */
  async listUsers(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'credit_team') {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      // Fetch only Credit Team Users table
      const creditUsers = await n8nClient.fetchTable('Credit Team Users');

      res.json({
        success: true,
        data: creditUsers.map((user) => ({
          id: user.id,
          creditUserId: user['Credit User ID'],
          name: user.Name,
          email: user.Email,
          phone: user.Phone,
          role: user.Role,
          status: user.Status,
        })),
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch credit team users',
      });
    }
  }

  /**
   * GET /credit-team-users/:id
   * Get single credit team user
   */
  async getUser(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'credit_team') {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      const { id } = req.params;
      // Fetch only Credit Team Users table
      const creditUsers = await n8nClient.fetchTable('Credit Team Users');
      const user = creditUsers.find((u) => u.id === id);

      if (!user) {
        res.status(404).json({ success: false, error: 'Credit team user not found' });
        return;
      }

      res.json({
        success: true,
        data: {
          id: user.id,
          creditUserId: user['Credit User ID'],
          name: user.Name,
          email: user.Email,
          phone: user.Phone,
          role: user.Role,
          status: user.Status,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch credit team user',
      });
    }
  }

  /**
   * POST /credit-team-users
   * Create new credit team user
   */
  async createUser(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'credit_team') {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      const { name, email, phone, role, status } = req.body;

      // Generate IDs
      const id = `CREDIT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const creditUserId = id;

      // Prepare data with exact fields for CREDITTEAMUSERS webhook
      const userData = {
        id: id, // for matching
        'Credit User ID': creditUserId,
        'Name': name || '',
        'Email': email || '',
        'Phone': phone || '',
        'Role': role || UserRole.CREDIT,
        'Status': status || AccountStatus.ACTIVE,
      };

      // POST to CREDITTEAMUSERS webhook
      await n8nClient.postCreditTeamUser(userData);

      // Log admin activity
      await n8nClient.postAdminActivityLog({
        id: `ACT-${Date.now()}`,
        'Activity ID': `ACT-${Date.now()}`,
        Timestamp: new Date().toISOString(),
        'Performed By': req.user.email,
        'Action Type': 'create_credit_team_user',
        'Description/Details': `Created credit team user: ${name} (${email})`,
        'Target Entity': 'credit_team_user',
      });

      res.json({
        success: true,
        data: userData,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create credit team user',
      });
    }
  }

  /**
   * PATCH /credit-team-users/:id
   * Update credit team user
   * Always sends data to CREDITTEAMUSERS webhook
   */
  async updateUser(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'credit_team') {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      const { id } = req.params;
      const { name, email, phone, role, status } = req.body;

      // Get existing user data
      // Fetch only Credit Team Users table
      const creditUsers = await n8nClient.fetchTable('Credit Team Users');
      const existingUser = creditUsers.find((u) => u.id === id);

      if (!existingUser) {
        res.status(404).json({ success: false, error: 'Credit team user not found' });
        return;
      }

      // Prepare updated data with exact fields for CREDITTEAMUSERS webhook
      const userData = {
        id: id, // for matching
        'Credit User ID': existingUser['Credit User ID'] || id,
        'Name': name !== undefined ? name : existingUser.Name,
        'Email': email !== undefined ? email : existingUser.Email,
        'Phone': phone !== undefined ? phone : existingUser.Phone,
        'Role': role !== undefined ? role : existingUser.Role,
        'Status': status !== undefined ? status : existingUser.Status,
      };

      // Always POST to CREDITTEAMUSERS webhook for updates
      await n8nClient.postCreditTeamUser(userData);

      // Log admin activity
      await n8nClient.postAdminActivityLog({
        id: `ACT-${Date.now()}`,
        'Activity ID': `ACT-${Date.now()}`,
        Timestamp: new Date().toISOString(),
        'Performed By': req.user.email,
        'Action Type': 'update_credit_team_user',
        'Description/Details': `Updated credit team user: ${userData.Name} (${userData.Email})`,
        'Target Entity': 'credit_team_user',
      });

      res.json({
        success: true,
        data: userData,
        message: 'Credit team user updated successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update credit team user',
      });
    }
  }

  /**
   * DELETE /credit-team-users/:id
   * Delete/Deactivate credit team user
   */
  async deleteUser(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'credit_team') {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      const { id } = req.params;

      // Get existing user
      // Fetch only Credit Team Users table
      const creditUsers = await n8nClient.fetchTable('Credit Team Users');
      const existingUser = creditUsers.find((u) => u.id === id);

      if (!existingUser) {
        res.status(404).json({ success: false, error: 'Credit team user not found' });
        return;
      }

      // Update status to Disabled instead of deleting
      const userData = {
        id: id, // for matching
        'Credit User ID': existingUser['Credit User ID'] || id,
        'Name': existingUser.Name,
        'Email': existingUser.Email,
        'Phone': existingUser.Phone,
        'Role': existingUser.Role,
        'Status': AccountStatus.DISABLED,
      };

      // POST to CREDITTEAMUSERS webhook
      await n8nClient.postCreditTeamUser(userData);

      // Log admin activity
      await n8nClient.postAdminActivityLog({
        id: `ACT-${Date.now()}`,
        'Activity ID': `ACT-${Date.now()}`,
        Timestamp: new Date().toISOString(),
        'Performed By': req.user.email,
        'Action Type': 'delete_credit_team_user',
        'Description/Details': `Deactivated credit team user: ${existingUser.Name} (${existingUser.Email})`,
        'Target Entity': 'credit_team_user',
      });

      res.json({
        success: true,
        message: 'Credit team user deactivated successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to delete credit team user',
      });
    }
  }
}

export const creditTeamUsersController = new CreditTeamUsersController();

