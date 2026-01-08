/**
 * Environment Variable Validation
 * Validates required environment variables before server startup
 */

import { defaultLogger } from './logger.js';

export interface EnvValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Required environment variables for production
 */
const REQUIRED_ENV_VARS = [
  'NODE_ENV',
  'JWT_SECRET',
  'N8N_BASE_URL',
  'CORS_ORIGIN',
];

/**
 * Optional but recommended environment variables
 */
const RECOMMENDED_ENV_VARS = [
  'LOG_LEVEL',
  'LOG_SHIPPING_URL',
  'ERROR_TRACKING_URL',
  'APM_URL',
];

/**
 * Validate environment variables
 */
export function validateEnvironment(): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  for (const envVar of REQUIRED_ENV_VARS) {
    if (!process.env[envVar]) {
      errors.push(`Missing required environment variable: ${envVar}`);
    }
  }

  // Validate specific variables
  if (process.env.NODE_ENV) {
    const validEnvs = ['development', 'production', 'staging', 'test'];
    if (!validEnvs.includes(process.env.NODE_ENV)) {
      errors.push(`Invalid NODE_ENV: ${process.env.NODE_ENV}. Must be one of: ${validEnvs.join(', ')}`);
    }
  }

  if (process.env.JWT_SECRET) {
    if (process.env.JWT_SECRET.length < 32) {
      errors.push('JWT_SECRET must be at least 32 characters long');
    }
    if (process.env.JWT_SECRET === 'your-jwt-secret-here' || process.env.JWT_SECRET === 'secret') {
      errors.push('JWT_SECRET must be changed from default value');
    }
  }

  if (process.env.CORS_ORIGIN) {
    const origins = process.env.CORS_ORIGIN.split(',').map(o => o.trim());
    if (origins.some(o => o === '*' || o === 'http://*' || o === 'https://*')) {
      warnings.push('CORS_ORIGIN contains wildcard patterns. This is not recommended for production.');
    }
  }

  if (process.env.NODE_ENV === 'production') {
    // Production-specific checks
    if (!process.env.CORS_ORIGIN) {
      errors.push('CORS_ORIGIN is required in production');
    }

    // Check for recommended monitoring variables
    for (const envVar of RECOMMENDED_ENV_VARS) {
      if (!process.env[envVar]) {
        warnings.push(`Recommended environment variable not set: ${envVar}`);
      }
    }

    // Check for development-only variables that shouldn't be in production
    if (process.env.NODE_ENV === 'production' && process.env.DEBUG) {
      warnings.push('DEBUG environment variable is set in production. This may expose sensitive information.');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate and exit if invalid (for pre-deployment checks)
 */
export function validateEnvironmentOrExit(): void {
  const result = validateEnvironment();

  if (result.warnings.length > 0) {
    defaultLogger.warn('Environment validation warnings:', {
      warnings: result.warnings,
    });
  }

  if (result.errors.length > 0) {
    defaultLogger.error('Environment validation failed:', {
      errors: result.errors,
    });
    console.error('\n❌ Environment validation failed!');
    console.error('\nErrors:');
    result.errors.forEach((error) => {
      console.error(`  - ${error}`);
    });
    if (result.warnings.length > 0) {
      console.error('\nWarnings:');
      result.warnings.forEach((warning) => {
        console.error(`  - ${warning}`);
      });
    }
    console.error('\nPlease fix the errors above before deploying.\n');
    process.exit(1);
  }

  if (result.warnings.length > 0) {
    defaultLogger.info('Environment validation passed with warnings');
  } else {
    defaultLogger.info('Environment validation passed');
  }
}
