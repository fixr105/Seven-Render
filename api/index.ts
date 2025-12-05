/**
 * Vercel Serverless Function Entry Point
 * Production-ready Express app wrapper for Vercel
 * 
 * This handler properly adapts Vercel's serverless function format
 * to work with Express, handling all HTTP methods correctly.
 */

// Set Vercel environment flag
process.env.VERCEL = '1';

import app from '../backend/src/server.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Vercel serverless function handler
 * Properly handles all HTTP methods (GET, POST, PUT, DELETE, PATCH, etc.)
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
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
  req.originalUrl = path;
  
  // Ensure method is set
  if (!req.method) {
    req.method = 'GET';
  }
  
  // Handle the request with Express app
  // Express will process the request and send the response
  app(req, res, (err?: any) => {
    if (err) {
      console.error('Express error:', err);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
        });
      }
    }
  });
}

