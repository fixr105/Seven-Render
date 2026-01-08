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
        this.logStructured('INPUT_VALIDATION_FAILED', {
          requestId,
          error: validationError.message,
        });
        
        res.status(400).json({
          success: false,
          error: 'Invalid input: ' + (validationError.message || 'Email and password are required'),
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
          errorMessage.includes('Invalid email or password') || 
          errorMessage.includes('Account is not active') ||
          errorMessage.includes('no role assigned') ||
          errorMessage.includes('Invalid webhook response') ||
          errorMessage.includes('No user accounts found') ||
          errorMessage.includes('missing required') ||
          errorMessage.includes('malformed') ||
          errorMessage.includes('empty')
        ) {
          statusCode = 401; // Unauthorized
          // Provide helpful error message for validation failures
          if (errorMessage.includes('Invalid webhook response') || 
              errorMessage.includes('missing required') ||
              errorMessage.includes('malformed') ||
              errorMessage.includes('empty')) {
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
            const creditUser = creditUsers.find((c) => c.Email?.toLowerCase() === req.user.email?.toLowerCase());
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
        this.logStructured('VALIDATE_INPUT_VALIDATION_FAILED', {
          requestId,
          error: validationError.message,
        });
        
        res.status(400).json({
          success: false,
          error: 'Invalid input: ' + (validationError.message || 'Username and passcode are required'),
        });
        return;
      }

      // Get n8n base URL from environment (required)
      if (!process.env.N8N_BASE_URL) {
        this.logStructured('VALIDATE_N8N_BASE_URL_MISSING', {
          requestId,
          error: 'N8N_BASE_URL environment variable is required',
        });
        res.status(500).json({
          success: false,
          error: 'Server configuration error: N8N_BASE_URL not configured',
        });
        return;
      }
      const n8nBaseUrl = process.env.N8N_BASE_URL;
      const validateUrl = `${n8nBaseUrl}/webhook/validate`;
      
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
        const response = await httpPost(
          validateUrl,
          {
            username,
            passcode,
          },
          {},
          {
            maxRetries: 0, // No retries for validate - must complete quickly
            retryDelay: 1000,
            retryOn: [408, 429, 500, 502, 503, 504],
            timeout: 45000, // 45 seconds timeout for n8n webhook (Fly.io has no 30s limit)
          }
        );

        // Check if response is ok
              if (!response.ok) {
                const errorData: any = await response.json().catch(() => ({ error: 'Unknown error' }));
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

        // Parse n8n response
        const rawData: any = await response.json();
        
        this.logStructured('VALIDATE_N8N_WEBHOOK_RESPONSE', {
          requestId,
          isArray: Array.isArray(rawData),
          responseType: typeof rawData,
          responseKeys: Array.isArray(rawData) ? 'array' : Object.keys(rawData || {}),
        });

        // Handle different response formats from n8n
        let profileData: any = null;
        
        // Format 1: Array with output field containing JSON string
        // [ { "output": "{\"username\": \"Sagar\", \"role\": \"kam\", \"Associated profile\": \"Sagar\"}" } ]
        if (Array.isArray(rawData) && rawData.length > 0 && rawData[0]?.output) {
          try {
            const outputString = rawData[0].output;
            profileData = typeof outputString === 'string' ? JSON.parse(outputString) : outputString;
            this.logStructured('VALIDATE_PARSED_OUTPUT', {
              requestId,
              username: profileData?.username,
              role: profileData?.role,
              associatedProfile: profileData?.['Associated profile'],
            });
          } catch (parseError: any) {
            console.error('[AuthController] Failed to parse output JSON:', parseError);
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

        // If we have profile data, proceed with authentication
        if (profileData && (profileData.username || profileData.role)) {
          try {
            // Try to login with username as email to get token and user data
            // This ensures the user exists in User Accounts and we get proper user context
            const loginResult = await authService.login(username, passcode);
            
            // Return token and user data
            res.json({
              success: true,
              token: loginResult.token,
              user: loginResult.user,
            });
            return;
          } catch (loginError: any) {
            // If login fails, it means user is not in User Accounts table
            // But validation succeeded, so we can still create a basic token
            // using the username and data from n8n response
            console.warn('[AuthController] Validate succeeded but user not in User Accounts:', loginError.message);
            
            // Extract user data from profile data
            const userEmail = profileData.email || profileData.username || username;
            const userRole = profileData.role || 'client';
            const userName = profileData['Associated profile'] || profileData.name || profileData.username || username;
            
            // Map role to valid role format
            const roleMap: Record<string, string> = {
              'kam': 'kam',
              'client': 'client',
              'credit_team': 'credit_team',
              'credit team': 'credit_team',
              'nbfc': 'nbfc',
            };
            const normalizedRole = roleMap[userRole.toLowerCase()] || 'client';
            
              // Generate a basic token with available user data
              try {
                const jwtPayload = {
                  userId: profileData.id || `validated-${username}`,
                  email: userEmail,
                  role: normalizedRole,
                  name: userName,
                  clientId: profileData.clientId || null,
                  kamId: profileData.kamId || null,
                  nbfcId: profileData.nbfcId || null,
                };
              
              const token = jwt.sign(
                jwtPayload,
                authConfig.jwtSecret,
                { expiresIn: authConfig.jwtExpiresIn } as jwt.SignOptions
              );
              
              res.json({
                success: true,
                token: token,
                user: {
                  id: jwtPayload.userId,
                  email: userEmail,
                  role: normalizedRole,
                  clientId: profileData.clientId || null,
                  kamId: profileData.kamId || null,
                  nbfcId: profileData.nbfcId || null,
                  name: userName,
                },
              });
              return;
            } catch (tokenError: any) {
              console.error('[AuthController] Failed to generate token:', tokenError);
              res.status(500).json({
                success: false,
                error: 'Validation succeeded but could not create session token.',
              });
              return;
            }
          }
        }

        // If validation failed or no profile data, return error
        res.status(401).json({
          success: false,
          error: 'Invalid username or passcode',
        });
      } catch (fetchError: any) {
        this.logStructured('VALIDATE_N8N_WEBHOOK_ERROR', {
          requestId,
          errorName: fetchError.name,
          errorMessage: fetchError.message,
          errorCode: fetchError.code,
        });
        
        // Handle specific error types
        if (fetchError.name === 'AbortError' || fetchError.name === 'TimeoutError' || fetchError.message?.includes('timeout')) {
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

