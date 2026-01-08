/**
 * Application Performance Monitoring (APM) Utility
 * Supports integration with APM tools like New Relic, Datadog, or custom metrics
 */

import { defaultLogger } from './logger.js';
import fetch from 'node-fetch';

export interface APMMetric {
  name: string;
  value: number;
  unit?: string;
  tags?: Record<string, string>;
  timestamp?: Date;
}

export interface APMTransaction {
  name: string;
  type: 'web' | 'db' | 'external' | 'custom';
  startTime: number;
  endTime?: number;
  duration?: number;
  status?: 'success' | 'error';
  metadata?: Record<string, any>;
}

export interface APM {
  startTransaction: (name: string, type?: APMTransaction['type']) => APMTransaction;
  endTransaction: (transaction: APMTransaction, status?: APMTransaction['status']) => void;
  recordMetric: (metric: APMMetric) => void;
  recordError: (error: Error, context?: Record<string, any>) => void;
}

/**
 * HTTP-based APM (for custom endpoints or services)
 */
class HttpAPM implements APM {
  private url: string;
  private apiKey?: string;
  private serviceName: string;
  private environment: string;
  private metricsBuffer: APMMetric[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor(options: {
    url: string;
    apiKey?: string;
    serviceName?: string;
    environment?: string;
    flushInterval?: number;
  }) {
    this.url = options.url;
    this.apiKey = options.apiKey;
    this.serviceName = options.serviceName || 'seven-fincorp-backend';
    this.environment = options.environment || process.env.NODE_ENV || 'development';
    
    // Flush metrics every 10 seconds
    const interval = options.flushInterval || 10000;
    this.flushInterval = setInterval(() => this.flushMetrics(), interval);
  }

  startTransaction(name: string, type: APMTransaction['type'] = 'web'): APMTransaction {
    return {
      name,
      type,
      startTime: Date.now(),
    };
  }

  endTransaction(transaction: APMTransaction, status: APMTransaction['status'] = 'success') {
    transaction.endTime = Date.now();
    transaction.duration = transaction.endTime - transaction.startTime;
    transaction.status = status;

    this.sendTransaction(transaction);
  }

  recordMetric(metric: APMMetric) {
    this.metricsBuffer.push({
      ...metric,
      timestamp: metric.timestamp || new Date(),
    });

    // Flush if buffer is getting large
    if (this.metricsBuffer.length >= 100) {
      this.flushMetrics();
    }
  }

  recordError(error: Error, context?: Record<string, any>) {
    this.recordMetric({
      name: 'error.count',
      value: 1,
      tags: {
        error_type: error.name,
        error_message: error.message,
        ...context,
      },
    });
  }

  private async sendTransaction(transaction: APMTransaction) {
    try {
      const data = {
        type: 'transaction',
        service: this.serviceName,
        environment: this.environment,
        transaction,
        timestamp: new Date().toISOString(),
      };

      await this.sendData(data);
    } catch (err) {
      defaultLogger.error('Failed to send transaction to APM', { error: err });
    }
  }

  private async flushMetrics() {
    if (this.metricsBuffer.length === 0) return;

    const metrics = [...this.metricsBuffer];
    this.metricsBuffer = [];

    try {
      const data = {
        type: 'metrics',
        service: this.serviceName,
        environment: this.environment,
        metrics,
        timestamp: new Date().toISOString(),
      };

      await this.sendData(data);
    } catch (err) {
      defaultLogger.error('Failed to flush metrics to APM', { error: err });
    }
  }

  private async sendData(data: any) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
      headers['X-API-Key'] = this.apiKey;
    }

    await fetch(this.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    }).catch((err) => {
      defaultLogger.error('APM service error', { error: err.message });
    });
  }

  destroy() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    // Flush remaining metrics
    this.flushMetrics();
  }
}

/**
 * New Relic APM integration
 */
class NewRelicAPM implements APM {
  private licenseKey: string;
  private appName: string;

  constructor(options: { licenseKey: string; appName?: string }) {
    this.licenseKey = options.licenseKey;
    this.appName = options.appName || 'seven-fincorp-backend';
  }

  startTransaction(name: string, type: APMTransaction['type'] = 'web'): APMTransaction {
    return {
      name,
      type,
      startTime: Date.now(),
    };
  }

  endTransaction(transaction: APMTransaction, status: APMTransaction['status'] = 'success') {
    transaction.endTime = Date.now();
    transaction.duration = transaction.endTime - transaction.startTime;
    transaction.status = status;

    // Send to New Relic Insights API
    this.sendToNewRelic(transaction);
  }

  recordMetric(metric: APMMetric) {
    this.sendMetricToNewRelic(metric);
  }

  recordError(error: Error, context?: Record<string, any>) {
    this.recordMetric({
      name: 'Errors/All',
      value: 1,
      tags: {
        error_type: error.name,
        error_message: error.message,
        ...context,
      },
    });
  }

  private async sendToNewRelic(transaction: APMTransaction) {
    try {
      const event = {
        eventType: 'Transaction',
        appName: this.appName,
        name: transaction.name,
        type: transaction.type,
        duration: transaction.duration,
        status: transaction.status,
        timestamp: transaction.startTime,
        ...transaction.metadata,
      };

      await fetch('https://insights-collector.newrelic.com/v1/accounts/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Api-Key': this.licenseKey,
        },
        body: JSON.stringify([event]),
      }).catch((err) => {
        defaultLogger.error('Failed to send transaction to New Relic', { error: err.message });
      });
    } catch (err) {
      defaultLogger.error('New Relic APM error', { error: err });
    }
  }

  private async sendMetricToNewRelic(metric: APMMetric) {
    try {
      const event = {
        eventType: 'Metric',
        appName: this.appName,
        name: metric.name,
        value: metric.value,
        unit: metric.unit,
        ...metric.tags,
        timestamp: (metric.timestamp || new Date()).getTime(),
      };

      await fetch('https://insights-collector.newrelic.com/v1/accounts/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Api-Key': this.licenseKey,
        },
        body: JSON.stringify([event]),
      }).catch((err) => {
        defaultLogger.error('Failed to send metric to New Relic', { error: err.message });
      });
    } catch (err) {
      defaultLogger.error('New Relic APM error', { error: err });
    }
  }
}

/**
 * Console-only APM (fallback for development)
 */
class ConsoleAPM implements APM {
  startTransaction(name: string, type: APMTransaction['type'] = 'web'): APMTransaction {
    return {
      name,
      type,
      startTime: Date.now(),
    };
  }

  endTransaction(transaction: APMTransaction, status: APMTransaction['status'] = 'success') {
    transaction.endTime = Date.now();
    transaction.duration = transaction.endTime - transaction.startTime;
    transaction.status = status;

    defaultLogger.info('Transaction completed', {
      name: transaction.name,
      type: transaction.type,
      duration: transaction.duration,
      status: transaction.status,
    });
  }

  recordMetric(metric: APMMetric) {
    defaultLogger.debug('Metric recorded', {
      name: metric.name,
      value: metric.value,
      unit: metric.unit,
      tags: metric.tags,
    });
  }

  recordError(error: Error, context?: Record<string, any>) {
    defaultLogger.error('Error recorded', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      context,
    });
  }
}

/**
 * Create APM instance based on environment configuration
 */
function createAPM(): APM {
  // New Relic integration
  if (process.env.NEW_RELIC_LICENSE_KEY) {
    return new NewRelicAPM({
      licenseKey: process.env.NEW_RELIC_LICENSE_KEY,
      appName: process.env.NEW_RELIC_APP_NAME || 'seven-fincorp-backend',
    });
  }

  // Custom HTTP endpoint
  if (process.env.APM_URL) {
    return new HttpAPM({
      url: process.env.APM_URL,
      apiKey: process.env.APM_API_KEY,
      serviceName: 'seven-fincorp-backend',
      environment: process.env.NODE_ENV || 'development',
      flushInterval: parseInt(process.env.APM_FLUSH_INTERVAL || '10000', 10),
    });
  }

  // Fallback to console
  return new ConsoleAPM();
}

/**
 * Global APM instance
 */
export const apm = createAPM();

/**
 * Express middleware for automatic transaction tracking
 */
export function apmMiddleware(req: any, res: any, next: any) {
  const transaction = apm.startTransaction(`${req.method} ${req.path}`, 'web');
  transaction.metadata = {
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  };

  // Store transaction on request object
  (req as any).apmTransaction = transaction;

  // Track response time
  const startTime = Date.now();
  res.on('finish', () => {
    const status = res.statusCode >= 400 ? 'error' : 'success';
    apm.endTransaction(transaction, status);
    
    // Record response time metric
    apm.recordMetric({
      name: 'http.response_time',
      value: Date.now() - startTime,
      unit: 'ms',
      tags: {
        method: req.method,
        path: req.path,
        status_code: String(res.statusCode),
      },
    });
  });

  next();
}
