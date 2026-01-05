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
// For server-based deployment (Render), configure CORS_ORIGIN to your frontend domain
// Example: CORS_ORIGIN=https://your-app.vercel.app (if frontend on Vercel)
app.use(cors({
  origin: process.env.CORS_ORIGIN || true, // Allow all origins in dev, specific origin in prod
  credentials: true, // Allow cookies to be sent with requests
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes - mount at /api for frontend compatibility
app.use('/api', routes);

// Also mount at root for health check (for Fly.io health checks)
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
  });
});

// Error handling
app.use(handleError);

// Start background jobs
// Note: Background jobs are enabled for server-based deployment (Render, self-hosted)
// They were disabled in serverless environments (Vercel) but are now enabled
try {
  const { dailySummaryJob } = await import('./jobs/dailySummary.job.js');
  dailySummaryJob.start();
  console.log('✅ Daily summary job started');
} catch (error: any) {
  console.warn('⚠️  Failed to start daily summary job:', error.message);
  // Don't fail server startup if job fails to start
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;

