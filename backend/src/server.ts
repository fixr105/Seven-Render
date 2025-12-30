/**
 * Express Server Entry Point
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import routes from './routes/index.js';
import { handleError } from './utils/errors.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
// CORS configuration - allow credentials (cookies) for authentication
app.use(cors({
  origin: process.env.CORS_ORIGIN || true, // Allow all origins in dev, specific origin in prod
  credentials: true, // Allow cookies to be sent with requests
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/', routes);

// Error handling
app.use(handleError);

// Start background jobs (only if not running on Vercel)
if (process.env.VERCEL !== '1') {
  // Start daily summary job
  try {
    const { dailySummaryJob } = await import('./jobs/dailySummary.job.js');
    dailySummaryJob.start();
    console.log('✅ Daily summary job started');
  } catch (error: any) {
    console.warn('⚠️  Failed to start daily summary job:', error.message);
    // Don't fail server startup if job fails to start
  }
}

// Start server (only if not running on Vercel)
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

export default app;

