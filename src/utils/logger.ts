/**
 * Frontend Logging Utility
 * Structured logging for production use
 */

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface Logger {
  error: (message: string, meta?: any) => void;
  warn: (message: string, meta?: any) => void;
  info: (message: string, meta?: any) => void;
  debug: (message: string, meta?: any) => void;
}

/**
 * Create a logger with context
 */
export function createLogger(context?: { userId?: string; email?: string; component?: string }): Logger {
  const contextMeta = context || {};
  const isDevelopment = import.meta.env.MODE === 'development';
  const logLevel = (import.meta.env.VITE_LOG_LEVEL || (isDevelopment ? 'debug' : 'warn')).toLowerCase() as LogLevel;

  const levels: Record<LogLevel, number> = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
  };

  const shouldLog = (level: LogLevel): boolean => {
    return levels[level] <= levels[logLevel];
  };

  const formatMessage = (level: LogLevel, message: string, meta?: any): void => {
    if (!shouldLog(level)) return;

    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...contextMeta,
      ...meta,
    };

    if (isDevelopment) {
      // In development, use console with colors
      const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : level === 'info' ? 'info' : 'log';
      console[consoleMethod](`[${level.toUpperCase()}]`, message, meta || '');
    } else {
      // In production, log as JSON for log aggregation
      console.log(JSON.stringify(logEntry));
    }
  };

  return {
    error: (message: string, meta?: any) => formatMessage('error', message, meta),
    warn: (message: string, meta?: any) => formatMessage('warn', message, meta),
    info: (message: string, meta?: any) => formatMessage('info', message, meta),
    debug: (message: string, meta?: any) => formatMessage('debug', message, meta),
  };
}

/**
 * Default logger instance
 */
export const defaultLogger = createLogger();

/**
 * Component logger factory
 */
export function useComponentLogger(componentName: string): Logger {
  return createLogger({ component: componentName });
}
