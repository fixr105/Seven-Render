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

    // Map User Account to AuthUser with role-specific profile IDs (clientId, kamId, etc.)
    const baseUser = this.toAuthUser(user);
    const enrichedUser = await this.populateProfileIds(baseUser, user);
    return enrichedUser;
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

  /**
   * Populate profile IDs (clientId, kamId, nbfcId, creditTeamId) based on role.
   * This mirrors the intended n8n login workflow mapping so that:
   * - Client users get clientId from Clients table
   * - KAM users get kamId from KAM Users table
   * - Credit team users get creditTeamId from Credit Team Users table
   * - NBFC users get nbfcId from NBFC Partners table
   */
  private async populateProfileIds(base: AuthUser, account: UserAccount): Promise<AuthUser> {
    let clientId = base.clientId ?? null;
    let kamId = base.kamId ?? null;
    let nbfcId = base.nbfcId ?? null;
    let creditTeamId = base.creditTeamId ?? null;

    const username = (account.Username || '').trim();
    const normalizedEmail = username.toLowerCase();
    const associatedProfile = (account['Associated Profile'] || '').toString().trim().toLowerCase();

    try {
      if (base.role === UserRole.CLIENT) {
        // Map client users to Clients table
        const clients = await n8nClient.fetchTable('Clients');
        const matchingClient = clients.find((c: any) => {
          const contact = (c['Contact Email / Phone'] || c.contactEmailPhone || '').toString().toLowerCase();
          const clientName = (c['Client Name'] || c.clientName || '').toString().trim().toLowerCase();

          // Match rule (from N8N_LOGIN_WORKFLOW_FIX.md):
          // - Contact Email/Phone contains username (email)
          // - OR Client Name matches associated_profile
          const emailMatch = normalizedEmail && contact.includes(normalizedEmail);
          const nameMatch = associatedProfile && clientName === associatedProfile;
          return emailMatch || nameMatch;
        });

        if (matchingClient) {
          clientId = (matchingClient['Client ID'] || matchingClient.clientId || matchingClient.id || null)?.toString() ?? null;
        }
      } else if (base.role === UserRole.KAM) {
        // Map KAM users to KAM Users table
        const kamUsers = await n8nClient.fetchTable('KAM Users');
        const matchingKam = kamUsers.find((k: any) => {
          const email = (k.Email || k['Email'] || '').toString().trim().toLowerCase();
          return email && email === normalizedEmail;
        });

        if (matchingKam) {
          kamId = (matchingKam['KAM ID'] || matchingKam.kamId || matchingKam.id || null)?.toString() ?? null;
        }
      } else if (base.role === UserRole.CREDIT) {
        // Map Credit Team users to Credit Team Users table
        const creditUsers = await n8nClient.fetchTable('Credit Team Users');
        const matchingCredit = creditUsers.find((c: any) => {
          const email = (c.Email || c['Email'] || '').toString().trim().toLowerCase();
          return email && email === normalizedEmail;
        });

        if (matchingCredit) {
          creditTeamId = (matchingCredit['Credit Team ID'] || matchingCredit.creditTeamId || matchingCredit.id || null)?.toString() ?? null;
        }
      } else if (base.role === UserRole.NBFC) {
        // Map NBFC users to NBFC Partners table
        const partners = await n8nClient.fetchTable('NBFC Partners');
        const matchingPartner = partners.find((p: any) => {
          const contact = (p['Contact Email/Phone'] || p.contactEmailPhone || '').toString().toLowerCase();
          return normalizedEmail && contact.includes(normalizedEmail);
        });

        if (matchingPartner) {
          nbfcId = (matchingPartner['Lender ID'] || matchingPartner.lenderId || matchingPartner.id || null)?.toString() ?? null;
        }
      }
    } catch (error) {
      // Log and continue with base IDs to avoid breaking login
      defaultLogger.warn('Failed to populate profile IDs from Airtable tables', {
        username,
        role: base.role,
        error: (error as Error).message,
      });
    }

    return {
      ...base,
      clientId,
      kamId,
      nbfcId,
      creditTeamId,
    };
  }

  private normalizeRole(role: unknown): UserRole {
    if (typeof role !== 'string') return UserRole.CLIENT;
    const r = role.trim().toLowerCase().replace(/\s+/g, '_');
    if (r === 'kam') return UserRole.KAM;
    if (r === 'credit_team' || r === 'credit' || r === 'creditteam') return UserRole.CREDIT;
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
      const user: AuthUser = {
        id: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        name: decoded.name ?? null,
        clientId: decoded.clientId ?? null,
        kamId: decoded.kamId ?? null,
        nbfcId: decoded.nbfcId ?? null,
        creditTeamId: decoded.creditTeamId ?? null,
      };
      return this.resolveClientIdForClientUser(user);
    } catch {
      return null;
    }
  }

  /**
   * If the user is a client and clientId is null (e.g. linked after login or match failed at login),
   * resolve clientId from Clients table by matching Contact Email/Phone to the user's email.
   * This ensures RBAC and client endpoints see a valid clientId without requiring re-login.
   */
  async resolveClientIdForClientUser(user: AuthUser): Promise<AuthUser> {
    if (user.role !== UserRole.CLIENT || user.clientId) {
      return user;
    }
    const email = (user.email || '').trim().toLowerCase();
    if (!email) return user;
    try {
      const clients = await n8nClient.fetchTable('Clients');
      const matching = clients.find((c: any) => {
        const contact = (c['Contact Email / Phone'] || c.contactEmailPhone || '').toString().toLowerCase();
        return contact && contact.includes(email);
      });
      if (matching) {
        const resolved = (matching['Client ID'] || matching.clientId || matching.id || null)?.toString() ?? null;
        if (resolved) {
          defaultLogger.debug('Resolved clientId for client user from Clients table', {
            email: user.email,
            clientId: resolved,
          });
          return { ...user, clientId: resolved };
        }
      }
    } catch (err: any) {
      defaultLogger.warn('Failed to resolve clientId for client user', { email: user.email, error: err.message });
    }
    return user;
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
