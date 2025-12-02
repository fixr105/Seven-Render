/**
 * Authentication Configuration
 */

import dotenv from 'dotenv';

dotenv.config();

export const authConfig = {
  jwtSecret: process.env.JWT_SECRET || 'default-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
} as const;

