/**
 * Rate Limiting Middleware
 * Provides different rate limits for different endpoint types
 */

import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';

// Rate limit configuration from environment variables with sensible defaults
const RATE_LIMIT_CONFIG = {
  // Authentication rate limits
  AUTH_PER_IP_MAX: parseInt(process.env.AUTH_RATE_LIMIT_PER_IP || '20', 10),
  AUTH_PER_ACCOUNT_MAX: parseInt(process.env.AUTH_RATE_LIMIT_PER_ACCOUNT || '5', 10),
  AUTH_WINDOW_MS: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || String(15 * 60 * 1000), 10),
  
  // API rate limits (higher default for dashboard: many parallel requests on page load)
  API_MAX: parseInt(process.env.API_RATE_LIMIT_MAX || '500', 10),
  API_WINDOW_MS: parseInt(process.env.API_RATE_LIMIT_WINDOW_MS || String(15 * 60 * 1000), 10),
  
  // Upload rate limits
  UPLOAD_MAX: parseInt(process.env.UPLOAD_RATE_LIMIT_MAX || '10', 10),
  UPLOAD_WINDOW_MS: parseInt(process.env.UPLOAD_RATE_LIMIT_WINDOW_MS || String(60 * 60 * 1000), 10),
  
  // Webhook rate limits
  WEBHOOK_MAX: parseInt(process.env.WEBHOOK_RATE_LIMIT_MAX || '20', 10),
  WEBHOOK_WINDOW_MS: parseInt(process.env.WEBHOOK_RATE_LIMIT_WINDOW_MS || String(15 * 60 * 1000), 10),
};

// Helper to determine if rate limiting should be skipped
// Skip when E2E override is set, or rate limits explicitly disabled, or in development
const shouldSkipRateLimit = (): boolean => {
  if (process.env.ENABLE_RATE_LIMITS === 'true') {
    return false;
  }
  if (process.env.SKIP_E2E_RATE_LIMITS === 'true' || process.env.ENABLE_RATE_LIMITS === 'false') {
    return true;
  }
  return process.env.NODE_ENV === 'development';
};

// Skip auth rate limit when SKIP_AUTH_RATE_LIMIT=true (for local/dev iterative testing)
const shouldSkipAuthRateLimit = (): boolean => {
  return process.env.SKIP_AUTH_RATE_LIMIT === 'true';
};

// Helper to extract identifier from request
const getIdentifier = (req: Request): string => {
  const body = (req.body || {}) as Record<string, any>;
  const rawIdentifier = body.email || body.username || '';
  return typeof rawIdentifier === 'string' ? rawIdentifier.trim().toLowerCase() : 'anonymous';
};

// Per-IP rate limiter for authentication
const authRateLimiterPerIP = rateLimit({
  windowMs: RATE_LIMIT_CONFIG.AUTH_WINDOW_MS,
  max: RATE_LIMIT_CONFIG.AUTH_PER_IP_MAX,
  message: {
    success: false,
    error: 'Too many login attempts from this IP, please try again after 15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || 'unknown';
  },
  validate: { keyGeneratorIpFallback: false },
  skip: shouldSkipRateLimit,
});

// Per-IP:identifier rate limiter for authentication
const authRateLimiterPerAccount = rateLimit({
  windowMs: RATE_LIMIT_CONFIG.AUTH_WINDOW_MS,
  max: RATE_LIMIT_CONFIG.AUTH_PER_ACCOUNT_MAX,
  message: {
    success: false,
    error: 'Too many login attempts for this account, please try again after 15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const identifier = getIdentifier(req);
    return `${req.ip || 'unknown'}:${identifier || 'anonymous'}`;
  },
  validate: { keyGeneratorIpFallback: false },
  skip: shouldSkipRateLimit,
});

// Composite rate limiter that enforces both per-IP and per-IP:identifier limits
// Both limits must pass for the request to proceed
export const authRateLimiter = (req: Request, res: Response, next: NextFunction): void => {
  // Skip auth rate limit when SKIP_AUTH_RATE_LIMIT=true (for local/dev iterative testing)
  if (shouldSkipAuthRateLimit()) {
    return next();
  }
  // Skip in development (using same logic as individual limiters)
  if (shouldSkipRateLimit()) {
    return next();
  }

  let perIPPassed = false;
  let perAccountPassed = false;
  let errorMessage = 'Too many login attempts, please try again after 15 minutes';

  // Check per-IP limit
  authRateLimiterPerIP(req, res, (err?: any) => {
    if (err || res.statusCode === 429) {
      // Per-IP limit exceeded
      if (!res.headersSent) {
        return res.status(429).json({
          success: false,
          error: 'Too many login attempts from this IP, please try again after 15 minutes',
        });
      }
      return;
    }
    perIPPassed = true;

    // Check per-account limit
    authRateLimiterPerAccount(req, res, (err2?: any) => {
      if (err2 || res.statusCode === 429) {
        // Per-account limit exceeded
        if (!res.headersSent) {
          return res.status(429).json({
            success: false,
            error: 'Too many login attempts for this account, please try again after 15 minutes',
          });
        }
        return;
      }
      perAccountPassed = true;

      // Both limits passed, proceed
      if (perIPPassed && perAccountPassed) {
        next();
      }
    });
  });
};

// Rate limit for general API endpoints
export const apiRateLimiter = rateLimit({
  windowMs: RATE_LIMIT_CONFIG.API_WINDOW_MS,
  max: RATE_LIMIT_CONFIG.API_MAX,
  message: {
    success: false,
    error: 'Too many requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldSkipRateLimit,
});

// Rate limit for file upload endpoints (stricter)
export const uploadRateLimiter = rateLimit({
  windowMs: RATE_LIMIT_CONFIG.UPLOAD_WINDOW_MS,
  max: RATE_LIMIT_CONFIG.UPLOAD_MAX,
  message: {
    success: false,
    error: 'Too many file uploads, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldSkipRateLimit,
});

// Rate limit for webhook endpoints (very strict)
export const webhookRateLimiter = rateLimit({
  windowMs: RATE_LIMIT_CONFIG.WEBHOOK_WINDOW_MS,
  max: RATE_LIMIT_CONFIG.WEBHOOK_MAX,
  message: {
    success: false,
    error: 'Too many webhook requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldSkipRateLimit,
});
