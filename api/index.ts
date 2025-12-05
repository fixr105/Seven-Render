/**
 * Vercel Serverless Function Entry Point
 * Wraps the Express app for Vercel deployment
 */

// Set Vercel flag before importing
process.env.VERCEL = '1';

import app from '../backend/src/server.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Vercel serverless function handler
// This properly adapts Vercel's request/response to Express
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Remove the /api prefix from the URL path
  // Vercel routes /api/* to this function, but Express expects routes without /api
  if (req.url && req.url.startsWith('/api')) {
    req.url = req.url.replace('/api', '') || '/';
  }
  
  // Also update the path for Express routing
  if (req.url) {
    // Ensure we have a leading slash
    if (!req.url.startsWith('/')) {
      req.url = '/' + req.url;
    }
  } else {
    req.url = '/';
  }
  
  // Handle the request with Express app
  // Express app expects Node.js req/res, which Vercel provides
  return app(req, res);
}

