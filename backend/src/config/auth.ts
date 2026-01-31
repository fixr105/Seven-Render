/**
 * Authentication Configuration
 */

import dotenv from 'dotenv';

dotenv.config();

// Validate JWT secret in production
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret === 'default-secret-change-in-production') {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'JWT_SECRET must be set to a secure random string in production. ' +
      'Generate one using: openssl rand -base64 32'
    );
  }
  // Allow default in development but warn
  console.warn(
    '⚠️  WARNING: Using default JWT_SECRET. This is insecure for production. ' +
    'Set JWT_SECRET environment variable.'
  );
}

export const authConfig = {
  jwtSecret: jwtSecret || 'default-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  cookieName: 'auth_token',
  cookieOptions: {
    httpOnly: true, // Prevents JavaScript access (XSS protection)
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    // Use sameSite: 'none' for cross-origin (e.g. lms.sevenfincorp.com -> seven-dash.fly.dev)
    sameSite: (process.env.CORS_ORIGIN ? 'none' : 'strict') as 'strict' | 'none' | 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days (matches JWT expiration)
    path: '/',
  },
} as const;

