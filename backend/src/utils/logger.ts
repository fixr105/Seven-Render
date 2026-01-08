/**
 * Production-Grade Logging Utility
 * Uses Winston for structured logging
 */

import winston from 'winston';

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

// Determine log level from environment
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'warn';
};

// Create transports
const transports = [
  // Console transport
  new winston.transports.Console({
    format: process.env.NODE_ENV === 'production' ? format : consoleFormat,
  }),
];

// Create logger instance
const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
  // Don't exit on handled exceptions
  exitOnError: false,
});

// Add file transport in production (optional)
if (process.env.NODE_ENV === 'production' && process.env.LOG_FILE) {
  transports.push(
    new winston.transports.File({
      filename: process.env.LOG_FILE,
      level: 'error',
    }),
    new winston.transports.File({
      filename: process.env.LOG_FILE?.replace('.log', '-combined.log') || 'combined.log',
    })
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
