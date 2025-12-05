/**
 * Vercel Serverless Function Entry Point
 * Wraps the Express app for Vercel deployment
 */

// Set Vercel flag before importing
process.env.VERCEL = '1';

import app from '../backend/src/server.js';

// Export as default handler for Vercel
export default app;

