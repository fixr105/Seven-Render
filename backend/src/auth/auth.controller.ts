/**
 * Authentication Controller
 * Handles login, validate, me, logout, refresh, profile update
 */

import { Request, Response } from 'express';
import { authService } from './auth.service.js';
import { authConfig } from '../config/auth.js';
import { defaultLogger } from '../utils/logger.js';
import { tokenBlacklist } from '../services/auth/tokenBlacklist.service.js';
import { n8nClient } from '../services/airtable/n8nClient.js';
import { usersController } from '../controllers/users.controller.js';

/** Append Partitioned to auth cookie so Chrome accepts it in cross-site (Vercel→Fly) requests. */
function addPartitionedToAuthCookie(res: Response): void {
  const setCookie = res.getHeader('Set-Cookie');
  if (!setCookie) return;
  const arr = Array.isArray(setCookie) ? setCookie : [setCookie];
  const modified = arr.map((v: string) =>
    typeof v === 'string' && v.includes(authConfig.cookieName) ? v + '; Partitioned' : v
  );
  res.setHeader('Set-Cookie', modified);
}

export class AuthController {
  async login(req: Request, res: Response): Promise<void> {
    try {
      // PRD §6: accept { username, password }; also support { email, password } for backward compatibility
      const email = (
        typeof req.body?.email === 'string'
          ? req.body.email
          : typeof req.body?.username === 'string'
            ? req.body.username
            : ''
      ).trim();
      const password = typeof req.body?.password === 'string' ? req.body.password : '';

      if (!email || !password) {
        res.status(400).json({ success: false, error: 'Username/email and password are required' });
        return;
      }

      if (email.length > 254) {
        res.status(400).json({ success: false, error: 'Invalid credentials' });
        return;
      }

      const user = await authService.validateCredentials(email, password);
      if (!user) {
        res.status(401).json({ success: false, error: 'Invalid email or password' });
        return;
      }

      const token = authService.createToken(user);
      const expiry = authService.getTokenExpiry(token);

      res.cookie(authConfig.cookieName, token, authConfig.cookieOptions);
      addPartitionedToAuthCookie(res);

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            name: user.name,
            clientId: user.clientId,
            kamId: user.kamId,
            nbfcId: user.nbfcId,
            creditTeamId: user.creditTeamId,
          },
          token, // For clients that cannot use cookies (e.g. E2E, some proxies)
        },
      });
    } catch (err: any) {
      defaultLogger.error('Login error', { error: err.message });
      res.status(500).json({ success: false, error: 'Authentication failed. Please try again.' });
    }
  }

  /**
   * POST /auth/validate (PRD §6): Validate JWT and return new token if valid.
   * Body: { token: string }.
   */
  async validateJwt(req: Request, res: Response): Promise<void> {
    try {
      const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
      if (!token) {
        res.status(400).json({ success: false, error: 'Token is required' });
        return;
      }

      const user = await authService.verifyToken(token);
      if (!user) {
        res.status(401).json({ success: false, error: 'Invalid or expired token' });
        return;
      }

      const newToken = authService.createToken(user);
      res.cookie(authConfig.cookieName, newToken, authConfig.cookieOptions);
      addPartitionedToAuthCookie(res);

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            name: user.name,
            clientId: user.clientId,
            kamId: user.kamId,
            nbfcId: user.nbfcId,
            creditTeamId: user.creditTeamId,
          },
          token: newToken,
        },
      });
    } catch (err: any) {
      defaultLogger.error('Validate JWT error', { error: err.message });
      res.status(500).json({ success: false, error: 'Validation failed. Please try again.' });
    }
  }

  /**
   * POST /auth/validate-credentials: Login with username and passcode (legacy/secondary flow).
   * Body: { username: string, passcode: string }. For PRD JWT validation use POST /auth/validate with { token }.
   */
  async validateCredentials(req: Request, res: Response): Promise<void> {
    try {
      const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
      const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode : '';

      if (!username || !passcode) {
        res.status(400).json({ success: false, error: 'Username and passcode are required' });
        return;
      }

      const user = await authService.validateCredentials(username, passcode);
      if (!user) {
        res.status(401).json({ success: false, error: 'Invalid credentials' });
        return;
      }

      const token = authService.createToken(user);
      res.cookie(authConfig.cookieName, token, authConfig.cookieOptions);
      addPartitionedToAuthCookie(res);

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            name: user.name,
            clientId: user.clientId,
            kamId: user.kamId,
            nbfcId: user.nbfcId,
            creditTeamId: user.creditTeamId,
          },
          token,
        },
      });
    } catch (err: any) {
      defaultLogger.error('Validate credentials error', { error: err.message });
      res.status(500).json({ success: false, error: 'Validation failed. Please try again.' });
    }
  }

  async getMe(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }
    const data: Record<string, unknown> = {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
      name: req.user.name,
      clientId: req.user.clientId,
      kamId: req.user.kamId,
      nbfcId: req.user.nbfcId,
      creditTeamId: req.user.creditTeamId,
    };
    try {
      const { name, phone, company } = await this.fetchProfileFromRoleTable(req.user);
      if (name) data.name = name;
      if (phone !== undefined) data.phone = phone;
      if (company !== undefined) data.company = company;
    } catch {
      // Non-fatal: keep JWT-derived name if role table fetch fails
    }
    if (req.user.role === 'client' && req.user.clientId) {
      try {
        const clients = await n8nClient.fetchTable('Clients');
        const client = clients.find(
          (c: any) =>
            c.id === req.user!.clientId ||
            c['Client ID'] === req.user!.clientId ||
            String(c.id) === String(req.user!.clientId)
        );
        const enabledStr = client?.['Enabled Modules'] || client?.enabledModules || '';
        const enabledModules = typeof enabledStr === 'string'
          ? enabledStr.split(',').map((m: string) => m.trim()).filter(Boolean)
          : Array.isArray(enabledStr) ? enabledStr : [];
        data.enabledModules = enabledModules;
      } catch {
        data.enabledModules = [];
      }
    }
    try {
      const userAccounts = await n8nClient.fetchTable('User Accounts');
      const account = userAccounts.find((a: any) => a.id === req.user!.id || a['User Account ID'] === req.user!.id);
      if (account && account['Settings']) {
        try {
          data.settings = typeof account['Settings'] === 'string' ? JSON.parse(account['Settings']) : account['Settings'];
        } catch {
          data.settings = {};
        }
      }
    } catch {
      // Non-fatal: omit settings if fetch fails
    }
    res.json({ success: true, data });
  }

  /**
   * Fetch name, phone, company from role-specific tables (Clients, KAM Users, etc.)
   */
  private async fetchProfileFromRoleTable(user: { role: string; clientId?: string | null; kamId?: string | null; creditTeamId?: string | null; nbfcId?: string | null; email: string }): Promise<{ name?: string; phone?: string; company?: string }> {
    const matchId = (a: any, b: string | null | undefined) =>
      !b ? false : String(a || '').trim() === String(b).trim();
    if (user.role === 'client' && user.clientId) {
      const clients = await n8nClient.fetchTable('Clients');
      const c = clients.find((x: any) =>
        matchId(x.id, user.clientId) || matchId(x['Client ID'], user.clientId)
      );
      if (c) {
        const contact = (c['Contact Email / Phone'] || c.contactEmailPhone || '').toString();
        const phonePart = contact.includes(' | ') ? contact.split(' | ')[1]?.trim() : null;
        const phone = phonePart || (contact.match(/[\d+\-\s()]{10,}/)?.[0]?.trim());
        return {
          name: (c['Primary Contact Name'] || c.primaryContactName || '').toString().trim() || undefined,
          phone: phone || undefined,
          company: (c['Client Name'] || c.clientName || '').toString().trim() || undefined,
        };
      }
    }
    if (user.role === 'kam' && user.kamId) {
      const kamUsers = await n8nClient.fetchTable('KAM Users');
      const k = kamUsers.find((x: any) =>
        matchId(x.id, user.kamId) || matchId(x['KAM ID'], user.kamId)
      );
      if (k) {
        return {
          name: (k['Name'] || k.Name || '').toString().trim() || undefined,
          phone: (k['Phone'] || k.Phone || '').toString().trim() || undefined,
        };
      }
    }
    if (user.role === 'credit_team' && user.creditTeamId) {
      const creditUsers = await n8nClient.fetchTable('Credit Team Users');
      const c = creditUsers.find((x: any) =>
        matchId(x.id, user.creditTeamId) || matchId(x['Credit User ID'], user.creditTeamId)
      );
      if (c) {
        return {
          name: (c['Name'] || c.Name || '').toString().trim() || undefined,
          phone: (c['Phone'] || c.Phone || '').toString().trim() || undefined,
        };
      }
    }
    if (user.role === 'nbfc' && user.nbfcId) {
      const partners = await n8nClient.fetchTable('NBFC Partners');
      const p = partners.find((x: any) =>
        matchId(x.id, user.nbfcId) || matchId(x['Lender ID'], user.nbfcId)
      );
      if (p) {
        const contact = (p['Contact Email/Phone'] || p.contactEmailPhone || '').toString();
        return {
          name: (p['Contact Person'] || p.contactPerson || '').toString().trim() || undefined,
          phone: contact || undefined,
          company: (p['Lender Name'] || p.lenderName || '').toString().trim() || undefined,
        };
      }
    }
    return {};
  }

  /**
   * PATCH /auth/me/settings - Update current user's settings (self-service, any role)
   */
  async updateMySettings(req: Request, res: Response): Promise<void> {
    req.params = { ...req.params, id: req.user!.id };
    return usersController.updateUserSettings(req, res);
  }

  /**
   * PATCH /auth/me/profile - Update current user's profile (name, phone, company)
   */
  async updateProfile(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }
    try {
      const { name, phone, company } = req.body;
      const updates: { name?: string; phone?: string; company?: string } = {};
      if (typeof name === 'string' && name.trim()) updates.name = name.trim();
      if (typeof phone === 'string') updates.phone = phone.trim();
      if (typeof company === 'string') updates.company = company.trim();
      if (Object.keys(updates).length === 0) {
        res.status(400).json({ success: false, error: 'At least one of name, phone, or company is required' });
        return;
      }
      const user = req.user;
      const matchId = (a: any, b: string | null | undefined) =>
        !b ? false : String(a || '').trim() === String(b).trim();

      if (user.role === 'client' && user.clientId) {
        const clients = await n8nClient.fetchTable('Clients');
        const client = clients.find((c: any) =>
          matchId(c.id, user.clientId) || matchId(c['Client ID'], user.clientId)
        );
        if (!client) {
          res.status(404).json({ success: false, error: 'Client profile not found' });
          return;
        }
        const updateData: Record<string, any> = { ...client };
        if (updates.name !== undefined) updateData['Primary Contact Name'] = updates.name;
        if (updates.company !== undefined) updateData['Client Name'] = updates.company;
        if (updates.phone !== undefined) {
          const email = user.email || '';
          updateData['Contact Email / Phone'] = email ? `${email}${updates.phone ? ` | ${updates.phone}` : ''}` : updates.phone;
        }
        await n8nClient.postClient(updateData);
      } else if (user.role === 'kam' && user.kamId) {
        const kamUsers = await n8nClient.fetchTable('KAM Users');
        const kam = kamUsers.find((k: any) =>
          matchId(k.id, user.kamId) || matchId(k['KAM ID'], user.kamId)
        );
        if (!kam) {
          res.status(404).json({ success: false, error: 'KAM profile not found' });
          return;
        }
        const updateData: Record<string, any> = { ...kam };
        if (updates.name !== undefined) updateData['Name'] = updates.name;
        if (updates.phone !== undefined) updateData['Phone'] = updates.phone;
        await n8nClient.postKamUser(updateData);
      } else if (user.role === 'credit_team' && user.creditTeamId) {
        const creditUsers = await n8nClient.fetchTable('Credit Team Users');
        const credit = creditUsers.find((c: any) =>
          matchId(c.id, user.creditTeamId) || matchId(c['Credit User ID'], user.creditTeamId)
        );
        if (!credit) {
          res.status(404).json({ success: false, error: 'Credit team profile not found' });
          return;
        }
        const updateData: Record<string, any> = { ...credit };
        if (updates.name !== undefined) updateData['Name'] = updates.name;
        if (updates.phone !== undefined) updateData['Phone'] = updates.phone;
        await n8nClient.postCreditTeamUser(updateData);
      } else if (user.role === 'nbfc' && user.nbfcId) {
        const partners = await n8nClient.fetchTable('NBFC Partners');
        const partner = partners.find((p: any) =>
          matchId(p.id, user.nbfcId) || matchId(p['Lender ID'], user.nbfcId)
        );
        if (!partner) {
          res.status(404).json({ success: false, error: 'NBFC profile not found' });
          return;
        }
        const updateData: Record<string, any> = { ...partner };
        if (updates.name !== undefined) updateData['Contact Person'] = updates.name;
        if (updates.company !== undefined) updateData['Lender Name'] = updates.company;
        if (updates.phone !== undefined) updateData['Contact Email/Phone'] = updates.phone;
        await n8nClient.postNBFCPartner(updateData);
      } else if (user.role === 'admin') {
        res.status(400).json({ success: false, error: 'Admin users do not have a profile record to update. Contact support.' });
        return;
      } else {
        res.status(400).json({ success: false, error: 'Profile update not available for your role or missing profile ID' });
        return;
      }
      const targetEntity = user.role === 'client' ? 'client' : user.role === 'kam' ? 'kam_user' : user.role === 'credit_team' ? 'credit_team_user' : 'nbfc_partner';
      n8nClient.postAdminActivityLog({
        id: `ACT-${Date.now()}`,
        'Activity ID': `ACT-${Date.now()}`,
        Timestamp: new Date().toISOString(),
        'Performed By': user.email,
        'Action Type': 'update_profile',
        'Description/Details': `Profile updated (${user.role}): ${Object.keys(updates).join(', ')}`,
        'Target Entity': targetEntity,
        'Related User ID': user.id,
      }).catch((err) => console.warn('[updateProfile] Failed to log admin activity:', err));
      const { AuthService } = await import('./auth.service.js');
      AuthService.clearUserAccountsCache();
      res.json({ success: true, message: 'Profile updated successfully' });
    } catch (err: any) {
      defaultLogger.error('Profile update error', { error: err.message });
      res.status(500).json({ success: false, error: err.message || 'Failed to update profile' });
    }
  }

  async logout(req: Request, res: Response): Promise<void> {
    try {
      const token = req.cookies?.[authConfig.cookieName];
      if (token) {
        const expiry = authService.getTokenExpiry(token);
        if (expiry) {
          tokenBlacklist.addToken(token, expiry, 'logout');
        }
      }
      res.clearCookie(authConfig.cookieName, { path: '/' });
      res.json({ success: true, data: { message: 'Logged out' } });
    } catch (err: any) {
      defaultLogger.error('Logout error', { error: err.message });
      res.clearCookie(authConfig.cookieName, { path: '/' });
      res.json({ success: true, data: { message: 'Logged out' } });
    }
  }

  async refresh(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }
    const token = authService.createToken(req.user);
    const oldToken = req.cookies?.[authConfig.cookieName];
    if (oldToken) {
      const expiry = authService.getTokenExpiry(oldToken);
      if (expiry) tokenBlacklist.addToken(oldToken, expiry, 'rotation');
    }
    res.cookie(authConfig.cookieName, token, authConfig.cookieOptions);
    addPartitionedToAuthCookie(res);
    res.json({
      success: true,
      data: {
        user: {
          id: req.user.id,
          email: req.user.email,
          role: req.user.role,
          name: req.user.name,
          clientId: req.user.clientId,
          kamId: req.user.kamId,
          nbfcId: req.user.nbfcId,
          creditTeamId: req.user.creditTeamId,
        },
      },
    });
  }
}

export const authController = new AuthController();
