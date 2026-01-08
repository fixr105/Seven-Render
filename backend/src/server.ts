/**
 * Express Server Entry Point
 */

import express from 'express';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cors from 'cors';
import routes from './routes/index.js';
import { handleError } from './utils/errors.js';
import { defaultLogger } from './utils/logger.js';

dotenv.config();

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

// CORS Configuration - Environment-based allowlist
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (mobile apps, Postman, etc.) in development
    if (!origin && process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }

    // Get allowed origins from environment variable
    const allowedOrigins = process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
      : [];

    // If CORS_ORIGIN is not set, allow all in development, deny in production
    if (allowedOrigins.length === 0) {
      if (process.env.NODE_ENV === 'development') {
        return callback(null, true);
      }
      return callback(new Error('CORS_ORIGIN not configured for production'));
    }

    // Check if origin is in allowed list
    if (origin && allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Request-ID'],
};

app.use(cors(corsOptions));

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

