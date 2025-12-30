/**
 * Authentication Service
 * Handles login, JWT generation, and password validation
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import fetch from 'node-fetch';
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
   * 
   * Webhook Response Format:
   * [
   *   {
   *     "id": "recRUcnoAhb3oiPme",
   *     "fields": {
   *       "Username": "user@example.com",
   *       "Password": "...",
   *       "Role": "client",
   *       "Account Status": "Active",
   *       ...
   *     }
   *   }
   * ]
   * 
   * The responseParser.parse() method normalizes this to:
   * [
   *   {
   *     "id": "recRUcnoAhb3oiPme",
   *     "Username": "user@example.com",
   *     "Password": "...",
   *     "Role": "client",
   *     "Account Status": "Active",
   *     ...
   *   }
   * ]
   */
  async login(email: string, password: string): Promise<{ user: AuthUser; token: string; webhookResponse?: any }> {
    console.log('[AuthService] ========== LOGIN SERVICE STARTED ==========');
    console.log('[AuthService] Email:', email);
    
    // Step 1: Fetch user accounts from webhook and validate response structure
    console.log('[AuthService] Step 1: Fetching user accounts from webhook...');
    console.log('[AuthService] Webhook URL: /webhook/useraccount');
    console.log('[AuthService] Table: User Accounts');
    
    let userAccounts: UserAccount[];
    let rawWebhookResponse: any;
    
    try {
      // Fetch raw webhook response directly to validate structure
      const { n8nEndpoints } = await import('../airtable/n8nEndpoints.js');
      const webhookUrl = n8nEndpoints.get.userAccount;
      console.log('[AuthService] Fetching from:', webhookUrl);
      
      const controller = new AbortController();
      // Increase timeout to 15 seconds for production (webhook may be slower)
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      try {
        const response = await fetch(webhookUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`Webhook returned status ${response.status}: ${response.statusText}`);
        }
        
        // Get raw response before parsing
        rawWebhookResponse = await response.json();
        console.log('[AuthService] ✅ Raw webhook response received');
        console.log('[AuthService] Response type:', Array.isArray(rawWebhookResponse) ? 'Array' : typeof rawWebhookResponse);
        console.log('[AuthService] Response keys:', typeof rawWebhookResponse === 'object' && rawWebhookResponse !== null ? Object.keys(rawWebhookResponse).slice(0, 5) : 'N/A');
        
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          console.error('[AuthService] ❌ Webhook request timed out after 15 seconds');
          throw new Error('Authentication service timeout: Webhook request timed out. Please try again.');
        }
        console.error('[AuthService] ❌ Webhook fetch error:', fetchError.message);
        throw fetchError;
      }
      
      // Step 1.1: Validate webhook response structure
      console.log('[AuthService] Step 1.1: Validating webhook response structure...');
      
      // Check if response is an array
      if (!Array.isArray(rawWebhookResponse)) {
        console.error('[AuthService] ❌ Webhook response is not an array');
        console.error('[AuthService] Response type:', typeof rawWebhookResponse);
        console.error('[AuthService] Response value:', JSON.stringify(rawWebhookResponse).substring(0, 200));
        throw new Error('Invalid webhook response format: Expected an array of user records');
      }
      
      // Check if array has at least one object
      if (rawWebhookResponse.length === 0) {
        console.error('[AuthService] ❌ Webhook response array is empty');
        throw new Error('No user accounts found in database');
      }
      
      console.log(`[AuthService] ✅ Response is array with ${rawWebhookResponse.length} records`);
      
      // Step 1.2: Validate each record has required structure (id and either fields or direct properties)
      console.log('[AuthService] Step 1.2: Validating record structure...');

      const invalidRecords: number[] = [];
      rawWebhookResponse.forEach((record: any, index: number) => {
        if (!record || typeof record !== 'object') {
          console.error(`[AuthService] ❌ Record ${index} is not an object:`, typeof record);
          invalidRecords.push(index);
          return;
        }

        if (!record.id || typeof record.id !== 'string') {
          console.error(`[AuthService] ❌ Record ${index} missing or invalid 'id' field`);
          invalidRecords.push(index);
          return;
        }

        // Check if record has fields property OR direct Username property (both formats are valid)
        const hasFields = record.fields && typeof record.fields === 'object' && record.fields !== null;
        const hasDirectUsername = record.Username && typeof record.Username === 'string';
        
        if (!hasFields && !hasDirectUsername) {
          console.error(`[AuthService] ❌ Record ${index} missing 'fields' property or direct 'Username' field`);
          console.error(`[AuthService] Record ${index} structure:`, Object.keys(record));
          invalidRecords.push(index);
          return;
        }
      });

      if (invalidRecords.length > 0) {
        console.error(`[AuthService] ❌ Found ${invalidRecords.length} invalid records at indices:`, invalidRecords);
        throw new Error(`Invalid webhook response: ${invalidRecords.length} record(s) missing required 'id' or user data properties`);
      }

      console.log('[AuthService] ✅ All records have valid structure');
      
      // Step 1.3: Extract and normalize user data from fields or direct properties
      console.log('[AuthService] Step 1.3: Extracting user data...');

      userAccounts = rawWebhookResponse.map((record: any, index: number) => {
        try {
          // Handle both formats:
          // Format 1: { id: "...", fields: { Username: "...", ... } }
          // Format 2: { id: "...", Username: "...", Password: "...", ... }
          const hasFields = record.fields && typeof record.fields === 'object';
          const source = hasFields ? record.fields : record;

          // Extract data from fields (if nested) or directly from record
          const normalized: UserAccount = {
            id: record.id,
            createdTime: record.createdTime || '',
            Username: source.Username || source['Username'] || '',
            Password: source.Password || source['Password'] || '',
            Role: source.Role || source['Role'] || '',
            'Account Status': source['Account Status'] || source.AccountStatus || source.status || 'Unknown',
            'Associated Profile': source['Associated Profile'] || source.AssociatedProfile || source.profile || '',
            'Last Login': source['Last Login'] || source.LastLogin || source.lastLogin || '',
          };
          
          // Validate required fields
          if (!normalized.Username) {
            console.warn(`[AuthService] ⚠️ Record ${index} (id: ${normalized.id}) missing Username field`);
          }
          if (!normalized.Password) {
            console.warn(`[AuthService] ⚠️ Record ${index} (id: ${normalized.id}) missing Password field`);
          }
          if (!normalized.Role) {
            console.warn(`[AuthService] ⚠️ Record ${index} (id: ${normalized.id}) missing Role field`);
          }
          
          return normalized;
        } catch (extractError: any) {
          console.error(`[AuthService] ❌ Failed to extract data from record ${index}:`, extractError.message);
          throw new Error(`Failed to extract user data from record ${index}: ${extractError.message}`);
        }
      });
      
      console.log(`[AuthService] ✅ Successfully extracted ${userAccounts.length} user accounts`);
      
      // Log sample of first account structure for debugging
      if (userAccounts.length > 0) {
        const sampleAccount = userAccounts[0];
        console.log(`[AuthService] Sample account structure:`, {
          id: sampleAccount.id,
          hasUsername: !!sampleAccount.Username,
          hasPassword: !!sampleAccount.Password,
          hasRole: !!sampleAccount.Role,
          hasAccountStatus: !!sampleAccount['Account Status'],
          accountStatus: sampleAccount['Account Status'],
        });
      }
      
    } catch (webhookError: any) {
      console.error('[AuthService] ❌ Failed to fetch or validate user accounts from webhook');
      console.error('[AuthService] Webhook error details:', {
        name: webhookError.name,
        message: webhookError.message,
        stack: webhookError.stack?.split('\n').slice(0, 5),
      });
      
      // Return 401 for authentication-related errors
      if (webhookError.message.includes('No user accounts found') ||
          webhookError.message.includes('Invalid webhook response') ||
          webhookError.message.includes('missing required')) {
        throw new Error('Invalid email or password');
      }
      
      // For connection/timeout errors, throw a more specific error
      if (webhookError.message.includes('timeout') || webhookError.message.includes('timed out')) {
        throw new Error(`Authentication service timeout: ${webhookError.message}`);
      }
      
      throw new Error(`Failed to connect to authentication service: ${webhookError.message}`);
    }

    // Step 2: Find user by email (Username field in Airtable)
    console.log('[AuthService] Step 2: Searching for user by email...');
    console.log('[AuthService] Searching for email:', email.toLowerCase());
    
    const userAccount = userAccounts.find(
      (u) => {
        const username = u.Username || '';
        const match = username.toLowerCase() === email.toLowerCase();
        if (match) {
          console.log(`[AuthService] ✅ Found user account: ${u.id}, Username: ${username}`);
        }
        return match;
      }
    );

    if (!userAccount) {
      console.error('[AuthService] ❌ User not found in database');
      console.error('[AuthService] Searched in', userAccounts.length, 'accounts');
      console.error('[AuthService] Available usernames (first 5):', 
        userAccounts.slice(0, 5).map(u => u.Username || 'N/A').join(', '));
      throw new Error('Invalid email or password');
    }
    
    console.log('[AuthService] ✅ User account found:', userAccount.id);

    // Step 3: Check account status
    console.log('[AuthService] Step 3: Checking account status...');
    const accountStatus = userAccount['Account Status'] || userAccount['Account Status'] || 'Unknown';
    console.log('[AuthService] Account Status:', accountStatus);
    
    if (accountStatus !== 'Active') {
      console.error('[AuthService] ❌ Account is not active. Status:', accountStatus);
      throw new Error('Account is not active');
    }
    console.log('[AuthService] ✅ Account is active');

    // Step 4: Validate password
    console.log('[AuthService] Step 4: Validating password...');
    const storedPassword = userAccount.Password || '';
    
    if (!storedPassword) {
      console.error('[AuthService] ❌ No password found in user account');
      throw new Error('Invalid email or password');
    }
    
    // Check if password is hashed (starts with $2a$ or $2b$) or plaintext
    const isHashed = storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$');
    console.log('[AuthService] Password format:', isHashed ? 'Hashed (bcrypt)' : 'Plaintext');
    
    let isPasswordValid: boolean;
    try {
      if (isHashed) {
        isPasswordValid = await bcrypt.compare(password, storedPassword);
        console.log('[AuthService] Bcrypt comparison result:', isPasswordValid);
      } else {
        isPasswordValid = storedPassword === password;
        console.log('[AuthService] Plaintext comparison result:', isPasswordValid);
      }
    } catch (bcryptError: any) {
      console.error('[AuthService] ❌ Password validation error:', bcryptError.message);
      throw new Error('Invalid email or password');
    }

    if (!isPasswordValid) {
      console.error('[AuthService] ❌ Password validation failed');
      throw new Error('Invalid email or password');
    }
    console.log('[AuthService] ✅ Password validated successfully');

    // Step 5: Validate and normalize role
    console.log('[AuthService] Step 5: Validating and normalizing role...');
    const rawRole = userAccount.Role;
    console.log('[AuthService] Raw role from account:', rawRole);
    
    if (!rawRole || typeof rawRole !== 'string') {
      console.error('[AuthService] ❌ No role assigned to user account');
      throw new Error('User account has no role assigned. Please contact administrator to set a valid role.');
    }

    // Normalize role: trim whitespace, convert to lowercase
    const normalizedRole = rawRole.trim().toLowerCase();
    console.log('[AuthService] Normalized role:', normalizedRole);
    
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
      console.error('[AuthService] ❌ Invalid role:', rawRole);
      throw new Error(
        `Invalid user role: "${rawRole}". Valid roles are: client, kam, credit_team, nbfc. ` +
        `Please contact administrator to update your role.`
      );
    }
    console.log('[AuthService] ✅ Role validated:', role);

    // Step 6: Build auth user object
    console.log('[AuthService] Step 6: Building auth user object...');
    let authUser: AuthUser = {
      id: userAccount.id,
      email: userAccount.Username,
      role,
    };

    // Set default name immediately (don't wait for role data)
    // Role data fetching is now completely non-blocking to prevent Vercel timeouts
    authUser.name = userAccount['Associated Profile'] || email.split('@')[0];
    console.log('[AuthService] Initial user object:', {
      id: authUser.id,
      email: authUser.email,
      role: authUser.role,
      name: authUser.name,
    });

    // Fetch role-specific data in background (completely non-blocking)
    // This ensures login completes immediately even if webhooks are very slow
    // Role data will be fetched after login completes, and can be updated on next request
    // All errors are caught and logged, but don't block login
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
              console.error(`[AuthService] Background client lookup failed for ${email}:`, error.message);
              console.error(`[AuthService] Client lookup error stack:`, error.stack?.split('\n').slice(0, 3));
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
              console.error(`[AuthService] Background KAM lookup failed for ${email}:`, error.message);
              console.error(`[AuthService] KAM lookup error stack:`, error.stack?.split('\n').slice(0, 3));
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
              console.error(`[AuthService] Background Credit lookup failed for ${email}:`, error.message);
              console.error(`[AuthService] Credit lookup error stack:`, error.stack?.split('\n').slice(0, 3));
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
              console.error(`[AuthService] Background NBFC lookup failed for ${email}:`, error.message);
              console.error(`[AuthService] NBFC lookup error stack:`, error.stack?.split('\n').slice(0, 3));
            }
            break;
        }
      } catch (error: any) {
        // Catch any unexpected errors in the background fetch
        console.error(`[AuthService] Background role data fetch failed for ${email}:`, error.message);
        console.error(`[AuthService] Background fetch error stack:`, error.stack?.split('\n').slice(0, 5));
      }
    })().catch((error: any) => {
      // Catch any unhandled promise rejections from the background IIFE
      console.error(`[AuthService] Unhandled error in background role data fetch for ${email}:`, error.message);
      console.error(`[AuthService] Unhandled error stack:`, error.stack?.split('\n').slice(0, 5));
      // Don't throw - this is intentionally non-blocking
    });

    // Update last login (non-blocking - don't wait for it)
    // Wrap in try/catch to ensure errors are properly logged
    (async () => {
      try {
        await n8nClient.postUserAccount({
          id: userAccount.id,
          Username: userAccount.Username,
          Password: userAccount.Password,
          Role: userAccount.Role,
          'Associated Profile': userAccount['Associated Profile'],
          'Last Login': new Date().toISOString(),
          'Account Status': userAccount['Account Status'],
        });
        console.log(`[AuthService] Last login updated successfully for ${email}`);
      } catch (error: any) {
        // Non-critical error - log but don't block login
        console.error(`[AuthService] Failed to update last login for ${email}:`, error.message);
        console.error(`[AuthService] Last login update error stack:`, error.stack?.split('\n').slice(0, 3));
      }
    })().catch((error: any) => {
      // Catch any unhandled promise rejections
      console.error(`[AuthService] Unhandled error updating last login for ${email}:`, error.message);
      console.error(`[AuthService] Unhandled last login error stack:`, error.stack?.split('\n').slice(0, 3));
      // Don't throw - this is intentionally non-blocking
    });

    // Step 7: Generate JWT token
    console.log('[AuthService] Step 7: Generating JWT token...');
    const jwtSecret = authConfig.jwtSecret || 'default-secret';
    const jwtExpiresIn: string = authConfig.jwtExpiresIn || '7d';
    
    console.log('[AuthService] JWT Configuration:', {
      hasSecret: !!jwtSecret,
      secretLength: jwtSecret.length,
      expiresIn: jwtExpiresIn,
    });
    
    // Log the clientId being set in JWT for debugging
    if (authUser.role === 'client') {
      console.log(`[AuthService] Generating JWT for ${authUser.email} with clientId: ${authUser.clientId}`);
    }
    
    // Prepare JWT payload
    const jwtPayload = {
      userId: authUser.id,
      email: authUser.email,
      role: authUser.role,
      clientId: authUser.clientId,
      kamId: authUser.kamId,
      nbfcId: authUser.nbfcId,
    };
    
    console.log('[AuthService] JWT Payload:', {
      userId: jwtPayload.userId,
      email: jwtPayload.email,
      role: jwtPayload.role,
      hasClientId: !!jwtPayload.clientId,
      hasKamId: !!jwtPayload.kamId,
      hasNbfcId: !!jwtPayload.nbfcId,
    });
    
    let token: string;
    try {
      console.log('[AuthService] Calling jwt.sign()...');
      token = jwt.sign(
        jwtPayload,
        jwtSecret,
        { expiresIn: jwtExpiresIn } as jwt.SignOptions
      );
      
      if (!token || token.length === 0) {
        console.error('[AuthService] ❌ JWT sign returned empty token');
        throw new Error('Token generation returned empty result');
      }
      
      console.log('[AuthService] ✅ JWT token generated successfully');
      console.log('[AuthService] Token length:', token.length, 'characters');
      console.log('[AuthService] Token preview:', token.substring(0, 20) + '...');
    } catch (jwtError: any) {
      console.error('[AuthService] ❌ Failed to generate JWT token');
      console.error('[AuthService] JWT Error:', {
        name: jwtError.name,
        message: jwtError.message,
        stack: jwtError.stack?.split('\n').slice(0, 5),
      });
      
      // Check for specific JWT errors
      if (jwtError.message?.includes('secret')) {
        throw new Error('JWT secret configuration error. Please check server configuration.');
      } else if (jwtError.message?.includes('expiresIn')) {
        throw new Error('JWT expiration configuration error. Please check server configuration.');
      } else {
        throw new Error(`Failed to generate authentication token: ${jwtError.message || 'Unknown error'}`);
      }
    }

    console.log('[AuthService] ========== LOGIN SERVICE COMPLETED ==========');
    console.log('[AuthService] Final user object:', {
      id: authUser.id,
      email: authUser.email,
      role: authUser.role,
      name: authUser.name,
      clientId: authUser.clientId || 'N/A',
      kamId: authUser.kamId || 'N/A',
      nbfcId: authUser.nbfcId || 'N/A',
    });

    // Return webhook response for logging purposes (will be redacted in controller)
    // rawWebhookResponse is defined in the outer scope and will be available here
    return { user: authUser, token, webhookResponse: rawWebhookResponse || undefined };
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

