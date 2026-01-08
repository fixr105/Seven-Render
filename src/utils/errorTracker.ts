/**
 * Frontend Error Tracking Utility
 * Integrates with error tracking services (Sentry, Rollbar, or custom HTTP endpoint)
 */

export interface ErrorContext {
  userId?: string;
  email?: string;
  url?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

export interface ErrorTracker {
  captureException: (error: Error, context?: ErrorContext) => void;
  captureMessage: (message: string, level?: 'error' | 'warning' | 'info', context?: ErrorContext) => void;
  setUser: (user: { id?: string; email?: string; username?: string }) => void;
}

/**
 * HTTP-based error tracker (for custom endpoints)
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
    this.environment = options.environment || import.meta.env.MODE || 'development';
    this.serviceName = options.serviceName || 'seven-fincorp-frontend';
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
        url: context?.url || window.location.href,
        userAgent: context?.userAgent || navigator.userAgent,
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
        url: context?.url || window.location.href,
        userAgent: context?.userAgent || navigator.userAgent,
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
      }).catch(() => {
        // Silently fail - don't break application if error tracking fails
      });
    } catch (err) {
      // Silently fail
    }
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
    if (import.meta.env.MODE === 'development') {
      console.error('Exception captured:', {
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name,
        },
        context,
      });
    }
  }

  captureMessage(
    message: string,
    level: 'error' | 'warning' | 'info' = 'error',
    context?: ErrorContext
  ) {
    if (import.meta.env.MODE === 'development') {
      const logMethod = level === 'error' ? 'error' : level === 'warning' ? 'warn' : 'info';
      console[logMethod](message, { context });
    }
  }
}

/**
 * Create error tracker based on environment configuration
 */
function createErrorTracker(): ErrorTracker {
  // Custom HTTP endpoint
  const errorTrackingUrl = import.meta.env.VITE_ERROR_TRACKING_URL;
  if (errorTrackingUrl) {
    return new HttpErrorTracker({
      url: errorTrackingUrl,
      apiKey: import.meta.env.VITE_ERROR_TRACKING_API_KEY,
      environment: import.meta.env.MODE || 'development',
      serviceName: 'seven-fincorp-frontend',
    });
  }

  // Sentry integration (if DSN is provided)
  const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
  if (sentryDsn) {
    // For now, use HTTP tracker with Sentry endpoint
    // In production, you'd use @sentry/react
    return new HttpErrorTracker({
      url: `https://sentry.io/api/0/projects/${sentryDsn.split('/').pop()}/store/`,
      apiKey: sentryDsn.split('@')[0].replace('https://', ''),
      environment: import.meta.env.MODE || 'development',
      serviceName: 'seven-fincorp-frontend',
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
  // Capture unhandled errors
  window.addEventListener('error', (event) => {
    errorTracker.captureException(event.error || new Error(event.message), {
      url: event.filename,
      metadata: {
        lineno: event.lineno,
        colno: event.colno,
      },
    });
  });

  // Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason instanceof Error 
      ? event.reason 
      : new Error(String(event.reason));
    errorTracker.captureException(error, {
      metadata: {
        type: 'unhandledRejection',
      },
    });
  });
}
