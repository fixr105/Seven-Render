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

    // n8n health check removed to avoid automated GET calls and exhausting n8n executions

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
 * Setup periodic uptime checks and notifications.
 * Disabled: no setInterval or initial notify, to avoid automated GET/POST that exhaust n8n executions.
 * Health checks remain available on-demand via GET /api/health and GET /api/uptime.
 */
export function setupUptimeMonitoring() {
  return; // No-op: no periodic checks or notifications
}
