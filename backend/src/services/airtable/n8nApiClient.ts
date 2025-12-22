/**
 * Module 0: Central API Client Wrapper for n8n Webhooks
 * 
 * Provides:
 * - Base URL configuration
 * - Typed request/response
 * - Retries + timeouts
 * - Consistent error mapping
 * - Mock mode support
 */

import fetch from 'node-fetch';
import { getWebhookUrl } from '../../config/webhookConfig.js';

// Configuration
const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds
const DEFAULT_MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000; // 1 second between retries

// Mock mode configuration
const MOCK_MODE = process.env.MOCK_MODE === 'true' || process.env.NODE_ENV === 'test';
const MOCK_DATA_DIR = process.env.MOCK_DATA_DIR || './mock-data';

/**
 * Error types for consistent error handling
 */
export class N8nApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public webhookUrl?: string,
    public responseBody?: string
  ) {
    super(message);
    this.name = 'N8nApiError';
  }
}

export class N8nTimeoutError extends N8nApiError {
  constructor(webhookUrl: string, timeoutMs: number) {
    super(`Request to ${webhookUrl} timed out after ${timeoutMs}ms`, 408, webhookUrl);
    this.name = 'N8nTimeoutError';
  }
}

export class N8nRetryExhaustedError extends N8nApiError {
  constructor(webhookUrl: string, attempts: number, lastError: Error) {
    super(
      `Request to ${webhookUrl} failed after ${attempts} attempts: ${lastError.message}`,
      undefined,
      webhookUrl
    );
    this.name = 'N8nRetryExhaustedError';
  }
}

/**
 * Typed request options
 */
export interface N8nRequestOptions {
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  useCache?: boolean;
  headers?: Record<string, string>;
}

/**
 * Typed response wrapper
 */
export interface N8nResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

/**
 * Sleep utility for retries
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Load mock data from file system
 */
async function loadMockData(tableName: string): Promise<any[]> {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const mockFilePath = path.join(process.cwd(), MOCK_DATA_DIR, `${tableName.toLowerCase().replace(/\s+/g, '-')}.json`);
    
    try {
      const content = await fs.readFile(mockFilePath, 'utf-8');
      return JSON.parse(content);
    } catch (fileError: any) {
      if (fileError.code === 'ENOENT') {
        // File doesn't exist, return empty array
        console.warn(`[MockMode] Mock data file not found: ${mockFilePath}, returning empty array`);
        return [];
      }
      throw fileError;
    }
  } catch (error: any) {
    console.error(`[MockMode] Error loading mock data for ${tableName}:`, error);
    return [];
  }
}

/**
 * Central API Client for n8n Webhooks
 */
export class N8nApiClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || '';
  }

  /**
   * GET request with retries, timeout, and error handling
   */
  async get<T = any>(
    tableName: string,
    options: N8nRequestOptions = {}
  ): Promise<N8nResponse<T[]>> {
    const {
      timeout = DEFAULT_TIMEOUT_MS,
      maxRetries = DEFAULT_MAX_RETRIES,
      retryDelay = RETRY_DELAY_MS,
      headers = {},
    } = options;

    // Mock mode: return mock data
    if (MOCK_MODE) {
      console.log(`[MockMode] GET ${tableName} - returning mock data`);
      const mockData = await loadMockData(tableName);
      return {
        success: true,
        data: mockData,
      };
    }

    const webhookUrl = getWebhookUrl(tableName);
    if (!webhookUrl) {
      return {
        success: false,
        error: `No webhook URL configured for table: ${tableName}`,
      };
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(webhookUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new N8nApiError(
            `Webhook failed: ${response.status} ${response.statusText}`,
            response.status,
            webhookUrl,
            errorText
          );
        }

        const data = await response.json();

        // Handle different response formats
        let records: T[] = [];
        if (Array.isArray(data)) {
          records = data;
        } else if (typeof data === 'object' && data !== null) {
          const dataObj = data as Record<string, any>;
          if (dataObj.records && Array.isArray(dataObj.records)) {
            records = dataObj.records;
          } else if (dataObj.data && Array.isArray(dataObj.data)) {
            records = dataObj.data;
          } else {
            // Single record
            records = [data];
          }
        }

        return {
          success: true,
          data: records,
          statusCode: response.status,
        };
      } catch (error: any) {
        lastError = error;

        // Don't retry on abort (timeout) or 4xx errors
        if (error.name === 'AbortError') {
          throw new N8nTimeoutError(webhookUrl, timeout);
        }

        if (error instanceof N8nApiError && error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
          // Client error, don't retry
          return {
            success: false,
            error: error.message,
            statusCode: error.statusCode,
          };
        }

        // Retry logic
        if (attempt < maxRetries) {
          console.warn(`[N8nApiClient] GET ${tableName} attempt ${attempt} failed, retrying in ${retryDelay}ms...`);
          await sleep(retryDelay * attempt); // Exponential backoff
        }
      }
    }

    // All retries exhausted
    throw new N8nRetryExhaustedError(webhookUrl, maxRetries, lastError!);
  }

  /**
   * POST request with retries, timeout, and error handling
   */
  async post<T = any>(
    webhookUrl: string,
    data: Record<string, any>,
    options: N8nRequestOptions = {}
  ): Promise<N8nResponse<T>> {
    const {
      timeout = DEFAULT_TIMEOUT_MS,
      maxRetries = DEFAULT_MAX_RETRIES,
      retryDelay = RETRY_DELAY_MS,
      headers = {},
    } = options;

    // Mock mode: simulate success
    if (MOCK_MODE) {
      console.log(`[MockMode] POST ${webhookUrl} - simulating success`);
      return {
        success: true,
        data: { id: `mock-${Date.now()}`, ...data } as T,
      };
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          body: JSON.stringify(data),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const responseText = await response.text();

        if (!response.ok) {
          throw new N8nApiError(
            `POST webhook failed: ${response.status} ${response.statusText}`,
            response.status,
            webhookUrl,
            responseText
          );
        }

        // Handle empty response
        if (responseText.trim() === '') {
          return {
            success: true,
            data: { success: true, message: 'Data posted successfully' } as T,
            statusCode: response.status,
          };
        }

        // Try to parse JSON response
        try {
          const parsed = JSON.parse(responseText);
          return {
            success: true,
            data: parsed as T,
            statusCode: response.status,
          };
        } catch (parseError) {
          // Non-JSON response is still success
          return {
            success: true,
            data: { message: responseText, status: response.status } as T,
            statusCode: response.status,
          };
        }
      } catch (error: any) {
        lastError = error;

        // Don't retry on abort (timeout) or 4xx errors
        if (error.name === 'AbortError') {
          throw new N8nTimeoutError(webhookUrl, timeout);
        }

        if (error instanceof N8nApiError && error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
          // Client error, don't retry
          return {
            success: false,
            error: error.message,
            statusCode: error.statusCode,
          };
        }

        // Retry logic
        if (attempt < maxRetries) {
          console.warn(`[N8nApiClient] POST ${webhookUrl} attempt ${attempt} failed, retrying in ${retryDelay}ms...`);
          await sleep(retryDelay * attempt); // Exponential backoff
        }
      }
    }

    // All retries exhausted
    throw new N8nRetryExhaustedError(webhookUrl, maxRetries, lastError!);
  }
}

// Export singleton instance
export const n8nApiClient = new N8nApiClient();


