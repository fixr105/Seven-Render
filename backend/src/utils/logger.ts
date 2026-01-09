/**
 * Production-Grade Logging Utility
 * Uses Winston for structured logging with external log shipping support
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import fetch from 'node-fetch';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define log colors
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

// Define log format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}${info.stack ? `\n${info.stack}` : ''}`
  )
);

// Determine log level from environment variable or default
const level = () => {
  // Allow override via LOG_LEVEL environment variable
  if (process.env.LOG_LEVEL) {
    const validLevels = ['error', 'warn', 'info', 'http', 'debug'];
    if (validLevels.includes(process.env.LOG_LEVEL.toLowerCase())) {
      return process.env.LOG_LEVEL.toLowerCase();
    }
  }
  
  // Default based on environment
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'warn';
};

/**
 * External log shipping function (HTTP-based)
 * Called asynchronously to avoid blocking the main application
 */
async function shipLogs(logs: any[], url: string, sourceToken?: string) {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (sourceToken) {
      headers['Authorization'] = `Bearer ${sourceToken}`;
    }

    await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(logs),
    }).catch((err) => {
      // Silently fail - don't break application if log shipping fails
      console.error('[LogShipping] Failed to ship logs:', err.message);
    });
  } catch (err) {
    // Silently fail
    console.error('[LogShipping] Error shipping logs:', err);
  }
}

// Create transports array with proper typing
const transports: winston.transport[] = [
  // Console transport
  new winston.transports.Console({
    format: process.env.NODE_ENV === 'production' ? format : consoleFormat,
  }),
];

// Add file transport with rotation in production (optional)
if (process.env.NODE_ENV === 'production' && process.env.LOG_FILE) {
  const logDir = process.env.LOG_DIR || './logs';
  const maxSize = process.env.LOG_MAX_SIZE || '20m';
  const maxFiles = process.env.LOG_MAX_FILES || '14d'; // Keep logs for 14 days

  // Rotated file transport for all logs
  transports.push(
    new DailyRotateFile({
      dirname: logDir,
      filename: 'app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize,
      maxFiles, // Keep files for specified days
      format,
    })
  );

  // Separate error log file
  transports.push(
    new DailyRotateFile({
      dirname: logDir,
      filename: 'error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize,
      maxFiles,
      format,
    })
  );
}

// Create logger instance
const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
  // Don't exit on handled exceptions
  exitOnError: false,
});

// Add external log shipping if configured (async, non-blocking)
if (process.env.LOG_SHIPPING_URL || process.env.LOGTAIL_SOURCE_TOKEN) {
  // Create a custom format that ships logs externally
  const logShippingFormat = winston.format((info) => {
    // Ship logs asynchronously (don't block)
    if (process.env.LOG_SHIPPING_URL) {
      shipLogs([info], process.env.LOG_SHIPPING_URL, process.env.LOG_SHIPPING_TOKEN).catch(() => {});
    }
    if (process.env.LOGTAIL_SOURCE_TOKEN) {
      shipLogs([info], 'https://in.logtail.com', process.env.LOGTAIL_SOURCE_TOKEN).catch(() => {});
    }
    return info;
  });
  
  // Add format to logger (this will be called for each log entry)
  logger.format = winston.format.combine(
    logShippingFormat(),
    format
  );
}

/**
 * Logger interface
 */
export interface Logger {
  error: (message: string, meta?: any) => void;
  warn: (message: string, meta?: any) => void;
  info: (message: string, meta?: any) => void;
  http: (message: string, meta?: any) => void;
  debug: (message: string, meta?: any) => void;
}

/**
 * Create a logger with request context
 */
export function createLogger(context?: { requestId?: string; userId?: string; email?: string }): Logger {
  const contextMeta = context || {};

  return {
    error: (message: string, meta?: any) => {
      logger.error(message, { ...contextMeta, ...meta });
    },
    warn: (message: string, meta?: any) => {
      logger.warn(message, { ...contextMeta, ...meta });
    },
    info: (message: string, meta?: any) => {
      logger.info(message, { ...contextMeta, ...meta });
    },
    http: (message: string, meta?: any) => {
      logger.http(message, { ...contextMeta, ...meta });
    },
    debug: (message: string, meta?: any) => {
      logger.debug(message, { ...contextMeta, ...meta });
    },
  };
}

/**
 * Default logger instance
 */
export const defaultLogger = createLogger();

export default logger;
