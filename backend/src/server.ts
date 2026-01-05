/**
 * Express Server Entry Point
 */

import express from 'express';
import dotenv from 'dotenv';
import routes from './routes/index.js';
import { handleError } from './utils/errors.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
// CORS completely removed - allow all origins without restrictions
app.use((req, res, next) => {
  // Allow any origin (dynamically set from request)
  const origin = req.headers.origin || '*';
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Vary', 'Origin');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});
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

