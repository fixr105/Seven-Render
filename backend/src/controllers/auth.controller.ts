/**
 * Authentication Controller
 */

import { Request, Response } from 'express';
import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';
import { authService } from '../services/auth/auth.service.js';
import { authConfig } from '../config/auth.js';
import { n8nClient } from '../services/airtable/n8nClient.js';
import { loginSchema, validateSchema } from '../utils/validators.js';
import { httpPost } from '../utils/httpClient.js';
import { defaultLogger } from '../utils/logger.js';

export class AuthController {
  /**
   * POST /auth/login
   * 
   * Webhook Called:
   * - GET /webhook/useraccount → Airtable: User Accounts
   * 
   * Response Format from webhook:
   * [
   *   {
   *     "id": "recRUcnoAhb3oiPme",
   *     "fields": {
   *       "Username": "user@example.com",
   *       "Password": "...",
   *       "Role": "client",
   *       ...
   *     }
   *   }
   * ]
   */
  /**
   * Helper function to redact sensitive fields from objects
   */
  private redactSensitive(data: any, fieldsToRedact: string[] = ['password', 'Password', 'token', 'Token']): any {
    if (!data || typeof data !== 'object') {
      return data;
    }
    
    const redacted = { ...data };
    for (const field of fieldsToRedact) {
      if (field in redacted) {
        const value = redacted[field];
        if (typeof value === 'string' && value.length > 0) {
          // Show first 4 and last 4 characters, redact the middle
          if (value.length > 8) {
            redacted[field] = `${value.substring(0, 4)}...${value.substring(value.length - 4)}`;
          } else {
            redacted[field] = '***REDACTED***';
          }
        } else {
          redacted[field] = '***REDACTED***';
        }
      }
    }
    return redacted;
  }

  /**
   * Helper function to create structured log entry
   */
  private logStructured(step: string, data: Record<string, any>, email?: string): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      step,
      email: email || 'N/A',
      ...data,
    };
    console.log(`[AuthController] ${step}:`, JSON.stringify(logEntry, null, 2));
  }

  /**
   * Format Zod (or similar) validation errors to a readable string.
   * Avoids surfacing raw JSON like [ { "code": "invalid_string", "message": "Invalid email", "path": ["email"] } ].
   */
  private formatValidationError(validationError: any, fallback: string): string {
    if (!validationError) return fallback;
    // Zod: error.issues[].message
    if (validationError.name === 'ZodError' && Array.isArray(validationError.issues) && validationError.issues.length > 0) {
      const messages = validationError.issues.map((i: any) => i?.message).filter(Boolean);
      return messages.length ? messages.join('. ') : fallback;
    }
    // If message looks like a JSON array, try to extract first .message
    const msg = validationError.message;
    if (typeof msg === 'string' && msg.trim().startsWith('[')) {
      try {
        const arr = JSON.parse(msg);
        if (Array.isArray(arr) && arr[0]?.message) return arr[0].message;
      } catch { /* ignore */ }
    }
    if (typeof msg === 'string' && msg.length > 0 && msg.length < 200) return msg;
    return fallback;
  }

  async login(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const requestId = `REQ-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    this.logStructured('LOGIN_REQUEST_STARTED', {
      requestId,
      timestamp: new Date().toISOString(),
    });
    
    try {
      // Step 1: Validate input
      let email: string;
      let password: string;
      
      try {
        const validated = loginSchema.parse(req.body);
        email = validated.email;
        password = validated.password;
        
        this.logStructured('INPUT_VALIDATION_COMPLETED', {
          requestId,
          email,
          hasPassword: !!password,
        }, email);
      } catch (validationError: any) {
        const errMsg = this.formatValidationError(validationError, 'Email and password are required');
        this.logStructured('INPUT_VALIDATION_FAILED', {
          requestId,
          error: validationError?.message ?? errMsg,
        });
        res.status(400).json({
          success: false,
          error: errMsg.startsWith('Invalid') ? errMsg : 'Invalid input: ' + errMsg,
        });
        return;
      }

      // Step 2: Call auth service to authenticate
      this.logStructured('WEBHOOK_CALL_STARTED', {
        requestId,
        webhookUrl: '/webhook/useraccount',
        email,
      }, email);
      
      let result: { user: any; token: string; webhookResponse?: any };
      try {
        result = await authService.login(email, password);
        
        // Log webhook response (redacted)
        if (result.webhookResponse) {
          const redactedResponse = Array.isArray(result.webhookResponse)
            ? result.webhookResponse.map((record: any) => ({
                id: record.id,
                fields: this.redactSensitive(record.fields || {}),
              }))
            : this.redactSensitive(result.webhookResponse);
          
          this.logStructured('WEBHOOK_CALL_COMPLETED', {
            requestId,
            responseType: Array.isArray(result.webhookResponse) ? 'array' : typeof result.webhookResponse,
            recordCount: Array.isArray(result.webhookResponse) ? result.webhookResponse.length : 1,
            responseBody: redactedResponse,
            email,
          }, email);
        } else {
          this.logStructured('WEBHOOK_CALL_COMPLETED', {
            requestId,
            note: 'Webhook response not available for logging',
            email,
          }, email);
        }
        
        // Log user extraction
        this.logStructured('USER_EXTRACTED', {
          requestId,
          userId: result.user.id,
          userRole: result.user.role,
          userEmail: result.user.email,
          clientId: result.user.clientId || 'N/A',
          kamId: result.user.kamId || 'N/A',
          nbfcId: result.user.nbfcId || 'N/A',
          userName: result.user.name || 'N/A',
          email,
        }, email);
        
        // Log token creation
        const tokenPreview = result.token 
          ? `${result.token.substring(0, 20)}...${result.token.substring(result.token.length - 10)}`
          : 'N/A';
        
        this.logStructured('TOKEN_CREATED', {
          requestId,
          tokenLength: result.token?.length || 0,
          tokenPreview: tokenPreview,
          hasToken: !!result.token,
          email,
        }, email);
        
      } catch (authError: any) {
        console.error('[AuthController] ❌ Authentication failed:', authError.message);
        
        // Determine status code based on error type
        let statusCode = 401;
        let errorMessage = authError.message || 'Login failed';

        if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
          statusCode = 504; // Gateway Timeout
          errorMessage = 'Login request timed out. Please check your connection and try again.';
          console.error('[AuthController] Timeout error detected, returning 504');
        } else if (errorMessage.includes('webhook') && errorMessage.includes('timeout')) {
          statusCode = 504;
          errorMessage = 'Unable to connect to authentication service. Please try again in a moment.';
          console.error('[AuthController] Webhook timeout error detected, returning 504');
        } else if (
          errorMessage.includes('temporarily unavailable') ||
          errorMessage.includes('experiencing issues') ||
          errorMessage.includes('Unable to connect to authentication service') ||
          errorMessage.includes('Unable to reach authentication service') ||
          errorMessage.includes('returned invalid data')
        ) {
          statusCode = 503; // Service Unavailable — auth provider (n8n) returned invalid/empty data
          // Keep the improved error message from auth service
          console.error('[AuthController] Auth provider error after retries, returning 503');
        } else if (
          errorMessage.includes('Invalid email or password') || 
          errorMessage.includes('Account is not active') ||
          errorMessage.includes('no role assigned') ||
          errorMessage.includes('Invalid webhook response') ||
          errorMessage.includes('No user accounts found') ||
          errorMessage.includes('missing required') ||
          errorMessage.includes('malformed') ||
          (errorMessage.includes('empty') && !errorMessage.includes('Authentication service returned'))
        ) {
          statusCode = 401; // Unauthorized
          // Provide helpful error message for validation failures
          if (errorMessage.includes('Invalid webhook response') || 
              errorMessage.includes('missing required') ||
              errorMessage.includes('malformed') ||
              (errorMessage.includes('empty') && !errorMessage.includes('Authentication service returned'))) {
            errorMessage = 'Invalid email or password';
          }
          console.error('[AuthController] Invalid credentials, validation error, or account issue, returning 401');
        } else {
          statusCode = 500; // Internal Server Error for unexpected errors
          console.error('[AuthController] Unexpected error, returning 500');
        }

        const duration = Date.now() - startTime;
        
        this.logStructured('LOGIN_FAILED', {
          requestId,
          duration: `${duration}ms`,
          statusCode,
          error: errorMessage,
          email,
        }, email);
        
        res.status(statusCode).json({
          success: false,
          error: errorMessage,
        });
        return;
      }

      // Step 3: Set JWT as secure HTTP-only cookie
      console.log('[AuthController] Step 3: Setting JWT as secure HTTP-only cookie...');
      try {
        if (!result.token) {
          console.error('[AuthController] ❌ No token in result object');
          throw new Error('Token generation failed: No token received from auth service');
        }

        // Calculate cookie expiration (7 days default, or match JWT expiration)
        const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';
        let maxAge: number;
        
        // Parse JWT expiration string to milliseconds
        if (jwtExpiresIn.endsWith('d')) {
          const days = parseInt(jwtExpiresIn.slice(0, -1), 10);
          maxAge = days * 24 * 60 * 60 * 1000; // Convert days to milliseconds
        } else if (jwtExpiresIn.endsWith('h')) {
          const hours = parseInt(jwtExpiresIn.slice(0, -1), 10);
          maxAge = hours * 60 * 60 * 1000; // Convert hours to milliseconds
        } else if (jwtExpiresIn.endsWith('m')) {
          const minutes = parseInt(jwtExpiresIn.slice(0, -1), 10);
          maxAge = minutes * 60 * 1000; // Convert minutes to milliseconds
        } else {
          // Default to 7 days if format is unrecognized
          maxAge = 7 * 24 * 60 * 60 * 1000;
        }

        // Determine if we should use secure cookies (HTTPS only)
        // Use secure cookies in production, but allow http in development
        const isProduction = process.env.NODE_ENV === 'production';
        const isSecure = isProduction || process.env.USE_SECURE_COOKIES === 'true';

        // Set cookie options
        const cookieOptions = {
          httpOnly: true, // Prevents JavaScript access (XSS protection)
          secure: isSecure, // HTTPS only in production
          sameSite: 'lax' as const, // CSRF protection (lax allows same-site navigation)
          maxAge: maxAge, // Cookie expiration matches JWT expiration
          path: '/', // Available on all paths
        };

        console.log('[AuthController] Cookie options:', {
          httpOnly: cookieOptions.httpOnly,
          secure: cookieOptions.secure,
          sameSite: cookieOptions.sameSite,
          maxAge: `${maxAge / 1000 / 60 / 60 / 24} days`,
          path: cookieOptions.path,
        });

        // Set the cookie
        res.cookie('auth_token', result.token, cookieOptions);
        console.log('[AuthController] ✅ Cookie set successfully');
        console.log('[AuthController] Token length:', result.token.length, 'characters');
        
      } catch (cookieError: any) {
        console.error('[AuthController] ❌ Failed to set cookie:', cookieError.message);
        console.error('[AuthController] Cookie error stack:', cookieError.stack);
        
        const duration = Date.now() - startTime;
        console.log(`[AuthController] Login failed after ${duration}ms due to cookie error`);
        console.log('[AuthController] ========== LOGIN REQUEST ENDED (COOKIE ERROR) ==========');
        
        // Return 500 error if cookie setting fails
        res.status(500).json({
          success: false,
          error: 'Failed to set authentication cookie. Please try again.',
        });
        return;
      }

      // Step 4: Return success response
      const duration = Date.now() - startTime;
      
      // Log response sent (redact token from log)
      const responseData = {
        user: {
          id: result.user.id,
          email: result.user.email,
          role: result.user.role,
          clientId: result.user.clientId || 'N/A',
          kamId: result.user.kamId || 'N/A',
          nbfcId: result.user.nbfcId || 'N/A',
          name: result.user.name || 'N/A',
        },
        token: '***REDACTED***', // Token is in cookie, redact from logs
      };
      
      this.logStructured('RESPONSE_SENT', {
        requestId,
        statusCode: 200,
        duration: `${duration}ms`,
        responseData,
        email,
      }, email);
      
      // Return user data (token is in cookie, but also include it in response for compatibility)
      // Ensure all profile IDs are explicitly included (even if null)
      res.status(200).json({
        success: true,
        data: {
          user: {
            id: result.user.id,
            email: result.user.email,
            role: result.user.role,
            name: result.user.name || null,
            clientId: result.user.clientId || null,
            kamId: result.user.kamId || null,
            nbfcId: result.user.nbfcId || null,
            creditTeamId: result.user.creditTeamId || null,
          },
          token: result.token, // Still include in response for clients that need it
        },
      });
      return;
      
    } catch (error: any) {
      // Catch-all for any unexpected errors
      const duration = Date.now() - startTime;
      const email = (req.body as any)?.email || 'unknown';
      
      this.logStructured('LOGIN_ERROR', {
        requestId,
        duration: `${duration}ms`,
        error: error.message || 'Unknown error',
        errorType: error.name || 'Error',
        stack: error.stack?.split('\n').slice(0, 3) || [],
        email,
      }, email);
      
      // Ensure we always return a response
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'Internal server error during login. Please try again.',
        });
      }
      return;
    }
  }

  /**
   * GET /auth/me
   */
  async getMe(req: Request, res: Response): Promise<void> {
    try {
      // Step 1: Verify user is authenticated
      if (!req.user) {
        console.error('[AuthController] getMe: User not authenticated');
        res.status(401).json({
          success: false,
          error: 'Not authenticated',
        });
        return;
      }

      // SECURITY: Reject any test users from JWT token
      const userEmail = req.user.email?.toLowerCase().trim() || '';
      const isTestUser = userEmail === 'test@example.com' || 
          userEmail.includes('test@') || 
          (req.user.name === 'Test User' && req.user.role === 'client') ||
          req.user.id === 'test-user-123';
      
      if (isTestUser) {
        console.error('[AuthController] getMe: Test user detected in JWT token, rejecting', {
          email: req.user.email,
          name: req.user.name,
          role: req.user.role,
          id: req.user.id,
        });
        res.status(401).json({
          success: false,
          error: 'Invalid authentication. Please log out and log in again.',
        });
        return;
      }

      // CRITICAL: Verify user exists in User Accounts table and is Active
      try {
        const userAccounts = await n8nClient.fetchTable('User Accounts', false, undefined, 5000);
        const realUser = userAccounts.find((u: any) => {
          const accountEmail = (u['Username'] || u['Email'] || '').toLowerCase().trim();
          return accountEmail === userEmail;
        });
        
        if (!realUser) {
          console.error('[AuthController] getMe: User from JWT not found in User Accounts table', {
            email: req.user.email,
          });
          res.status(401).json({
            success: false,
            error: 'User account not found. Please log out and log in again.',
          });
          return;
        }
        
        // Check account status
        const accountStatus = (realUser['Account Status'] || realUser.AccountStatus || '').toLowerCase().trim();
        if (accountStatus !== 'active') {
          console.error('[AuthController] getMe: User account is not active', {
            email: req.user.email,
            status: accountStatus,
          });
          res.status(401).json({
            success: false,
            error: `Account is not active. Current status: ${realUser['Account Status'] || accountStatus}. Please contact administrator.`,
          });
          return;
        }
        
        // Update req.user with verified data from User Accounts
        req.user.email = realUser['Username'] || realUser['Email'];
        req.user.id = realUser.id;
        req.user.role = realUser['Role'] || realUser.role;
        console.log('[AuthController] getMe: User verified in User Accounts table', {
          email: req.user.email,
          id: req.user.id,
          role: req.user.role,
        });
      } catch (verifyError: any) {
        console.error('[AuthController] getMe: Failed to verify user in User Accounts table', {
          error: verifyError.message,
        });
        res.status(401).json({
          success: false,
          error: 'Unable to verify user. Please log out and log in again.',
        });
        return;
      }

      console.log('[AuthController] getMe: Fetching user info for:', req.user.email);

      // Step 2: Get name from JWT token first, then fallback to email
      let name = req.user.name || req.user.email.split('@')[0];

      // Step 3: Try to get name from role-specific table (with error handling)
      try {
        if (req.user.role === 'kam') {
          console.log('[AuthController] getMe: Fetching KAM Users table...');
          try {
            const kamUsers = await n8nClient.fetchTable('KAM Users', true, undefined, 5000);
            const kamUser = kamUsers.find((k) => k.id === req.user.kamId);
            if (kamUser) {
              name = kamUser.Name || name;
              console.log('[AuthController] getMe: Found KAM user name:', name);
            } else {
              console.warn('[AuthController] getMe: KAM user not found in table');
            }
          } catch (kamError: any) {
            console.error('[AuthController] getMe: Failed to fetch KAM Users:', kamError.message);
            // Continue with default name - don't fail the request
          }
        } else if (req.user.role === 'credit_team') {
          console.log('[AuthController] getMe: Fetching Credit Team Users table...');
          try {
            const creditUsers = await n8nClient.fetchTable('Credit Team Users', true, undefined, 5000);
            // Use case-insensitive comparison to match login flow behavior
            const creditUser = creditUsers.find((c) => 
              c.id === req.user.creditTeamId || 
              c.Email?.toLowerCase() === req.user.email?.toLowerCase()
            );
            if (creditUser) {
              name = creditUser.Name || name;
              console.log('[AuthController] getMe: Found Credit user name:', name);
            } else {
              console.warn('[AuthController] getMe: Credit user not found in table');
            }
          } catch (creditError: any) {
            console.error('[AuthController] getMe: Failed to fetch Credit Team Users:', creditError.message);
            // Continue with default name - don't fail the request
          }
        }
      } catch (roleDataError: any) {
        console.error('[AuthController] getMe: Error fetching role-specific data:', roleDataError.message);
        // Continue with default name - don't fail the request
      }

      // Step 4: Return user data
      console.log('[AuthController] getMe: Returning user data');
      res.status(200).json({
        success: true,
        data: {
          id: req.user.id,
          email: req.user.email,
          role: req.user.role,
          clientId: req.user.clientId,
          kamId: req.user.kamId,
          nbfcId: req.user.nbfcId,
          creditTeamId: req.user.creditTeamId,
          name,
        },
      });
      return;
    } catch (error: any) {
      // Catch-all for any unexpected errors
      console.error('[AuthController] getMe: Unexpected error:', error);
      console.error('[AuthController] getMe: Error stack:', error.stack);
      
      // Ensure we always return a response
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: error.message || 'Failed to get user info',
        });
      }
      return;
    }
  }

  /**
   * POST /auth/validate
   * 
   * Proxies username/passcode validation to n8n webhook
   * This endpoint eliminates CORS issues by handling the n8n call server-side
   * 
   * Request Body:
   * {
   *   username: string
   *   passcode: string
   * }
   * 
   * Response:
   * {
   *   success: boolean
   *   user?: { ... }
   *   error?: string
   * }
   */
  async validate(req: Request, res: Response): Promise<void> {
    const requestId = `VALIDATE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    this.logStructured('VALIDATE_REQUEST_STARTED', {
      requestId,
      timestamp: new Date().toISOString(),
    });
    
    try {
      // Validate input with schema
      let username: string;
      let passcode: string;
      
      try {
        const validated = validateSchema.parse(req.body);
        username = validated.username;
        passcode = validated.passcode;
        
        this.logStructured('VALIDATE_INPUT_VALIDATION_COMPLETED', {
          requestId,
          username,
          hasPasscode: !!passcode,
        });
      } catch (validationError: any) {
        const errMsg = this.formatValidationError(validationError, 'Username and passcode are required');
        this.logStructured('VALIDATE_INPUT_VALIDATION_FAILED', {
          requestId,
          error: validationError?.message ?? errMsg,
        });
        res.status(400).json({
          success: false,
          error: errMsg.startsWith('Invalid') ? errMsg : 'Invalid input: ' + errMsg,
        });
        return;
      }

      // IMPORTANT: Do NOT call the n8n /webhook/validate at all.
      // It has been observed to return fallback test users (e.g., test@example.com),
      // causing cross-login. Instead, treat passcode like password and use the
      // exact same auth flow as /auth/login (User Accounts table + bcrypt + JWT).
      const result = await authService.login(username, passcode);
      
      this.logStructured('VALIDATE_SUCCESS', {
        requestId,
        username,
        userId: result.user.id,
        role: result.user.role,
      });
      
      // Ensure all profile IDs are explicitly included (even if null)
      res.status(200).json({
        success: true,
        data: {
          user: {
            id: result.user.id,
            email: result.user.email,
            role: result.user.role,
            name: result.user.name || null,
            clientId: result.user.clientId || null,
            kamId: result.user.kamId || null,
            nbfcId: result.user.nbfcId || null,
            creditTeamId: result.user.creditTeamId || null,
          },
          token: result.token,
        },
      });
      return;
    } catch (error: any) {
      const errorMessage = error.message || 'Validation failed';
      let statusCode = 500;
      if (errorMessage.includes('Invalid email or password') ||
          errorMessage.includes('Account is not active') ||
          errorMessage.includes('not found') ||
          errorMessage.includes('Invalid username or passcode')) {
        statusCode = 401;
      } else if (errorMessage.includes('temporarily unavailable') ||
                 errorMessage.includes('timeout') ||
                 errorMessage.includes('Unable to connect')) {
        statusCode = 503;
      }
      try {
        this.logStructured('VALIDATE_ERROR', {
          requestId,
          username: (typeof username !== 'undefined' ? username : ''),
          error: errorMessage,
        });
      } catch (_) { /* ignore */ }
      if (!res.headersSent) {
        res.status(statusCode).json({ success: false, error: errorMessage });
      }
      return;
    }
  }

  /**
   * POST /auth/refresh
   * Refresh access token using refresh token
   */
  async refresh(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({
          success: false,
          error: 'Refresh token is required',
        });
        return;
      }

      // Verify refresh token
      const tokenData = authService.verifyRefreshToken(refreshToken);
      
      // Get user data (simplified - in production, fetch from database)
      const user: any = {
        id: tokenData.userId,
        email: tokenData.email,
        role: tokenData.role,
      };

      // Generate new access token
      const newToken = authService.generateToken(user);

      res.json({
        success: true,
        token: newToken,
        user,
      });
    } catch (error: any) {
      console.error('[AuthController] Refresh error:', error);
      
      res.status(401).json({
        success: false,
        error: error.message || 'Invalid refresh token',
      });
    }
  }

  /**
   * POST /auth/logout
   * Logout user by blacklisting token
   */
  async logout(req: Request, res: Response): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        
        // Decode token to get expiration
        const decoded = jwt.decode(token) as any;
        if (decoded && decoded.exp) {
          const { tokenBlacklist } = await import('../services/auth/tokenBlacklist.service.js');
          tokenBlacklist.addToken(token, decoded.exp, 'logout');
        }
      }

      res.json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Logout failed',
      });
    }
  }
}

export const authController = new AuthController();

