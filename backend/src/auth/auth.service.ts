/**
 * Authentication Service
 * Handles login via n8n/Airtable user lookup, JWT creation, and token verification
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserRole, AccountStatus } from '../config/constants.js';
import { UserAccount } from '../types/entities.js';
import { AuthUser } from '../types/auth.js';
import { n8nClient } from '../services/airtable/n8nClient.js';
import { authConfig } from '../config/auth.js';
import { defaultLogger } from '../utils/logger.js';

const USER_ACCOUNTS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let userAccountsCache: { data: UserAccount[]; timestamp: number } | null = null;

export class AuthService {
  static clearUserAccountsCache(): void {
    userAccountsCache = null;
    defaultLogger.debug('User accounts cache cleared');
  }

  private static getCachedUserAccounts(): UserAccount[] | null {
    if (userAccountsCache && Date.now() - userAccountsCache.timestamp < USER_ACCOUNTS_CACHE_TTL) {
      return userAccountsCache.data;
    }
    return null;
  }

  private static setCachedUserAccounts(accounts: UserAccount[]): void {
    userAccountsCache = { data: accounts, timestamp: Date.now() };
  }

  async getUserByEmail(email: string): Promise<UserAccount | null> {
    const cached = AuthService.getCachedUserAccounts();
    let accounts: UserAccount[];
    if (cached) {
      accounts = cached;
    } else {
      accounts = await n8nClient.getUserAccounts(10000);
      AuthService.setCachedUserAccounts(accounts);
    }
    const normalizedEmail = email.trim().toLowerCase();
    return accounts.find(
      (u) => (u.Username || '').trim().toLowerCase() === normalizedEmail
    ) ?? null;
  }

  async validateCredentials(email: string, password: string): Promise<AuthUser | null> {
    const user = await this.getUserByEmail(email);
    if (!user) return null;

    if ((user['Account Status'] as string) !== 'Active') {
      defaultLogger.warn('Login attempt for inactive account', { email: user.Username });
      return null;
    }

    const hash = user.Password;
    if (!hash || typeof hash !== 'string') {
      defaultLogger.warn('User account missing password hash', { email: user.Username });
      return null;
    }

    const isValid = await bcrypt.compare(password, hash);
    if (!isValid) return null;

    return this.toAuthUser(user);
  }

  private toAuthUser(account: UserAccount): AuthUser {
    const role = this.normalizeRole(account.Role);
    const email = (account.Username || '').trim();
    const name = email ? email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) : null;
    return {
      id: account.id,
      email,
      role,
      name,
      clientId: null,
      kamId: null,
      nbfcId: null,
      creditTeamId: null,
    };
  }

  private normalizeRole(role: unknown): UserRole {
    if (typeof role !== 'string') return UserRole.CLIENT;
    const r = role.toLowerCase();
    if (r === 'kam') return UserRole.KAM;
    if (r === 'credit_team' || r === 'credit') return UserRole.CREDIT;
    if (r === 'nbfc') return UserRole.NBFC;
    if (r === 'admin') return UserRole.ADMIN;
    return UserRole.CLIENT;
  }

  createToken(user: AuthUser): string {
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      clientId: user.clientId,
      kamId: user.kamId,
      nbfcId: user.nbfcId,
      creditTeamId: user.creditTeamId,
    };
    return jwt.sign(payload, authConfig.jwtSecret, {
      expiresIn: authConfig.jwtExpiresIn,
    } as jwt.SignOptions);
  }

  async verifyToken(token: string): Promise<AuthUser | null> {
    try {
      const { tokenBlacklist } = await import('../services/auth/tokenBlacklist.service.js');
      if (tokenBlacklist.isBlacklisted(token)) return null;

      const decoded = jwt.verify(token, authConfig.jwtSecret) as jwt.JwtPayload & {
        userId: string;
        email: string;
        role: UserRole;
        name?: string;
        clientId?: string | null;
        kamId?: string | null;
        nbfcId?: string | null;
        creditTeamId?: string | null;
      };
      return {
        id: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        name: decoded.name ?? null,
        clientId: decoded.clientId ?? null,
        kamId: decoded.kamId ?? null,
        nbfcId: decoded.nbfcId ?? null,
        creditTeamId: decoded.creditTeamId ?? null,
      };
    } catch {
      return null;
    }
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  getTokenExpiry(token: string): number | null {
    try {
      const decoded = jwt.decode(token) as { exp?: number } | null;
      return decoded?.exp ?? null;
    } catch {
      return null;
    }
  }
}

export const authService = new AuthService();
