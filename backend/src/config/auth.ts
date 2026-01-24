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
} as const;

