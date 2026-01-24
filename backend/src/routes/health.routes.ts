/**
 * Health Check and Metrics Routes
 */

import { Router, Request, Response } from 'express';
import { defaultLogger } from '../utils/logger.js';
import { performHealthCheck } from '../utils/uptimeMonitor.js';

const router = Router();

// Health check data
let healthData = {
  status: 'healthy',
  uptime: process.uptime(),
  timestamp: new Date().toISOString(),
  version: process.env.npm_package_version || '1.0.0',
  environment: process.env.NODE_ENV || 'development',
};

// Metrics data
const metrics = {
  requests: {
    total: 0,
    byEndpoint: {} as Record<string, number>,
    errors: 0,
  },
  responseTimes: [] as number[],
  startTime: Date.now(),
};

/**
 * GET /health
 * Expanded health check endpoint
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const checks: Record<string, { status: string; message?: string; latency?: number }> = {};

    // Basic server check
    checks.server = {
      status: 'healthy',
      message: 'Server is running',
    };

    // Memory usage check
    const memoryUsage = process.memoryUsage();
    const memoryUsageMB = {
      rss: Math.round(memoryUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      external: Math.round(memoryUsage.external / 1024 / 1024),
    };
    checks.memory = {
      status: memoryUsageMB.heapUsed < 500 ? 'healthy' : 'warning',
      message: `Heap used: ${memoryUsageMB.heapUsed}MB / ${memoryUsageMB.heapTotal}MB`,
    };

    // n8n health check removed to avoid automated GET calls and exhausting n8n executions

    // Determine overall status
    const overallStatus = Object.values(checks).every(c => c.status === 'healthy')
      ? 'healthy'
      : Object.values(checks).some(c => c.status === 'unhealthy')
      ? 'unhealthy'
      : 'degraded';

    healthData = {
      status: overallStatus,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    };

    const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;

    res.status(statusCode).json({
      success: true,
      status: overallStatus,
      checks,
      ...healthData,
      memory: memoryUsageMB,
    });
  } catch (error: any) {
    defaultLogger.error('Health check error', { error: error.message });
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: error.message,
      ...healthData,
    });
  }
});

/**
 * GET /metrics
 * Prometheus-style metrics endpoint
 */
router.get('/metrics', (req: Request, res: Response) => {
  try {
    const uptime = Date.now() - metrics.startTime;
    const avgResponseTime = metrics.responseTimes.length > 0
      ? metrics.responseTimes.reduce((a, b) => a + b, 0) / metrics.responseTimes.length
      : 0;

    // Prometheus format
    const prometheusMetrics = `
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total ${metrics.requests.total}

# HELP http_requests_errors_total Total number of HTTP errors
# TYPE http_requests_errors_total counter
http_requests_errors_total ${metrics.requests.errors}

# HELP http_request_duration_seconds Average HTTP request duration
# TYPE http_request_duration_seconds gauge
http_request_duration_seconds ${avgResponseTime / 1000}

# HELP process_uptime_seconds Process uptime in seconds
# TYPE process_uptime_seconds gauge
process_uptime_seconds ${uptime / 1000}

# HELP process_memory_heap_used_bytes Heap memory used in bytes
# TYPE process_memory_heap_used_bytes gauge
process_memory_heap_used_bytes ${process.memoryUsage().heapUsed}
`.trim();

    res.set('Content-Type', 'text/plain');
    res.send(prometheusMetrics);
  } catch (error: any) {
    defaultLogger.error('Metrics error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /metrics/json
 * JSON format metrics endpoint
 */
router.get('/metrics/json', (req: Request, res: Response) => {
  try {
    const uptime = Date.now() - metrics.startTime;
    const avgResponseTime = metrics.responseTimes.length > 0
      ? metrics.responseTimes.reduce((a, b) => a + b, 0) / metrics.responseTimes.length
      : 0;

    res.json({
      success: true,
      metrics: {
        requests: {
          total: metrics.requests.total,
          errors: metrics.requests.errors,
          successRate: metrics.requests.total > 0
            ? ((metrics.requests.total - metrics.requests.errors) / metrics.requests.total * 100).toFixed(2) + '%'
            : '0%',
          byEndpoint: metrics.requests.byEndpoint,
        },
        performance: {
          averageResponseTime: avgResponseTime,
          uptime: uptime / 1000, // in seconds
        },
        memory: {
          heapUsed: process.memoryUsage().heapUsed,
          heapTotal: process.memoryUsage().heapTotal,
          rss: process.memoryUsage().rss,
        },
      },
    });
  } catch (error: any) {
    defaultLogger.error('Metrics JSON error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /uptime
 * Uptime monitoring endpoint (for external services like UptimeRobot, Pingdom)
 */
router.get('/uptime', async (req: Request, res: Response) => {
  try {
    const result = await performHealthCheck();
    const statusCode = result.status === 'up' ? 200 : result.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json({
      success: result.status === 'up',
      status: result.status,
      responseTime: result.responseTime,
      timestamp: result.timestamp.toISOString(),
      message: result.message,
    });
  } catch (error: any) {
    defaultLogger.error('Uptime check error', { error: error.message });
    res.status(503).json({
      success: false,
      status: 'down',
      error: error.message,
    });
  }
});

/**
 * Middleware to track metrics
 */
export function trackMetrics(req: Request, res: Response, next: Function) {
  const startTime = Date.now();
  const endpoint = `${req.method} ${req.path}`;

  // Increment request counter
  metrics.requests.total++;
  metrics.requests.byEndpoint[endpoint] = (metrics.requests.byEndpoint[endpoint] || 0) + 1;

  // Track response time
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    metrics.responseTimes.push(responseTime);
    
    // Keep only last 1000 response times
    if (metrics.responseTimes.length > 1000) {
      metrics.responseTimes.shift();
    }

    // Track errors
    if (res.statusCode >= 400) {
      metrics.requests.errors++;
    }
  });

  next();
}

export default router;
