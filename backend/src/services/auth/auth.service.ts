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

    // Validate and normalize role
    const rawRole = userAccount.Role;
    if (!rawRole || typeof rawRole !== 'string') {
      throw new Error('User account has no role assigned. Please contact administrator to set a valid role.');
    }

    // Normalize role: trim whitespace, convert to lowercase
    const normalizedRole = rawRole.trim().toLowerCase();
    
    // Map common variations to valid roles
    const roleMap: Record<string, UserRole> = {
      'client': UserRole.CLIENT,
      'kam': UserRole.KAM,
      'key account manager': UserRole.KAM,
      'credit_team': UserRole.CREDIT,
      'credit team': UserRole.CREDIT,
      'credit': UserRole.CREDIT,
      'nbfc': UserRole.NBFC,
    };

    const role = roleMap[normalizedRole];
    
    if (!role) {
      throw new Error(
        `Invalid user role: "${rawRole}". Valid roles are: client, kam, credit_team, nbfc. ` +
        `Please contact administrator to update your role.`
      );
    }

    let authUser: AuthUser = {
      id: userAccount.id,
      email: userAccount.Username,
      role,
    };

    // Fetch role-specific data from individual webhooks (only after user account is validated)
    // This is separate from login to keep login fast and use dedicated webhook
    // Use Promise.race with timeout to prevent blocking on slow webhooks
    const roleDataPromise = (async () => {
      switch (role) {
        case UserRole.CLIENT:
          // For clients, find the Client record in Airtable via n8n webhook
          try {
            const clients = await Promise.race([
              n8nClient.fetchTable('Clients'),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), 5000)
              )
            ]) as any[];
            
            const client = clients.find((c: any) => {
              const contactInfo = c['Contact Email / Phone'] || c['Contact Email/Phone'] || '';
              return contactInfo.toLowerCase().includes(email.toLowerCase());
            });
            
            if (client) {
              authUser.clientId = client.id || client['Client ID'];
              authUser.name = client['Client Name'] || email.split('@')[0];
              console.log(`[AuthService] Client login: ${email} -> Airtable Client ID: ${authUser.clientId}, Client Name: ${authUser.name}`);
            } else {
              console.warn(`[AuthService] No Client record found in Airtable for ${email}`);
              authUser.name = email.split('@')[0];
            }
          } catch (error: any) {
            console.error(`[AuthService] Error looking up Airtable client for ${email}:`, error.message);
            authUser.name = email.split('@')[0];
          }
          break;

        case UserRole.KAM:
          // Fetch only KAM Users table
          try {
            const kamUsers = await Promise.race([
              n8nClient.fetchTable('KAM Users'),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), 5000)
              )
            ]) as any[];
            
            const kamUser = kamUsers.find((k) => k.Email?.toLowerCase() === email.toLowerCase());
            if (kamUser) {
              authUser.kamId = kamUser.id;
              authUser.name = kamUser.Name;
            }
          } catch (error: any) {
            console.error(`[AuthService] Error looking up KAM user for ${email}:`, error.message);
          }
          break;

        case UserRole.CREDIT:
          // Fetch only Credit Team Users table
          try {
            const creditUsers = await Promise.race([
              n8nClient.fetchTable('Credit Team Users'),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), 5000)
              )
            ]) as any[];
            
            const creditUser = creditUsers.find((c) => c.Email?.toLowerCase() === email.toLowerCase());
            if (creditUser) {
              authUser.name = creditUser.Name;
            }
          } catch (error: any) {
            console.error(`[AuthService] Error looking up Credit user for ${email}:`, error.message);
          }
          break;

        case UserRole.NBFC:
          // Fetch only NBFC Partners table
          try {
            const nbfcPartners = await Promise.race([
              n8nClient.fetchTable('NBFC Partners'),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), 5000)
              )
            ]) as any[];
            
            // NBFC users might have email in Contact Email/Phone
            const nbfcPartner = nbfcPartners.find((n) => 
              n['Contact Email/Phone']?.toLowerCase().includes(email.toLowerCase())
            );
            if (nbfcPartner) {
              authUser.nbfcId = nbfcPartner.id;
              authUser.name = nbfcPartner['Lender Name'];
            }
          } catch (error: any) {
            console.error(`[AuthService] Error looking up NBFC partner for ${email}:`, error.message);
          }
          break;
      }
    })();

    // Wait for role data with overall timeout (don't block login if it's slow)
    try {
      await Promise.race([
        roleDataPromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Role data fetch timeout')), 6000)
        )
      ]);
    } catch (error: any) {
      console.warn(`[AuthService] Role data fetch timed out or failed for ${email}, continuing with login`);
      // Continue with login even if role data fetch fails
    }

    // Update last login (non-blocking - don't wait for it)
    n8nClient.postUserAccount({
      id: userAccount.id,
      Username: userAccount.Username,
      Password: userAccount.Password,
      Role: userAccount.Role,
      'Associated Profile': userAccount['Associated Profile'],
      'Last Login': new Date().toISOString(),
      'Account Status': userAccount['Account Status'],
    }).catch((error) => {
      console.warn(`[AuthService] Failed to update last login for ${email}:`, error.message);
      // Non-critical, don't block login
    });

    // Generate JWT
    const jwtSecret = authConfig.jwtSecret || 'default-secret';
    const jwtExpiresIn: string = authConfig.jwtExpiresIn || '7d';
    
    // Log the clientId being set in JWT for debugging
    if (authUser.role === 'client') {
      console.log(`[AuthService] Generating JWT for ${authUser.email} with clientId: ${authUser.clientId}`);
    }
    
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

