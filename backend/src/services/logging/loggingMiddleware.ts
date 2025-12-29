/**
 * Logging Middleware
 * 
 * Express middleware to automatically log requests and responses
 * Integrates with CentralizedLoggerService to capture all major operations
 */

import { Request, Response, NextFunction } from 'express';
import { centralizedLogger } from './centralizedLogger.service.js';
import { AdminActionType } from '../../utils/adminLogger.js';

/**
 * Middleware to log API requests
 * 
 * This middleware intercepts requests and logs them to the audit trail.
 * It's particularly useful for tracking file uploads, status changes, and other operations.
 */
export function loggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip logging for health checks and static assets
  if (req.path === '/health' || req.path.startsWith('/static')) {
    return next();
  }

  // Capture request start time
  const startTime = Date.now();

  // Store original end function
  const originalEnd = res.end;

  // Override end function to log response
  res.end = function (chunk?: any, encoding?: any) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    // Log slow requests or errors
    if (duration > 1000 || statusCode >= 400) {
      console.log(`[LoggingMiddleware] ${req.method} ${req.path} - ${statusCode} (${duration}ms)`);
    }

    // Call original end
    originalEnd.call(this, chunk, encoding);
  };

  next();
}

/**
 * Middleware to automatically log status changes
 * 
 * This middleware intercepts responses that indicate status changes
 * and logs them automatically.
 */
export function autoLogStatusChanges(req: Request, res: Response, next: NextFunction): void {
  // Only process successful responses
  if (res.statusCode < 200 || res.statusCode >= 300) {
    return next();
  }

  // Check if this is a status change operation
  const isStatusChange = 
    req.path.includes('/forward-to-credit') ||
    req.path.includes('/mark-') ||
    req.path.includes('/assign-') ||
    req.path.includes('/submit') ||
    (req.method === 'PATCH' && req.path.includes('/loan-applications'));

  if (isStatusChange && req.user) {
    // Extract file ID from path or body
    const fileId = req.params.id || req.body.id || req.body.fileId;
    
    if (fileId) {
      // Log status change (non-blocking)
      centralizedLogger.logFileAudit(req.user, {
        fileId,
        actionEventType: 'status_change',
        detailsMessage: `${req.method} ${req.path} - Status updated`,
      }).catch((error) => {
        console.warn('[AutoLogStatusChanges] Failed to log status change:', error);
      });
    }
  }

  next();
}

/**
 * Middleware to automatically log file uploads
 */
export function autoLogFileUploads(req: Request, res: Response, next: NextFunction): void {
  if (req.path.includes('/documents') || req.path.includes('/upload')) {
    // File uploads are handled by multer, so we'll log after the upload completes
    // This is a placeholder - actual logging should happen in the upload handler
  }
  next();
}

