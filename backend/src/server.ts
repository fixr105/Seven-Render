/**
 * Express Server Entry Point
 */

import express from 'express';
import dotenv from 'dotenv';
import helmet from 'helmet';
import routes from './routes/index.js';
import { handleError } from './utils/errors.js';
import { defaultLogger } from './utils/logger.js';
import { setupErrorHandlers } from './utils/errorTracker.js';
import { apmMiddleware } from './utils/apm.js';
import { setupUptimeMonitoring } from './utils/uptimeMonitor.js';
import { validateEnvironment } from './utils/envValidation.js';

dotenv.config();

// Validate environment variables (warn only, don't exit in production)
if (process.env.NODE_ENV === 'production') {
  const envResult = validateEnvironment();
  if (envResult.errors.length > 0) {
    defaultLogger.error('Environment validation failed', { errors: envResult.errors });
    // In production, log but don't exit (to avoid breaking deployments)
    // The validation script can be run separately for pre-deployment checks
  }
  if (envResult.warnings.length > 0) {
    defaultLogger.warn('Environment validation warnings', { warnings: envResult.warnings });
  }
}

// Setup global error handlers (unhandled rejections, uncaught exceptions)
setupErrorHandlers();

// Setup uptime monitoring (if configured)
if (process.env.UPTIME_NOTIFY_URL) {
  setupUptimeMonitoring();
}

const app = express();
const PORT = process.env.PORT || 3001;

// Security Headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.N8N_BASE_URL || ''],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

// APM middleware for performance monitoring
app.use(apmMiddleware);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes - mount at /api for frontend compatibility
app.use('/api', routes);

// Health check at root (for Fly.io health checks)
// Full health check is available at /api/health
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
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
  defaultLogger.info('Daily summary job started');
} catch (error: any) {
  defaultLogger.warn('Failed to start daily summary job', { error: error.message });
  // Don't fail server startup if job fails to start
}

// Start server
app.listen(PORT, () => {
  defaultLogger.info('Server started', { port: PORT, environment: process.env.NODE_ENV || 'development' });
});

export default app;

