/**
 * Vercel Serverless Function Entry Point
 * Production-ready Express app wrapper for Vercel
 */

// Set Vercel environment flag BEFORE any imports
process.env.VERCEL = '1';

import serverless from 'serverless-http';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Lazy load the Express app to avoid blocking initialization
let expressApp: any = null;
let handler: any = null;

async function getHandler() {
  if (!handler) {
    if (!expressApp) {
      // Dynamic import to avoid blocking
      const serverModule = await import('../backend/src/server.js');
      expressApp = serverModule.default;
    }
    // Create serverless handler once (reused across invocations)
    handler = serverless(expressApp, {
      binary: ['image/*', 'application/pdf'],
    });
  }
  return handler;
}

/**
 * Vercel serverless function handler
 */
export default async function handlerWrapper(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  try {
    // Normalize the request URL - remove /api prefix
    let path = req.url || '/';
    if (path.startsWith('/api')) {
      path = path.replace('/api', '') || '/';
    }
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    
    // Update request URL for Express
    req.url = path;
    if ('originalUrl' in req) {
      (req as any).originalUrl = path;
    }
    
    // Get handler (lazy loaded)
    const serverlessHandler = await getHandler();
    
    // Call the serverless handler
    return serverlessHandler(req, res);
  } catch (error: any) {
    console.error('Serverless function error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error?.message || 'Unknown error',
      });
    }
  }
}

