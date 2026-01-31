/**
 * Authentication Controller
 * Handles login, validate, me, logout, refresh
 */

import { Request, Response } from 'express';
import { authService } from './auth.service.js';
import { authConfig } from '../config/auth.js';
import { defaultLogger } from '../utils/logger.js';
import { tokenBlacklist } from '../services/auth/tokenBlacklist.service.js';

export class AuthController {
  async login(req: Request, res: Response): Promise<void> {
    try {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
      const password = typeof req.body?.password === 'string' ? req.body.password : '';

      if (!email || !password) {
        res.status(400).json({ success: false, error: 'Email and password are required' });
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
        },
      });
    } catch (err: any) {
      defaultLogger.error('Login error', { error: err.message });
      res.status(500).json({ success: false, error: 'Authentication failed. Please try again.' });
    }
  }

  async validate(req: Request, res: Response): Promise<void> {
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
        },
      });
    } catch (err: any) {
      defaultLogger.error('Validate error', { error: err.message });
      res.status(500).json({ success: false, error: 'Validation failed. Please try again.' });
    }
  }

  async getMe(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }
    res.json({
      success: true,
      data: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role,
        name: req.user.name,
        clientId: req.user.clientId,
        kamId: req.user.kamId,
        nbfcId: req.user.nbfcId,
        creditTeamId: req.user.creditTeamId,
      },
    });
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
