/**
 * Vercel Serverless Function Entry Point
 * Wraps the Express app for Vercel deployment using serverless-http
 */

// Set Vercel flag before importing
process.env.VERCEL = '1';

import app from '../backend/src/server.js';
import serverless from 'serverless-http';

// Wrap Express app with serverless-http
// This properly handles all HTTP methods and adapts requests/responses
const handler = serverless(app, {
  binary: ['image/*', 'application/pdf', 'application/octet-stream'],
});

// Export the handler
export default handler;

