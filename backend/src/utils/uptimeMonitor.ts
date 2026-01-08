/**
 * Uptime Monitoring Utility
 * Provides endpoints and utilities for external uptime monitoring services
 */

import { defaultLogger } from './logger.js';
import fetch from 'node-fetch';

export interface UptimeCheckResult {
  status: 'up' | 'down' | 'degraded';
  responseTime: number;
  timestamp: Date;
  message?: string;
}

/**
 * Perform an internal health check
 */
export async function performHealthCheck(): Promise<UptimeCheckResult> {
  const startTime = Date.now();
  
  try {
    // Check basic server health
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;
    
    // Check if heap usage is too high (warning threshold: 500MB)
    if (heapUsedMB > 500) {
      return {
        status: 'degraded',
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
        message: `High memory usage: ${Math.round(heapUsedMB)}MB`,
      };
    }

    // Check n8n webhook availability if configured
    if (process.env.N8N_BASE_URL) {
      try {
        const n8nStartTime = Date.now();
        const response = await fetch(`${process.env.N8N_BASE_URL}/health`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        });
        const n8nResponseTime = Date.now() - n8nStartTime;
        
        if (!response.ok) {
          return {
            status: 'degraded',
            responseTime: Date.now() - startTime,
            timestamp: new Date(),
            message: `n8n webhook returned ${response.status}`,
          };
        }
      } catch (error: any) {
        return {
          status: 'degraded',
          responseTime: Date.now() - startTime,
          timestamp: new Date(),
          message: `n8n webhook unreachable: ${error.message}`,
        };
      }
    }

    return {
      status: 'up',
      responseTime: Date.now() - startTime,
      timestamp: new Date(),
      message: 'All systems operational',
    };
  } catch (error: any) {
    return {
      status: 'down',
      responseTime: Date.now() - startTime,
      timestamp: new Date(),
      message: `Health check failed: ${error.message}`,
    };
  }
}

/**
 * Notify external uptime monitoring service
 */
export async function notifyUptimeService(
  url: string,
  apiKey?: string,
  result?: UptimeCheckResult
): Promise<void> {
  if (!result) {
    result = await performHealthCheck();
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
      headers['X-API-Key'] = apiKey;
    }

    await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        status: result.status,
        responseTime: result.responseTime,
        timestamp: result.timestamp.toISOString(),
        message: result.message,
        service: 'seven-fincorp-backend',
        environment: process.env.NODE_ENV || 'development',
      }),
    }).catch((err) => {
      defaultLogger.error('Failed to notify uptime service', {
        error: err.message,
        url,
      });
    });
  } catch (error: any) {
    defaultLogger.error('Uptime service notification error', {
      error: error.message,
      url,
    });
  }
}

/**
 * Setup periodic uptime checks and notifications
 */
export function setupUptimeMonitoring() {
  const checkInterval = parseInt(process.env.UPTIME_CHECK_INTERVAL || '60000', 10); // Default: 1 minute
  const notifyUrl = process.env.UPTIME_NOTIFY_URL;
  const notifyApiKey = process.env.UPTIME_NOTIFY_API_KEY;

  if (!notifyUrl) {
    defaultLogger.info('Uptime monitoring notifications disabled (UPTIME_NOTIFY_URL not set)');
    return;
  }

  defaultLogger.info('Uptime monitoring enabled', {
    checkInterval,
    notifyUrl,
  });

  // Perform initial check
  performHealthCheck().then((result) => {
    if (notifyUrl) {
      notifyUptimeService(notifyUrl, notifyApiKey, result);
    }
  });

  // Set up periodic checks
  setInterval(async () => {
    const result = await performHealthCheck();
    defaultLogger.debug('Uptime check performed', {
      status: result.status,
      responseTime: result.responseTime,
    });

    if (notifyUrl) {
      await notifyUptimeService(notifyUrl, notifyApiKey, result);
    }
  }, checkInterval);
}
