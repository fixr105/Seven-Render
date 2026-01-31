/**
 * Express Server Entry Point
 */

import express from 'express';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
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

// CORS configuration
// In production, default to lms.sevenfincorp.com when CORS_ORIGIN is unset (e.g. Fly.io without secret)
const corsOriginRaw =
  process.env.CORS_ORIGIN ||
  (process.env.NODE_ENV === 'production' ? 'https://lms.sevenfincorp.com' : undefined);
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    const allowedOrigins = corsOriginRaw
      ? corsOriginRaw.split(',').map((o) => o.trim()).filter(Boolean)
      : ['*'];

    // Allow requests with no origin (curl, Postman, mobile, etc.)
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      defaultLogger.warn('CORS blocked request', { origin, allowedOrigins });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

// APM middleware for performance monitoring
app.use(apmMiddleware);

// Cookie parser middleware (for HTTP-only cookies)
app.use(cookieParser());

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

// Daily summary job disabled: it uses n8nClient.fetchTable (n8n) on a cron and would exhaust n8n executions.
// Reports "Generate" button still triggers the report via API when the user clicks (user-initiated).
// try {
//   const { dailySummaryJob } = await import('./jobs/dailySummary.job.js');
//   dailySummaryJob.start();
// } catch (error: any) { defaultLogger.warn('Failed to start daily summary job', { error: error.message }); }

// Start server
app.listen(PORT, () => {
  defaultLogger.info('Server started', { port: PORT, environment: process.env.NODE_ENV || 'development' });
});

export default app;

