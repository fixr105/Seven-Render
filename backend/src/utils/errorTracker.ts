/**
 * Error Tracking Utility
 * Integrates with error tracking services (Sentry, Rollbar, or custom HTTP endpoint)
 */

import { defaultLogger } from './logger.js';
import fetch from 'node-fetch';

export interface ErrorContext {
  userId?: string;
  email?: string;
  requestId?: string;
  url?: string;
  method?: string;
  userAgent?: string;
  ip?: string;
  metadata?: Record<string, any>;
}

export interface ErrorTracker {
  captureException: (error: Error, context?: ErrorContext) => void;
  captureMessage: (message: string, level?: 'error' | 'warning' | 'info', context?: ErrorContext) => void;
  setUser: (user: { id?: string; email?: string; username?: string }) => void;
}

/**
 * HTTP-based error tracker (for custom endpoints or services like Logtail)
 */
class HttpErrorTracker implements ErrorTracker {
  private url: string;
  private apiKey?: string;
  private environment: string;
  private serviceName: string;
  private currentUser?: { id?: string; email?: string; username?: string };

  constructor(options: {
    url: string;
    apiKey?: string;
    environment?: string;
    serviceName?: string;
  }) {
    this.url = options.url;
    this.apiKey = options.apiKey;
    this.environment = options.environment || process.env.NODE_ENV || 'development';
    this.serviceName = options.serviceName || 'seven-fincorp-backend';
  }

  setUser(user: { id?: string; email?: string; username?: string }) {
    this.currentUser = user;
  }

  async captureException(error: Error, context?: ErrorContext) {
    const errorData = {
      message: error.message,
      stack: error.stack,
      type: error.name,
      level: 'error',
      environment: this.environment,
      service: this.serviceName,
      timestamp: new Date().toISOString(),
      user: this.currentUser || {
        id: context?.userId,
        email: context?.email,
      },
      context: {
        requestId: context?.requestId,
        url: context?.url,
        method: context?.method,
        userAgent: context?.userAgent,
        ip: context?.ip,
        ...context?.metadata,
      },
    };

    await this.sendError(errorData);
  }

  async captureMessage(
    message: string,
    level: 'error' | 'warning' | 'info' = 'error',
    context?: ErrorContext
  ) {
    const errorData = {
      message,
      level,
      environment: this.environment,
      service: this.serviceName,
      timestamp: new Date().toISOString(),
      user: this.currentUser || {
        id: context?.userId,
        email: context?.email,
      },
      context: {
        requestId: context?.requestId,
        url: context?.url,
        method: context?.method,
        userAgent: context?.userAgent,
        ip: context?.ip,
        ...context?.metadata,
      },
    };

    await this.sendError(errorData);
  }

  private async sendError(data: any) {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
        headers['X-API-Key'] = this.apiKey;
      }

      await fetch(this.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      }).catch((err) => {
        // Log to console if error tracking fails
        defaultLogger.error('Failed to send error to tracking service', {
          error: err.message,
          originalError: data,
        });
      });
    } catch (err) {
      // Silently fail - don't break application if error tracking fails
      defaultLogger.error('Error tracking service error', { error: err });
    }
  }
}

/**
 * Sentry error tracker
 */
class SentryErrorTracker implements ErrorTracker {
  private dsn: string;
  private environment: string;
  private currentUser?: { id?: string; email?: string; username?: string };

  constructor(options: { dsn: string; environment?: string }) {
    this.dsn = options.dsn;
    this.environment = options.environment || process.env.NODE_ENV || 'development';
  }

  setUser(user: { id?: string; email?: string; username?: string }) {
    this.currentUser = user;
  }

  async captureException(error: Error, context?: ErrorContext) {
    try {
      const sentryData = {
        message: error.message,
        level: 'error',
        environment: this.environment,
        user: this.currentUser || {
          id: context?.userId,
          email: context?.email,
        },
        tags: {
          type: error.name,
        },
        extra: {
          stack: error.stack,
          requestId: context?.requestId,
          url: context?.url,
          method: context?.method,
          userAgent: context?.userAgent,
          ip: context?.ip,
          ...context?.metadata,
        },
      };

      await fetch(`https://sentry.io/api/0/projects/${this.extractProjectId()}/store/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${this.extractKey()}, sentry_client=seven-fincorp-backend/1.0.0`,
        },
        body: JSON.stringify(sentryData),
      }).catch((err) => {
        defaultLogger.error('Failed to send error to Sentry', { error: err.message });
      });
    } catch (err) {
      defaultLogger.error('Sentry error tracking error', { error: err });
    }
  }

  async captureMessage(
    message: string,
    level: 'error' | 'warning' | 'info' = 'error',
    context?: ErrorContext
  ) {
    try {
      const sentryData = {
        message,
        level,
        environment: this.environment,
        user: this.currentUser || {
          id: context?.userId,
          email: context?.email,
        },
        extra: {
          requestId: context?.requestId,
          url: context?.url,
          method: context?.method,
          userAgent: context?.userAgent,
          ip: context?.ip,
          ...context?.metadata,
        },
      };

      await fetch(`https://sentry.io/api/0/projects/${this.extractProjectId()}/store/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${this.extractKey()}, sentry_client=seven-fincorp-backend/1.0.0`,
        },
        body: JSON.stringify(sentryData),
      }).catch((err) => {
        defaultLogger.error('Failed to send message to Sentry', { error: err.message });
      });
    } catch (err) {
      defaultLogger.error('Sentry error tracking error', { error: err });
    }
  }

  private extractKey(): string {
    // Extract key from DSN: https://KEY@host/PROJECT_ID
    const match = this.dsn.match(/https:\/\/([^@]+)@/);
    return match ? match[1] : '';
  }

  private extractProjectId(): string {
    // Extract project ID from DSN: https://KEY@host/PROJECT_ID
    const match = this.dsn.match(/@[^/]+\/(.+)/);
    return match ? match[1] : '';
  }
}

/**
 * Console-only error tracker (fallback)
 */
class ConsoleErrorTracker implements ErrorTracker {
  setUser(user: { id?: string; email?: string; username?: string }) {
    // No-op for console tracker
  }

  captureException(error: Error, context?: ErrorContext) {
    defaultLogger.error('Exception captured', {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
      context,
    });
  }

  captureMessage(
    message: string,
    level: 'error' | 'warning' | 'info' = 'error',
    context?: ErrorContext
  ) {
    const logMethod = level === 'error' ? 'error' : level === 'warning' ? 'warn' : 'info';
    defaultLogger[logMethod](message, { context });
  }
}

/**
 * Create error tracker based on environment configuration
 */
function createErrorTracker(): ErrorTracker {
  // Sentry integration
  if (process.env.SENTRY_DSN) {
    return new SentryErrorTracker({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
    });
  }

  // Custom HTTP endpoint
  if (process.env.ERROR_TRACKING_URL) {
    return new HttpErrorTracker({
      url: process.env.ERROR_TRACKING_URL,
      apiKey: process.env.ERROR_TRACKING_API_KEY,
      environment: process.env.NODE_ENV || 'development',
      serviceName: 'seven-fincorp-backend',
    });
  }

  // Fallback to console
  return new ConsoleErrorTracker();
}

/**
 * Global error tracker instance
 */
export const errorTracker = createErrorTracker();

/**
 * Setup global error handlers
 */
export function setupErrorHandlers() {
  // Capture unhandled promise rejections
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    errorTracker.captureException(error, {
      metadata: {
        type: 'unhandledRejection',
        promise: String(promise),
      },
    });
  });

  // Capture uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    errorTracker.captureException(error, {
      metadata: {
        type: 'uncaughtException',
      },
    });
    // Exit process after logging (uncaught exceptions are fatal)
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });
}
