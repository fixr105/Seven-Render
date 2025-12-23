/**
 * Vercel Serverless Function Entry Point
 * Production-ready Express app wrapper for Vercel
 * 
 * This handler properly adapts Vercel's serverless function format
 * to work with Express, handling all HTTP methods correctly.
 */

// Set Vercel environment flag BEFORE any imports
process.env.VERCEL = '1';

import serverless from 'serverless-http';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Import the Express app
// Use dynamic import to handle TypeScript compilation
let app: any = null;

async function getApp() {
  if (!app) {
    // Dynamic import to ensure proper TypeScript handling
    const serverModule = await import('../backend/src/server.js');
    app = serverModule.default;
  }
  return app;
}

/**
 * Vercel serverless function handler
 * Properly handles all HTTP methods (GET, POST, PUT, DELETE, PATCH, etc.)
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  try {
    const expressApp = await getApp();
    
    // Normalize the request URL
    // Vercel routes /api/* to this function, but Express expects routes without /api prefix
    let path = req.url || '/';
    
    // Remove /api prefix if present
    if (path.startsWith('/api')) {
      path = path.replace('/api', '') || '/';
    }
    
    // Ensure path starts with /
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    
    // Update the request URL for Express routing
    req.url = path;
    if ('originalUrl' in req) {
      (req as any).originalUrl = path;
    }
    
    // Ensure method is set
    if (!req.method) {
      req.method = 'GET';
    }
    
    // Use serverless-http to properly wrap Express for Vercel
    const handler = serverless(expressApp);
    await handler(req, res);
  } catch (error: any) {
    console.error('Serverless function error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message,
      });
    }
  }
}

