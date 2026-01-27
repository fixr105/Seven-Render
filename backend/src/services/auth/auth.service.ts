/**
 * Authentication Service
 * Handles login, JWT generation, and password validation
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import fetch from 'node-fetch';
import { authConfig } from '../../config/auth.js';
import { UserRole, AccountStatus } from '../../config/constants.js';
import { n8nClient } from '../airtable/n8nClient.js';
import { UserAccount, KAMUser, CreditTeamUser, NBFCPartner } from '../../types/entities.js';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  clientId?: string | null;
  kamId?: string | null;
  nbfcId?: string | null;
  creditTeamId?: string | null;
  name?: string;
}

// Simple in-memory cache for user accounts (5 minute TTL)
interface CachedUserAccounts {
  data: UserAccount[];
  timestamp: number;
}

const USER_ACCOUNTS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let userAccountsCache: CachedUserAccounts | null = null;

export class AuthService {
  /**
   * Get cached user accounts if available and not expired
   */
  private getCachedUserAccounts(): UserAccount[] | null {
    if (userAccountsCache && (Date.now() - userAccountsCache.timestamp) < USER_ACCOUNTS_CACHE_TTL) {
      console.log('[AuthService] ✅ Using cached user accounts');
      return userAccountsCache.data;
    }
    return null;
  }

  /**
   * Cache user accounts
   */
  private setCachedUserAccounts(accounts: UserAccount[]): void {
    userAccountsCache = {
      data: accounts,
      timestamp: Date.now(),
    };
    console.log('[AuthService] ✅ Cached user accounts');
  }

  /**
   * Clear user accounts cache (call after user creation/updates)
   */
  static clearUserAccountsCache(): void {
    userAccountsCache = null;
    console.log('[AuthService] ✅ Cleared user accounts cache');
  }

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
    
    // Step 1: Fetch user accounts from webhook and validate response structure (or use E2E mock)
    let userAccounts: UserAccount[];
    let rawWebhookResponse: any;

    if (process.env.E2E_USE_MOCK_USER_ACCOUNTS === '1') {
      // E2E: use in-memory users matching e2e/helpers/auth.ts TEST_USERS (no n8n webhook)
      const mock: UserAccount[] = [
        { id: 'recE2EClient01', createdTime: '', Username: 'Sagar@gmail.com', Password: 'pass@123', Role: UserRole.CLIENT, 'Account Status': AccountStatus.ACTIVE, 'Associated Profile': 'Sagar', 'Last Login': '' },
        { id: 'recE2EKAM01', createdTime: '', Username: 'Sagar@gmail.com', Password: 'pass@123', Role: UserRole.KAM, 'Account Status': AccountStatus.ACTIVE, 'Associated Profile': 'Sagar', 'Last Login': '' },
        { id: 'recE2ECredit01', createdTime: '', Username: 'Sagar@gmail.com', Password: 'pass@123', Role: UserRole.CREDIT, 'Account Status': AccountStatus.ACTIVE, 'Associated Profile': 'Sagar', 'Last Login': '' },
        { id: 'recE2ENBFC01', createdTime: '', Username: 'Sagar@gmail.com', Password: 'pass@123', Role: UserRole.NBFC, 'Account Status': AccountStatus.ACTIVE, 'Associated Profile': 'Sagar', 'Last Login': '' },
      ];
      userAccounts = mock;
      rawWebhookResponse = undefined;
      console.log('[AuthService] Using E2E mock user accounts (skipping n8n webhook)');
    } else {
      // Check cache first
      const cachedAccounts = this.getCachedUserAccounts();
      if (cachedAccounts) {
        userAccounts = cachedAccounts;
        rawWebhookResponse = undefined;
        console.log('[AuthService] ✅ Using cached user accounts (skipping webhook call)');
      } else {
        console.log('[AuthService] Step 1: Fetching user accounts from webhook...');
        console.log('[AuthService] Webhook URL: /webhook/useraccount');
        console.log('[AuthService] Table: User Accounts');
        try {
          const { n8nEndpoints } = await import('../airtable/n8nEndpoints.js');
          const webhookUrl = n8nEndpoints.get.userAccount;
          console.log('[AuthService] Fetching from:', webhookUrl);

          // Retry configuration
          const MAX_RETRIES = 3;
          const INITIAL_TIMEOUT = 20000; // 20 seconds (increased from 15)
          const RETRY_DELAYS = [1000, 2000, 3000]; // Exponential backoff delays in ms
          
          let lastError: Error | null = null;
          
          for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
              console.log(`[AuthService] Attempt ${attempt}/${MAX_RETRIES} to fetch user accounts...`);
              
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), INITIAL_TIMEOUT);
              
              try {
                const response = await fetch(webhookUrl, {
                  method: 'GET',
                  headers: { 'Content-Type': 'application/json' },
                  signal: controller.signal,
                });
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                  // Retry on 5xx errors, fail fast on 4xx
                  if (response.status >= 500 && attempt < MAX_RETRIES) {
                    console.warn(`[AuthService] ⚠️ Webhook returned ${response.status}, will retry...`);
                    lastError = new Error(`Webhook returned status ${response.status}: ${response.statusText}`);
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt - 1]));
                    continue;
                  }
                  throw new Error(`Webhook returned status ${response.status}: ${response.statusText}`);
                }
                
                const text = await response.text();
                if (!text || text.trim().length === 0) {
                  if (attempt < MAX_RETRIES) {
                    console.warn(`[AuthService] ⚠️ Webhook returned empty body, will retry...`);
                    lastError = new Error('Authentication service returned an empty response.');
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt - 1]));
                    continue;
                  }
                  console.error('[AuthService] ❌ Webhook returned empty body. status:', response.status, 'url:', webhookUrl);
                  throw new Error('Authentication service returned an empty response.');
                }
                
                try {
                  rawWebhookResponse = JSON.parse(text);
                } catch (parseErr: any) {
                  const preview = text.substring(0, 500);
                  const looksLikeHtml = /^\s*</.test(text.trim()) || text.trim().toLowerCase().startsWith('<!');
                  console.error('[AuthService] ❌ Webhook response is not valid JSON:', parseErr?.message || parseErr);
                  console.error('[AuthService] ❌ Response status:', response.status, 'url:', webhookUrl);
                  console.error('[AuthService] ❌ Body preview:', preview + (text.length > 500 ? '...' : ''));
                  if (looksLikeHtml) {
                    console.error('[AuthService] ❌ Body looks like HTML — n8n may be returning an error page. Check n8n workflow is active and /webhook/useraccount exists.');
                  }
                  
                  // Retry on JSON parse errors (might be transient)
                  if (attempt < MAX_RETRIES) {
                    console.warn(`[AuthService] ⚠️ JSON parse error, will retry...`);
                    lastError = new Error('Authentication service temporarily unavailable. Please try again later.');
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt - 1]));
                    continue;
                  }
                  throw new Error('Authentication service temporarily unavailable. Please try again later.');
                }
                
                console.log('[AuthService] ✅ Raw webhook response received');
                break; // Success, exit retry loop
                
              } catch (fetchError: any) {
                clearTimeout(timeoutId);
                if (fetchError.name === 'AbortError') {
                  if (attempt < MAX_RETRIES) {
                    console.warn(`[AuthService] ⚠️ Request timed out, will retry (attempt ${attempt}/${MAX_RETRIES})...`);
                    lastError = new Error('Authentication service timeout: Webhook request timed out. Please try again.');
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt - 1]));
                    continue;
                  }
                  console.error('[AuthService] ❌ Webhook request timed out after all retries');
                  throw new Error('Authentication service timeout: Webhook request timed out. Please try again.');
                }
                
                // Retry on network errors
                if (attempt < MAX_RETRIES && (
                  fetchError.message?.includes('ECONNREFUSED') ||
                  fetchError.message?.includes('ENOTFOUND') ||
                  fetchError.message?.includes('ETIMEDOUT') ||
                  fetchError.message?.includes('network')
                )) {
                  console.warn(`[AuthService] ⚠️ Network error, will retry: ${fetchError.message}`);
                  lastError = fetchError;
                  await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt - 1]));
                  continue;
                }
                
                console.error('[AuthService] ❌ Webhook fetch error:', fetchError.message);
                throw fetchError;
              }
            } catch (attemptError: any) {
              lastError = attemptError;
              if (attempt === MAX_RETRIES) {
                // Last attempt failed, throw the error
                throw attemptError;
              }
              // Continue to next retry
            }
          }
          
          // If we get here without breaking, all retries failed
          if (lastError) {
            throw lastError;
          }
          
            if (!Array.isArray(rawWebhookResponse)) {
              console.error('[AuthService] ❌ Webhook response is not an array');
              throw new Error('Invalid webhook response format: Expected an array of user records');
            }
            if (rawWebhookResponse.length === 0) {
              throw new Error('No user accounts found in database');
            }
            const invalidRecords: number[] = [];
            rawWebhookResponse.forEach((record: any, index: number) => {
              if (!record || typeof record !== 'object') { invalidRecords.push(index); return; }
              if (!record.id || typeof record.id !== 'string') { invalidRecords.push(index); return; }
              const hasFields = record.fields && typeof record.fields === 'object' && record.fields !== null;
              const hasDirectUsername = record.Username && typeof record.Username === 'string';
              if (!hasFields && !hasDirectUsername) invalidRecords.push(index);
            });
            if (invalidRecords.length > 0) {
              throw new Error(`Invalid webhook response: ${invalidRecords.length} record(s) missing required 'id' or user data properties`);
            }
            userAccounts = rawWebhookResponse.map((record: any) => {
              const hasFields = record.fields && typeof record.fields === 'object';
              const source = hasFields ? record.fields : record;
              return {
                id: record.id,
                createdTime: record.createdTime || '',
                Username: source.Username || source['Username'] || '',
                Password: source.Password || source['Password'] || '',
                Role: source.Role || source['Role'] || '',
                'Account Status': source['Account Status'] || source.AccountStatus || source.status || 'Unknown',
                'Associated Profile': source['Associated Profile'] || source.AssociatedProfile || source.profile || '',
                'Last Login': source['Last Login'] || source.LastLogin || source.lastLogin || '',
              } as UserAccount;
            });
            console.log(`[AuthService] ✅ Successfully extracted ${userAccounts.length} user accounts`);
            
            // Cache the successfully fetched accounts
            this.setCachedUserAccounts(userAccounts);
          } catch (webhookError: any) {
        console.error('[AuthService] ❌ Failed to fetch or validate user accounts from webhook after all retries');
        console.error('[AuthService] Webhook error details:', { name: webhookError.name, message: webhookError.message });
        
        // Don't retry these - they're authentication failures, not service issues
        if (webhookError.message?.includes('No user accounts found') || 
            webhookError.message?.includes('Invalid webhook response') || 
            webhookError.message?.includes('missing required')) {
          throw new Error('Invalid email or password');
        }
        
        // Timeout errors - already retried, provide helpful message
        if (webhookError.message?.includes('timeout') || webhookError.message?.includes('timed out')) {
          throw new Error('Unable to connect to authentication service. Please check your internet connection and try again.');
        }
        
        // Network errors - already retried
        if (webhookError.message?.includes('ECONNREFUSED') || 
            webhookError.message?.includes('ENOTFOUND') || 
            webhookError.message?.includes('ETIMEDOUT')) {
          throw new Error('Unable to reach authentication service. Please check your connection and try again.');
        }
        
        // n8n/webhook returned 5xx (503, 502, 504, 500) — already retried
        if (webhookError.message?.match(/Webhook returned status 5\d\d/)) {
          console.error('[AuthService] ❌ Webhook 5xx after all retries — n8n or upstream (Airtable) may be down. Check N8N_BASE_URL and n8n workflow.');
          throw new Error('Authentication service is experiencing issues. Please try again in a few moments.');
        }
        
        // JSON parse errors - already retried
        if (webhookError.message?.includes('Unexpected end of JSON input') ||
            webhookError.message?.includes('Authentication service returned') ||
            (webhookError.name === 'SyntaxError' && webhookError.message?.includes('JSON'))) {
          throw new Error('Authentication service returned invalid data. Please try again.');
        }
        
        // Generic connection errors
        if (webhookError.message?.includes('temporarily unavailable')) {
          throw new Error('Authentication service is temporarily unavailable. Please try again in a few moments.');
        }
        
        // Fallback - provide a user-friendly message
        throw new Error('Unable to connect to authentication service. Please try again in a few moments.');
        } // End of catch block
      } // End of else block (non-mock path)
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

    // E2E mock: set placeholder role IDs so routes that require them don't 401
    if (process.env.E2E_USE_MOCK_USER_ACCOUNTS === '1') {
      if (role === UserRole.CLIENT) authUser.clientId = 'E2E-CLIENT-01';
      if (role === UserRole.KAM) authUser.kamId = 'E2E-KAM-01';
      if (role === UserRole.NBFC) authUser.nbfcId = 'E2E-NBFC-01';
      if (role === UserRole.CREDIT) authUser.creditTeamId = 'E2E-CREDIT-01';
    }

    console.log('[AuthService] Initial user object:', {
      id: authUser.id,
      email: authUser.email,
      role: authUser.role,
      name: authUser.name,
    });

    // Fetch role-specific data in background (completely non-blocking)
    // Skip in E2E mock mode to avoid n8n calls
    if (process.env.E2E_USE_MOCK_USER_ACCOUNTS !== '1') {
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
                authUser.creditTeamId = creditUser['Credit Team ID'] || creditUser.id;
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
      console.error(`[AuthService] Unhandled error in background role data fetch for ${email}:`, error.message);
      // Don't throw - this is intentionally non-blocking
    });
    }

    // Update last login (non-blocking - don't wait for it). Skip in E2E mock mode.
    if (process.env.E2E_USE_MOCK_USER_ACCOUNTS !== '1') {
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
      console.error(`[AuthService] Unhandled error updating last login for ${email}:`, error.message);
      // Don't throw - this is intentionally non-blocking
    });
    }

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
      name: authUser.name,
      clientId: authUser.clientId,
      kamId: authUser.kamId,
      nbfcId: authUser.nbfcId,
      creditTeamId: authUser.creditTeamId,
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
      token = this.generateToken(authUser);
      
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
   * Generate JWT token
   */
  generateToken(user: AuthUser): string {
    const jwtSecret = authConfig.jwtSecret || 'default-secret';
    const jwtExpiresIn: string = authConfig.jwtExpiresIn || '7d';
    
    const jwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      clientId: user.clientId,
      kamId: user.kamId,
      nbfcId: user.nbfcId,
      creditTeamId: user.creditTeamId,
    };
    
    return jwt.sign(
      jwtPayload,
      jwtSecret,
      { expiresIn: jwtExpiresIn } as jwt.SignOptions
    );
  }

  /**
   * Verify JWT token
   */
  async verifyToken(token: string): Promise<AuthUser> {
    try {
      // Check if token is blacklisted
      const { tokenBlacklist } = await import('./tokenBlacklist.service.js');
      if (tokenBlacklist.isBlacklisted(token)) {
        throw new Error('Token has been revoked');
      }

      const decoded = jwt.verify(token, authConfig.jwtSecret) as any;
      return {
        id: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        name: decoded.name,
        clientId: decoded.clientId,
        kamId: decoded.kamId,
        nbfcId: decoded.nbfcId,
        creditTeamId: decoded.creditTeamId,
      };
    } catch (error: any) {
      if (error.message === 'Token has been revoked') {
        throw error;
      }
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Generate refresh token (longer expiration)
   */
  generateRefreshToken(user: AuthUser): string {
    const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '30d';
    return jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        type: 'refresh',
      },
      authConfig.jwtSecret,
      { expiresIn: refreshExpiresIn } as jwt.SignOptions
    );
  }

  /**
   * Verify refresh token
   */
  verifyRefreshToken(token: string): { userId: string; email: string; role: UserRole } {
    try {
      const decoded = jwt.verify(token, authConfig.jwtSecret) as any;
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }
      return {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
      };
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  }

  /**
   * Rotate token (generate new token, blacklist old one)
   */
  async rotateToken(oldToken: string, user: AuthUser): Promise<string> {
    // Blacklist old token
    const { tokenBlacklist } = await import('./tokenBlacklist.service.js');
    try {
      const decoded = jwt.decode(oldToken) as any;
      if (decoded && decoded.exp) {
        tokenBlacklist.addToken(oldToken, decoded.exp, 'rotation');
      }
    } catch (error) {
      // If we can't decode, token is already invalid
    }

    // Generate new token
    return this.generateToken(user);
  }

  /**
   * Hash password
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }
}

export const authService = new AuthService();

