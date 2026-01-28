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
      res.status(200).json({
        success: true,
        data: {
          user: result.user,
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

      // Get n8n base URL from environment (required)
      if (!process.env.N8N_BASE_URL) {
        this.logStructured('VALIDATE_N8N_BASE_URL_MISSING', {
          requestId,
          error: 'N8N_BASE_URL environment variable is required',
        });
        defaultLogger.error('N8N_BASE_URL environment variable is missing', {
          requestId,
          envKeys: Object.keys(process.env).filter(k => k.includes('N8N')),
        });
        res.status(500).json({
          success: false,
          error: 'Server configuration error: N8N_BASE_URL not configured',
        });
        return;
      }
      const n8nBaseUrl = process.env.N8N_BASE_URL.trim();
      const validateUrl = `${n8nBaseUrl}/webhook/validate`;
      
      // Log detailed webhook configuration
      defaultLogger.info('VALIDATE: Webhook configuration', {
        requestId,
        n8nBaseUrl,
        validateUrl,
        n8nBaseUrlLength: n8nBaseUrl.length,
        validateUrlLength: validateUrl.length,
        username,
        envVarSet: !!process.env.N8N_BASE_URL,
      });
      
      this.logStructured('VALIDATE_N8N_WEBHOOK_CALL_STARTED', {
        requestId,
        n8nBaseUrl,
        validateUrl,
        username,
      });

        // Use resilient HTTP client with retry logic and circuit breaker
      try {
        // Proxy the request to n8n webhook (server-to-server, no CORS issues)
        // Using httpPost with retry logic and circuit breaker for better reliability
        const payload = {
          username,
          passcode,
        };
        
        defaultLogger.info('VALIDATE: Making webhook call', {
          requestId,
          validateUrl,
          payload: { username, passcode: '***REDACTED***' },
          timestamp: new Date().toISOString(),
        });
        
        this.logStructured('VALIDATE_HTTP_POST_CALL', {
          requestId,
          validateUrl,
          payload: { username, passcode: '***' },
        });
        
        const webhookStartTime = Date.now();
        const response = await httpPost(
          validateUrl,
          payload,
          {},
          {
            maxRetries: 0, // No retries for validate - must complete quickly
            retryDelay: 1000,
            retryOn: [408, 429, 500, 502, 503, 504],
            timeout: 45000, // 45 seconds timeout for n8n webhook (Fly.io has no 30s limit)
          }
        );
        
        const webhookDuration = Date.now() - webhookStartTime;
        defaultLogger.info('VALIDATE: Webhook call completed', {
          requestId,
          validateUrl,
          status: response.status,
          statusText: response.statusText,
          duration: `${webhookDuration}ms`,
          headers: Object.fromEntries(response.headers.entries()),
        });

        this.logStructured('VALIDATE_HTTP_POST_SUCCESS', {
          requestId,
          status: response.status,
          statusText: response.statusText,
        });

        // Read body once (avoids "Unexpected end of JSON input" when n8n returns empty/non-JSON)
        const text = await response.text();

        // Check if response is ok
        if (!response.ok) {
          let errorData: any = { error: 'Unknown error' };
          if (text?.trim()) {
            try {
              errorData = JSON.parse(text);
            } catch {
              /* keep default */
            }
          }
          this.logStructured('VALIDATE_N8N_WEBHOOK_FAILED', {
            requestId,
            status: response.status,
            statusText: response.statusText,
            error: errorData?.error || errorData?.message || 'Unknown error',
          });
          res.status(response.status).json({
            success: false,
            error: errorData?.error || errorData?.message || 'Validation failed',
          });
          return;
        }

        // Parse n8n response (empty or invalid JSON → 503)
        let rawData: any = null;
        if (!text || !text.trim()) {
          defaultLogger.error('VALIDATE: Webhook returned empty body', {
            requestId,
            validateUrl,
            responseStatus: response.status,
          });
          res.status(503).json({
            success: false,
            error: 'Authentication service temporarily unavailable. Please try again later.',
          });
          return;
        }
        try {
          rawData = JSON.parse(text);
        } catch (parseErr: any) {
          const preview = text.substring(0, 500);
          const looksLikeHtml = /^\s*</.test(text.trim()) || text.trim().toLowerCase().startsWith('<!');
          defaultLogger.error('VALIDATE: Webhook response is not valid JSON', {
            requestId,
            validateUrl,
            responseStatus: response.status,
            error: parseErr?.message,
            preview,
          });
          if (looksLikeHtml) {
            defaultLogger.error('VALIDATE: Body looks like HTML — n8n may be returning an error page. Check /webhook/validate exists and the n8n workflow is active.', { requestId });
          }
          res.status(503).json({
            success: false,
            error: 'Authentication service temporarily unavailable. Please try again later.',
          });
          return;
        }
        
        this.logStructured('VALIDATE_N8N_WEBHOOK_RESPONSE', {
          requestId,
          isArray: Array.isArray(rawData),
          responseType: typeof rawData,
          responseKeys: Array.isArray(rawData) ? 'array' : Object.keys(rawData || {}),
        });

        // Handle different response formats from n8n
        let profileData: any = null;
        
        // Format 1: Array with output field (can be object or JSON string)
        // [ { "output": { "username": "Sagar", "role": "kam", "kam_id": "...", ... } } ]
        // or [ { "output": "{\"username\": \"Sagar\", ...}" } ]
        if (Array.isArray(rawData) && rawData.length > 0 && rawData[0]?.output) {
          try {
            const outputValue = rawData[0].output;
            
            // Handle both object and string formats
            if (typeof outputValue === 'string') {
              profileData = JSON.parse(outputValue);
            } else if (typeof outputValue === 'object' && outputValue !== null) {
              profileData = outputValue;
            } else {
              throw new Error('Invalid output format: expected object or JSON string');
            }
            
            // Map snake_case fields to camelCase for consistency
            if (profileData) {
              profileData.username = profileData.username || profileData.Username;
              profileData.role = profileData.role || profileData.Role;
              profileData.name = profileData.associated_profile || profileData['Associated profile'] || profileData.name || profileData.Name;
              
              // Map snake_case IDs to camelCase
              if (profileData.kam_id !== undefined) profileData.kamId = profileData.kam_id;
              if (profileData.client_id !== undefined) profileData.clientId = profileData.client_id;
              if (profileData.nbfc_id !== undefined) profileData.nbfcId = profileData.nbfc_id;
              if (profileData.credit_team_id !== undefined) profileData.creditTeamId = profileData.credit_team_id;
              
              this.logStructured('VALIDATE_PARSED_OUTPUT', {
                requestId,
                username: profileData.username,
                role: profileData.role,
                kamId: profileData.kamId || profileData.kam_id,
                clientId: profileData.clientId || profileData.client_id,
                nbfcId: profileData.nbfcId || profileData.nbfc_id,
                creditTeamId: profileData.creditTeamId || profileData.credit_team_id,
                associatedProfile: profileData.name,
              });
            }
          } catch (parseError: any) {
            console.error('[AuthController] Failed to parse output JSON:', parseError);
            defaultLogger.error('Failed to parse n8n webhook output', {
              requestId,
              error: parseError.message,
              outputType: typeof rawData[0]?.output,
            });
            res.status(500).json({
              success: false,
              error: 'Invalid response format from authentication service.',
            });
            return;
          }
        }
        // Format 2: Direct object with success/user fields
        else if (rawData?.success && rawData?.user) {
          profileData = rawData.user;
        }
        // Format 3: Direct object with user fields
        else if (rawData?.username || rawData?.role) {
          profileData = rawData;
        }

        // Check if webhook returned test data (indicating it didn't find the real user)
        const isTestData = profileData && (
          profileData.id === 'test-user-123' ||
          profileData.email === 'test@example.com' ||
          profileData.username === 'test' ||
          (profileData.name === 'Test User' && profileData.role === 'client')
        );

        // If webhook returned test data, fetch real user from Airtable
        if (isTestData) {
          defaultLogger.warn('VALIDATE: Webhook returned test data, fetching real user from Airtable', {
            requestId,
            username,
            webhookResponse: profileData,
          });
          
          try {
            // Fetch User Accounts to find the real user
            const userAccounts = await n8nClient.fetchTable('User Accounts', true, undefined, 5000);
            const realUserAccount = userAccounts.find((u: any) => {
              const accountUsername = (u['Username'] || u['Email'] || '').toLowerCase();
              const accountName = (u['Name'] || u['Associated profile'] || '').toLowerCase();
              const searchUsername = username.toLowerCase();
              return accountUsername === searchUsername ||
                     accountName === searchUsername ||
                     accountUsername.includes(searchUsername) ||
                     accountName.includes(searchUsername);
            });
            
            if (realUserAccount) {
              defaultLogger.info('VALIDATE: Found real user in Airtable', {
                requestId,
                userId: realUserAccount.id,
                username: realUserAccount['Username'] || realUserAccount['Email'],
                role: realUserAccount['Role'],
              });
              
              // Use real user data instead of test data
              profileData = {
                id: realUserAccount.id,
                username: realUserAccount['Username'] || realUserAccount['Email'],
                email: realUserAccount['Email'] || realUserAccount['Username'],
                role: realUserAccount['Role'],
                name: realUserAccount['Name'] || realUserAccount['Associated profile'] || realUserAccount['Username'],
                'Associated profile': realUserAccount['Associated profile'] || realUserAccount['Name'],
              };
            } else {
              defaultLogger.warn('VALIDATE: Real user not found in Airtable, rejecting test data', {
                requestId,
                username,
              });
              // REJECT test data - do not allow login with test users
              profileData = null;
            }
          } catch (fetchError: any) {
            defaultLogger.error('VALIDATE: Failed to fetch real user from Airtable', {
              requestId,
              error: fetchError.message,
            });
            // REJECT test data on error - do not allow login
            profileData = null;
          }
        }

        // STRICT: Reject any test data that wasn't replaced with real user
        if (profileData && isTestData) {
          defaultLogger.error('VALIDATE: Test data detected and not replaced, rejecting authentication', {
            requestId,
            username,
            profileData,
          });
          res.status(401).json({
            success: false,
            error: 'Invalid username or passcode. Test users are not allowed.',
          });
          return;
        }

        // STRICT: Always use User Accounts table directly - ignore webhook response
        // This ensures we never use test data from the webhook
        try {
          const userAccounts = await n8nClient.fetchTable('User Accounts', false, undefined, 5000);
          const realUser = userAccounts.find((u: any) => {
            const accountEmail = (u['Username'] || u['Email'] || '').toLowerCase().trim();
            const accountName = (u['Associated Profile'] || u['Name'] || '').toLowerCase().trim();
            const searchUsername = username.toLowerCase().trim();
            return accountEmail === searchUsername || accountName === searchUsername;
          });
          
          if (!realUser) {
            defaultLogger.error('VALIDATE: User not found in User Accounts table', {
              requestId,
              username,
            });
            res.status(401).json({
              success: false,
              error: 'Invalid username or passcode. User not found in system.',
            });
            return;
          }
          
          // Check account status
          const accountStatus = (realUser['Account Status'] || realUser.AccountStatus || '').toLowerCase().trim();
          if (accountStatus !== 'active') {
            defaultLogger.error('VALIDATE: User account is not active', {
              requestId,
              username,
              status: accountStatus,
            });
            res.status(401).json({
              success: false,
              error: `Account is not active. Current status: ${realUser['Account Status'] || accountStatus}. Please contact administrator.`,
            });
            return;
          }
          
          // Use real user data from User Accounts table (ignore webhook response)
          profileData = {
            id: realUser.id,
            username: realUser['Username'] || realUser['Email'],
            email: realUser['Username'] || realUser['Email'],
            role: realUser['Role'] || realUser.role,
            name: realUser['Associated Profile'] || realUser['Name'] || realUser['Username'],
            'Associated profile': realUser['Associated Profile'] || realUser['Name'],
          };
          
          defaultLogger.info('VALIDATE: Using user from User Accounts table (webhook ignored)', {
            requestId,
            userId: realUser.id,
            email: profileData.email,
            role: profileData.role,
          });
        } catch (verifyError: any) {
          defaultLogger.error('VALIDATE: Failed to fetch user from User Accounts table', {
            requestId,
            error: verifyError.message,
          });
          res.status(401).json({
            success: false,
            error: 'Unable to verify user. Please try again.',
          });
          return;
        }

        // If we have profile data, proceed with authentication
        if (profileData && (profileData.username || profileData.role)) {
          // Extract user data from profile data (handle both camelCase and snake_case)
          const userEmail = profileData.email || profileData.username || username;
          const userRole = profileData.role || 'client';
          const userName = profileData['Associated profile'] || profileData.associated_profile || profileData.name || profileData.username || username;
          
          // Map role to valid role format
          const roleMap: Record<string, string> = {
            'kam': 'kam',
            'client': 'client',
            'credit_team': 'credit_team',
            'credit team': 'credit_team',
            'nbfc': 'nbfc',
          };
          const normalizedRole = roleMap[userRole.toLowerCase()] || 'client';
          
          // Extract IDs from webhook response (prefer camelCase, fallback to snake_case)
          // Only one ID should be set based on the user's role
          let clientId: string | null = null;
          let kamId: string | null = null;
          let nbfcId: string | null = null;
          let creditTeamId: string | null = null;
          
          // Set the appropriate ID based on role - only one ID should be present
          if (normalizedRole === 'client') {
            clientId = profileData.clientId || profileData.client_id || null;
          } else if (normalizedRole === 'kam') {
            kamId = profileData.kamId || profileData.kam_id || null;
          } else if (normalizedRole === 'nbfc') {
            nbfcId = profileData.nbfcId || profileData.nbfc_id || null;
          } else if (normalizedRole === 'credit_team') {
            creditTeamId = profileData.creditTeamId || profileData.credit_team_id || null;
          }
          
          // Ensure only one ID is set - if multiple are provided, use the one matching the role
          const hasIdFromWebhook = !!(clientId || kamId || nbfcId || creditTeamId);
          
          defaultLogger.info('VALIDATE: Extracted ID from webhook', {
            requestId,
            username,
            role: normalizedRole,
            clientId,
            kamId,
            nbfcId,
            creditTeamId,
            hasIdFromWebhook,
          });
          
          try {
            // Only fetch from Airtable if ID wasn't provided by webhook
            if (!hasIdFromWebhook && !isTestData) {
              // Fetch User Accounts to get full profile
              const userAccounts = await n8nClient.fetchTable('User Accounts', true, undefined, 5000);
              const userAccount = userAccounts.find((u: any) => {
                const accountUsername = (u['Username'] || u['Email'] || '').toLowerCase();
                const accountName = (u['Name'] || u['Associated profile'] || '').toLowerCase();
                return accountUsername === userEmail.toLowerCase() || 
                       accountUsername === username.toLowerCase() ||
                       accountName === userName.toLowerCase();
              });
              
              if (userAccount) {
                defaultLogger.info('VALIDATE: Found user account', {
                  requestId,
                  userId: userAccount.id,
                  username: userAccount['Username'] || userAccount['Email'],
                });
              
                // Based on role, fetch additional data to get IDs (only if not provided by webhook)
                if (normalizedRole === 'client' && !clientId) {
                  // Fetch Clients table to find clientId
                  try {
                    const clients = await n8nClient.fetchTable('Clients', true, undefined, 5000);
                    const client = clients.find((c: any) => {
                      const contactInfo = (c['Contact Email / Phone'] || c['Contact Email'] || c['Email'] || '').toLowerCase();
                      const clientName = (c['Client Name'] || '').toLowerCase();
                      return contactInfo.includes(userEmail.toLowerCase()) ||
                             contactInfo.includes(username.toLowerCase()) ||
                             clientName === userName.toLowerCase();
                    });
                    
                    if (client) {
                      clientId = client['Client ID'] || client.id || null;
                      defaultLogger.info('VALIDATE: Found client ID', {
                        requestId,
                        clientId,
                        clientName: client['Client Name'],
                      });
                    }
                  } catch (clientError: any) {
                    defaultLogger.warn('VALIDATE: Failed to fetch client ID', {
                      requestId,
                      error: clientError.message,
                    });
                  }
                } else if (normalizedRole === 'kam' && !kamId) {
                  // Fetch KAM Users table to find kamId (only if not provided by webhook)
                  try {
                    const kamUsers = await n8nClient.fetchTable('KAM Users', true, undefined, 5000);
                    const kamUser = kamUsers.find((k: any) => {
                      const kamEmail = (k['Email'] || k['Username'] || '').toLowerCase();
                      const kamName = (k['Name'] || '').toLowerCase();
                      return kamEmail === userEmail.toLowerCase() ||
                             kamEmail === username.toLowerCase() ||
                             kamName === userName.toLowerCase();
                    });
                    
                    if (kamUser) {
                      kamId = kamUser['KAM ID'] || kamUser.id || null;
                      defaultLogger.info('VALIDATE: Found KAM ID from Airtable', {
                        requestId,
                        kamId,
                        kamName: kamUser['Name'],
                      });
                    }
                  } catch (kamError: any) {
                    defaultLogger.warn('VALIDATE: Failed to fetch KAM ID', {
                      requestId,
                      error: kamError.message,
                    });
                  }
                } else if (normalizedRole === 'nbfc' && !nbfcId) {
                  // Fetch NBFC Partners table to find nbfcId
                  try {
                    const nbfcPartners = await n8nClient.fetchTable('NBFC Partners', true, undefined, 5000);
                    const nbfcPartner = nbfcPartners.find((n: any) => {
                      const nbfcEmail = (n['Email'] || '').toLowerCase();
                      const nbfcName = (n['Partner Name'] || n['Name'] || '').toLowerCase();
                      return nbfcEmail === userEmail.toLowerCase() ||
                             nbfcEmail === username.toLowerCase() ||
                             nbfcName === userName.toLowerCase();
                    });
                    
                    if (nbfcPartner) {
                      nbfcId = nbfcPartner['NBFC Partner ID'] || nbfcPartner.id || null;
                      defaultLogger.info('VALIDATE: Found NBFC ID', {
                        requestId,
                        nbfcId,
                        nbfcName: nbfcPartner['Partner Name'] || nbfcPartner['Name'],
                      });
                    }
                  } catch (nbfcError: any) {
                    defaultLogger.warn('VALIDATE: Failed to fetch NBFC ID', {
                      requestId,
                      error: nbfcError.message,
                    });
                  }
                } else if (normalizedRole === 'credit_team' && !creditTeamId) {
                  // Fetch Credit Team Users table to find creditTeamId (only if not provided by webhook)
                  try {
                    const creditTeamUsers = await n8nClient.fetchTable('Credit Team Users', true, undefined, 5000);
                    const creditTeamUser = creditTeamUsers.find((ct: any) => {
                      const ctEmail = (ct['Email'] || ct['Username'] || '').toLowerCase();
                      const ctName = (ct['Name'] || '').toLowerCase();
                      return ctEmail === userEmail.toLowerCase() ||
                             ctEmail === username.toLowerCase() ||
                             ctName === userName.toLowerCase();
                    });
                    
                    if (creditTeamUser) {
                      creditTeamId = creditTeamUser['Credit Team ID'] || creditTeamUser.id || null;
                      defaultLogger.info('VALIDATE: Found Credit Team ID from Airtable', {
                        requestId,
                        creditTeamId,
                        creditTeamName: creditTeamUser['Name'],
                      });
                    }
                  } catch (creditTeamError: any) {
                    defaultLogger.warn('VALIDATE: Failed to fetch Credit Team ID', {
                      requestId,
                      error: creditTeamError.message,
                    });
                  }
                }
              } else if (!hasIdFromWebhook) {
                defaultLogger.info('VALIDATE: ID not provided by webhook and user account not found, using webhook data', {
                  requestId,
                  username,
                });
              }
            } else if (hasIdFromWebhook) {
              defaultLogger.info('VALIDATE: Using ID provided by webhook, skipping Airtable lookup', {
                requestId,
                username,
                role: normalizedRole,
                clientId,
                kamId,
                nbfcId,
                creditTeamId,
              });
            }
          } catch (profileError: any) {
            // Log error but don't fail authentication - IDs will be null
            defaultLogger.warn('VALIDATE: Failed to fetch full user profile', {
              requestId,
              error: profileError.message,
              note: 'Continuing with basic profile data',
            });
          }
          
          // Generate token directly from n8n response with fetched IDs
          try {
            const jwtPayload = {
              userId: profileData.id || `validated-${username}`,
              email: userEmail,
              role: normalizedRole,
              name: userName,
              clientId,
              kamId,
              nbfcId,
              creditTeamId,
            };
            
            defaultLogger.info('VALIDATE: JWT payload prepared', {
              requestId,
              userId: jwtPayload.userId,
              email: userEmail,
              role: normalizedRole,
              clientId,
              kamId,
              nbfcId,
              creditTeamId,
            });
            
            this.logStructured('VALIDATE_TOKEN_GENERATION', {
              requestId,
              userId: jwtPayload.userId,
              email: userEmail,
              role: normalizedRole,
            });
            
            const token = jwt.sign(
              jwtPayload,
              authConfig.jwtSecret,
              { expiresIn: authConfig.jwtExpiresIn } as jwt.SignOptions
            );
            
            this.logStructured('VALIDATE_SUCCESS', {
              requestId,
              username,
              role: normalizedRole,
            });
            
            res.json({
              success: true,
              token: token,
              user: {
                id: jwtPayload.userId,
                email: userEmail,
                role: normalizedRole,
                clientId,
                kamId,
                nbfcId,
                creditTeamId,
                name: userName,
              },
            });
            return;
          } catch (tokenError: any) {
            this.logStructured('VALIDATE_TOKEN_ERROR', {
              requestId,
              error: tokenError.message,
            });
            defaultLogger.error('Failed to generate token', {
              requestId,
              error: tokenError.message,
            });
            res.status(500).json({
              success: false,
              error: 'Validation succeeded but could not create session token.',
            });
            return;
          }
        }

        // If validation failed or no profile data, return error
        res.status(401).json({
          success: false,
          error: 'Invalid username or passcode',
        });
      } catch (fetchError: any) {
        defaultLogger.error('VALIDATE: Webhook call failed', {
          requestId,
          validateUrl,
          errorName: fetchError.name,
          errorMessage: fetchError.message,
          errorCode: fetchError.code,
          errorStack: fetchError.stack?.split('\n').slice(0, 10),
          cause: fetchError.cause,
        });
        
        this.logStructured('VALIDATE_N8N_WEBHOOK_ERROR', {
          requestId,
          errorName: fetchError.name,
          errorMessage: fetchError.message,
          errorCode: fetchError.code,
        });
        
        // Handle specific error types
        if (fetchError.name === 'AbortError' || fetchError.name === 'TimeoutError' || fetchError.message?.includes('timeout')) {
          defaultLogger.error('VALIDATE: Webhook timeout', {
            requestId,
            validateUrl,
            timeout: '45s',
          });
          res.status(504).json({
            success: false,
            error: 'Request timed out. Please try again.',
          });
          return;
        }

        if (fetchError.message?.includes('Circuit breaker') || fetchError.message?.includes('unavailable')) {
          res.status(503).json({
            success: false,
            error: 'Authentication service is temporarily unavailable. Please try again later.',
          });
          return;
        }

        if (fetchError.message?.includes('fetch') || fetchError.code === 'ECONNREFUSED') {
          res.status(503).json({
            success: false,
            error: 'Unable to reach authentication service. Please try again later.',
          });
          return;
        }

        throw fetchError; // Re-throw to outer catch
      }
    } catch (error: any) {
      this.logStructured('VALIDATE_ERROR', {
        requestId,
        errorName: error.name,
        errorMessage: error.message,
        errorStack: error.stack?.split('\n').slice(0, 3),
      });
      
      console.error('[AuthController] Validate error:', error);
      
      res.status(500).json({
        success: false,
        error: error.message || 'Internal server error',
      });
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
      const newRefreshToken = authService.generateRefreshToken(user);

      res.json({
        success: true,
        data: {
          token: newToken,
          refreshToken: newRefreshToken,
        },
      });
    } catch (error: any) {
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

