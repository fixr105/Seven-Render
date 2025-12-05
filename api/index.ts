/**
 * Vercel Serverless Function Entry Point
 * Wraps the Express app for Vercel deployment
 */

// Set Vercel flag before importing
process.env.VERCEL = '1';

import app from '../backend/src/server.js';

// For Vercel, we can export the Express app directly
// Vercel will automatically handle it as a serverless function
// The /api prefix is already stripped by Vercel's routing
export default app;

