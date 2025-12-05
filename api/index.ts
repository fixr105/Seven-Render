/**
 * Vercel Serverless Function Entry Point
 * Wraps the Express app for Vercel deployment
 */

// Set Vercel flag before importing
process.env.VERCEL = '1';

import app from '../backend/src/server.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Export as Vercel serverless function handler
// This properly handles all HTTP methods (GET, POST, PUT, DELETE, etc.)
export default function handler(req: VercelRequest, res: VercelResponse) {
  // Remove the /api prefix from the path since Vercel already routes to /api/*
  // The Express app expects routes without the /api prefix
  const originalUrl = req.url || '';
  if (originalUrl.startsWith('/api')) {
    req.url = originalUrl.replace('/api', '') || '/';
  }
  
  // Handle the request with Express app
  return app(req, res);
}

