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
    // Wrap in Promise.race to ensure timeout is enforced even if getUserAccounts doesn't timeout internally
    // This is critical for Vercel serverless functions which have a 60s hard limit
    const getUserAccountsPromise = n8nClient.getUserAccounts(2000); // 2 second internal timeout
    const externalTimeout = new Promise<UserAccount[]>((_, reject) => 
      setTimeout(() => reject(new Error('User accounts fetch timed out after 3 seconds')), 3000)
    );
    
    let userAccounts: UserAccount[];
    try {
      userAccounts = await Promise.race([getUserAccountsPromise, externalTimeout]);
    } catch (error: any) {
      if (error.message?.includes('timed out') || error.message?.includes('timeout')) {
        throw new Error('Authentication service is temporarily unavailable. Please try again in a moment.');
      }
      throw error;
    }

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

    // Set default name immediately (don't wait for role data)
    // Role data fetching is now completely non-blocking to prevent Vercel timeouts
    authUser.name = userAccount['Associated Profile'] || email.split('@')[0];

    // Fetch role-specific data in background (completely non-blocking)
    // This ensures login completes immediately even if webhooks are very slow
    // Role data will be fetched after login completes, and can be updated on next request
    (async () => {
      try {
        switch (role) {
          case UserRole.CLIENT:
            // For clients, find the Client record in Airtable via n8n webhook
            try {
              const clients = await n8nClient.fetchTable('Clients', true, undefined, 2000) as any[];
              
              // Try multiple field name variations for email matching
              const client = clients.find((c: any) => {
                // Check various possible email field names
                const contactInfo = 
                  c['Contact Email / Phone'] || 
                  c['Contact Email/Phone'] || 
                  c['Contact Email'] ||
                  c['Email'] ||
                  c['Email Address'] ||
                  '';
                
                // Also check if Client ID or Client Name matches (fallback)
                const clientId = c['Client ID'] || '';
                const clientName = c['Client Name'] || '';
                
                // Match by email if available, otherwise try to match by name/ID
                if (contactInfo) {
                  return contactInfo.toLowerCase().includes(email.toLowerCase());
                }
                
                // Fallback: try matching email username with client name
                const emailUsername = email.split('@')[0].toLowerCase();
                return clientName.toLowerCase().includes(emailUsername) || 
                       clientId.toLowerCase().includes(emailUsername);
              });
              
              if (client) {
                // Use Client ID if available, otherwise use record id
                authUser.clientId = client['Client ID'] || client.id;
                authUser.name = client['Client Name'] || authUser.name;
                console.log(`[AuthService] Client login (background): ${email} -> Airtable Client ID: ${authUser.clientId}, Name: ${authUser.name}`);
              } else {
                console.warn(`[AuthService] No Client record found matching ${email} in ${clients.length} clients`);
              }
            } catch (error: any) {
              console.warn(`[AuthService] Background client lookup failed for ${email}:`, error.message);
            }
            break;

          case UserRole.KAM:
            // Fetch only KAM Users table
            try {
              const kamUsers = await n8nClient.fetchTable('KAM Users', true, undefined, 2000) as any[];
              
              const kamUser = kamUsers.find((k) => k.Email?.toLowerCase() === email.toLowerCase());
              if (kamUser) {
                authUser.kamId = kamUser.id;
                authUser.name = kamUser.Name || authUser.name;
              }
            } catch (error: any) {
              console.warn(`[AuthService] Background KAM lookup failed for ${email}:`, error.message);
            }
            break;

          case UserRole.CREDIT:
            // Fetch only Credit Team Users table
            try {
              const creditUsers = await n8nClient.fetchTable('Credit Team Users', true, undefined, 2000) as any[];
              
              const creditUser = creditUsers.find((c) => c.Email?.toLowerCase() === email.toLowerCase());
              if (creditUser) {
                authUser.name = creditUser.Name || authUser.name;
              }
            } catch (error: any) {
              console.warn(`[AuthService] Background Credit lookup failed for ${email}:`, error.message);
            }
            break;

          case UserRole.NBFC:
            // Fetch only NBFC Partners table
            try {
              const nbfcPartners = await n8nClient.fetchTable('NBFC Partners', true, undefined, 2000) as any[];
              
              // NBFC users might have email in Contact Email/Phone
              const nbfcPartner = nbfcPartners.find((n) => 
                n['Contact Email/Phone']?.toLowerCase().includes(email.toLowerCase())
              );
              if (nbfcPartner) {
                authUser.nbfcId = nbfcPartner.id;
                authUser.name = nbfcPartner['Lender Name'] || authUser.name;
              }
            } catch (error: any) {
              console.warn(`[AuthService] Background NBFC lookup failed for ${email}:`, error.message);
            }
            break;
        }
      } catch (error: any) {
        console.warn(`[AuthService] Background role data fetch failed for ${email}:`, error.message);
      }
    })().catch(() => {
      // Silently ignore background errors - login should not fail because of this
    });

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

