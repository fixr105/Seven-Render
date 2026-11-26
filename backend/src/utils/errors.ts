/**
 * Error Handling Utilities
 */

import { Request, Response, NextFunction } from 'express';
import { errorTracker } from './errorTracker.js';
import { defaultLogger } from './logger.js';

export class AppError extends Error {
  status?: number;
  code?: string;
  error_type?: string;

  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message);
    this.status = statusCode;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class UpstreamTimeoutError extends AppError {
  constructor() {
    super(503, 'Upstream slow, retry');
    this.name = 'UpstreamTimeoutError';
    this.code = 'UPSTREAM_TIMEOUT';
    this.error_type = 'server_unavailable';
  }
}

export const handleError = (error: any, req: Request, res: Response, next: NextFunction) => {
  // Extract request context for error tracking
  const requestId = req.headers['x-request-id'] as string || 
                    (req as any).requestId || 
                    `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const errorContext = {
    requestId,
    url: req.url,
    method: req.method,
    userAgent: req.headers['user-agent'],
    ip: req.ip || req.socket.remoteAddress,
    userId: (req as any).user?.id,
    email: (req as any).user?.email,
    metadata: {
      body: req.body,
      query: req.query,
      params: req.params,
    },
  };

  if (error instanceof AppError) {
    // Operational errors (expected errors) - log but don't track as critical
    if (!error.isOperational || error.statusCode >= 500) {
      errorTracker.captureException(error, errorContext);
    }
    
    defaultLogger.warn('Operational error', {
      statusCode: error.statusCode,
      message: error.message,
      requestId,
    });

    const status = error.status || error.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: error.message || 'Internal error',
      code: error.code,
      ...(error.error_type ? { error_type: error.error_type } : {}),
      requestId,
    });
  }

  // Unexpected errors - always track
  errorTracker.captureException(
    error instanceof Error ? error : new Error(String(error)),
    errorContext
  );

  defaultLogger.error('Unhandled error', {
    error: error instanceof Error ? {
      message: error.message,
      stack: error.stack,
      name: error.name,
    } : error,
    requestId,
  });

  const status = error?.status || error?.statusCode || 500;
  return res.status(status).json({
    success: false,
    error: error?.message || 'Internal error',
    code: error?.code,
    ...(error?.error_type ? { error_type: error.error_type } : {}),
    requestId,
  });
};

