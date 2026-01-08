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
 * Custom transport for external log shipping (HTTP-based)
 */
class HttpLogTransport extends winston.transport {
  private url: string;
  private sourceToken?: string;
  private batchSize: number;
  private batchTimeout: number;
  private logBuffer: any[] = [];
  private flushTimer?: NodeJS.Timeout;

  constructor(options: {
    url: string;
    sourceToken?: string;
    batchSize?: number;
    batchTimeout?: number;
  }) {
    super();
    this.url = options.url;
    this.sourceToken = options.sourceToken;
    this.batchSize = options.batchSize || 10;
    this.batchTimeout = options.batchTimeout || 5000;
  }

  log(info: any, callback: () => void) {
    // Add to buffer
    this.logBuffer.push(info);

    // Flush if buffer is full
    if (this.logBuffer.length >= this.batchSize) {
      this.flush();
    } else {
      // Set timer for timeout-based flushing
      if (!this.flushTimer) {
        this.flushTimer = setTimeout(() => this.flush(), this.batchTimeout);
      }
    }

    callback();
  }

  private async flush() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = undefined;
    }

    if (this.logBuffer.length === 0) return;

    const logs = [...this.logBuffer];
    this.logBuffer = [];

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.sourceToken) {
        headers['Authorization'] = `Bearer ${this.sourceToken}`;
      }

      await fetch(this.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(logs),
      }).catch((err) => {
        // Silently fail - don't break application if log shipping fails
        console.error('[HttpLogTransport] Failed to ship logs:', err.message);
      });
    } catch (err) {
      // Silently fail
      console.error('[HttpLogTransport] Error shipping logs:', err);
    }
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

// Add external log shipping transport if configured
if (process.env.LOG_SHIPPING_URL) {
  transports.push(
    new HttpLogTransport({
      url: process.env.LOG_SHIPPING_URL,
      sourceToken: process.env.LOG_SHIPPING_TOKEN,
      batchSize: parseInt(process.env.LOG_SHIPPING_BATCH_SIZE || '10', 10),
      batchTimeout: parseInt(process.env.LOG_SHIPPING_BATCH_TIMEOUT || '5000', 10),
    }) as any
  );
}

// Add Logtail transport if configured
if (process.env.LOGTAIL_SOURCE_TOKEN) {
  transports.push(
    new HttpLogTransport({
      url: 'https://in.logtail.com',
      sourceToken: process.env.LOGTAIL_SOURCE_TOKEN,
      batchSize: parseInt(process.env.LOG_SHIPPING_BATCH_SIZE || '10', 10),
      batchTimeout: parseInt(process.env.LOG_SHIPPING_BATCH_TIMEOUT || '5000', 10),
    }) as any
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
