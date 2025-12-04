/**
 * Authentication Service
 * Handles login, JWT generation, and password validation
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { authConfig } from '../../config/auth.js';
import { UserRole } from '../../config/constants.js';
import { n8nClient } from '../airtable/n8nClient.js';
import { UserAccount, KAMUser, CreditTeamUser, NBFCPartner } from '../../types/entities.js';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  clientId?: string;
  kamId?: string;
  nbfcId?: string;
  name?: string;
}

export class AuthService {
  /**
   * Login - validate credentials and return JWT
   */
  async login(email: string, password: string): Promise<{ user: AuthUser; token: string }> {
    // Use dedicated user account webhook for login (loads only once)
    const userAccounts = await n8nClient.getUserAccounts();

    // Find user by email (Username field in Airtable)
    const userAccount = userAccounts.find(
      (u) => u.Username && u.Username.toLowerCase() === email.toLowerCase()
    );

    if (!userAccount) {
      throw new Error('Invalid email or password');
    }

    // Check account status
    if (userAccount['Account Status'] !== 'Active') {
      throw new Error('Account is not active');
    }

    // Validate password
    // Check if password is hashed (starts with $2a$ or $2b$) or plaintext
    const isPasswordValid = userAccount.Password.startsWith('$2')
      ? await bcrypt.compare(password, userAccount.Password)
      : userAccount.Password === password; // Fallback for plaintext passwords

    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    // Get role-specific profile
    const role = userAccount.Role as UserRole;
    let authUser: AuthUser = {
      id: userAccount.id,
      email: userAccount.Username,
      role,
    };

    // Fetch role-specific data from individual webhooks (only after user account is validated)
    // This is separate from login to keep login fast and use dedicated webhook
    switch (role) {
      case UserRole.CLIENT:
        // Client profile is in User Accounts with Associated Profile
        authUser.clientId = userAccount.id;
        authUser.name = userAccount['Associated Profile'] || email.split('@')[0];
        break;

      case UserRole.KAM:
        // Fetch only KAM Users table
        const kamUsers = await n8nClient.fetchTable('KAM Users');
        const kamUser = kamUsers.find((k) => k.Email?.toLowerCase() === email.toLowerCase());
        if (kamUser) {
          authUser.kamId = kamUser.id;
          authUser.name = kamUser.Name;
        }
        break;

      case UserRole.CREDIT:
        // Fetch only Credit Team Users table
        const creditUsers = await n8nClient.fetchTable('Credit Team Users');
        const creditUser = creditUsers.find((c) => c.Email?.toLowerCase() === email.toLowerCase());
        if (creditUser) {
          authUser.name = creditUser.Name;
        }
        break;

      case UserRole.NBFC:
        // Fetch only NBFC Partners table
        const nbfcPartners = await n8nClient.fetchTable('NBFC Partners');
        // NBFC users might have email in Contact Email/Phone
        const nbfcPartner = nbfcPartners.find((n) => 
          n['Contact Email/Phone']?.toLowerCase().includes(email.toLowerCase())
        );
        if (nbfcPartner) {
          authUser.nbfcId = nbfcPartner.id;
          authUser.name = nbfcPartner['Lender Name'];
        }
        break;
    }

    // Update last login
    await n8nClient.postUserAccount({
      id: userAccount.id,
      Username: userAccount.Username,
      Password: userAccount.Password,
      Role: userAccount.Role,
      'Associated Profile': userAccount['Associated Profile'],
      'Last Login': new Date().toISOString(),
      'Account Status': userAccount['Account Status'],
    });

    // Generate JWT
    const jwtSecret = authConfig.jwtSecret || 'default-secret';
    const jwtExpiresIn: string = authConfig.jwtExpiresIn || '7d';
    const token = jwt.sign(
      {
        userId: authUser.id,
        email: authUser.email,
        role: authUser.role,
        clientId: authUser.clientId,
        kamId: authUser.kamId,
        nbfcId: authUser.nbfcId,
      },
      jwtSecret,
      { expiresIn: jwtExpiresIn } as jwt.SignOptions
    );

    return { user: authUser, token };
  }

  /**
   * Verify JWT token
   */
  verifyToken(token: string): AuthUser {
    try {
      const decoded = jwt.verify(token, authConfig.jwtSecret) as any;
      return {
        id: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        clientId: decoded.clientId,
        kamId: decoded.kamId,
        nbfcId: decoded.nbfcId,
      };
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Hash password
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }
}

export const authService = new AuthService();

