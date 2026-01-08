/**
 * HTTP Client with Retry Logic and Circuit Breaker
 * Provides resilient HTTP requests for external API calls (n8n webhooks)
 */

import fetch, { RequestInit, Response } from 'node-fetch';
import { defaultLogger } from './logger.js';

interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  retryOn?: number[]; // HTTP status codes to retry on
  timeout?: number;
}

interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failures: number;
  lastFailureTime: number;
  successCount: number;
}

class CircuitBreaker {
  private state: CircuitBreakerState = {
    state: 'closed',
    failures: 0,
    lastFailureTime: 0,
    successCount: 0,
  };

  private readonly failureThreshold = 5;
  private readonly resetTimeout = 60000; // 60 seconds
  private readonly halfOpenMaxRequests = 3;

  /**
   * Check if request should be allowed
   */
  canAttempt(): boolean {
    const now = Date.now();

    // If circuit is closed, allow request
    if (this.state.state === 'closed') {
      return true;
    }

    // If circuit is open, check if reset timeout has passed
    if (this.state.state === 'open') {
      if (now - this.state.lastFailureTime > this.resetTimeout) {
        // Move to half-open state
        this.state.state = 'half-open';
        this.state.successCount = 0;
        return true;
      }
      return false;
    }

    // If circuit is half-open, allow limited requests
    if (this.state.state === 'half-open') {
      return this.state.successCount < this.halfOpenMaxRequests;
    }

    return false;
  }

  /**
   * Record successful request
   */
  recordSuccess(): void {
    if (this.state.state === 'half-open') {
      this.state.successCount++;
      if (this.state.successCount >= this.halfOpenMaxRequests) {
        // Circuit breaker closed - service is healthy
        this.state.state = 'closed';
        this.state.failures = 0;
        this.state.successCount = 0;
        defaultLogger.info('Circuit breaker closed - service is healthy');
      }
    } else {
      // Reset failure count on success
      this.state.failures = 0;
    }
  }

  /**
   * Record failed request
   */
  recordFailure(): void {
    this.state.failures++;
    this.state.lastFailureTime = Date.now();

    if (this.state.state === 'half-open') {
      // If we're in half-open and get a failure, open the circuit
      this.state.state = 'open';
      this.state.successCount = 0;
      defaultLogger.warn('Circuit breaker opened from half-open state');
    } else if (this.state.failures >= this.failureThreshold) {
      // Open the circuit
      this.state.state = 'open';
      defaultLogger.warn('Circuit breaker opened - too many failures', {
        failures: this.state.failures,
        threshold: this.failureThreshold,
      });
    }
  }

  /**
   * Get current state
   */
  getState(): CircuitBreakerState {
    return { ...this.state };
  }
}

// Circuit breaker instances per base URL
const circuitBreakers = new Map<string, CircuitBreaker>();

function getCircuitBreaker(baseUrl: string): CircuitBreaker {
  if (!circuitBreakers.has(baseUrl)) {
    circuitBreakers.set(baseUrl, new CircuitBreaker());
  }
  return circuitBreakers.get(baseUrl)!;
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 */
function calculateBackoff(attempt: number, baseDelay: number): number {
  return Math.min(baseDelay * Math.pow(2, attempt), 30000); // Max 30 seconds
}

/**
 * HTTP client with retry logic and circuit breaker
 */
export async function httpClient(
  url: string,
  options: RequestInit = {},
  retryOptions: RetryOptions = {}
): Promise<Response> {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    retryOn = [408, 429, 500, 502, 503, 504],
    timeout = 30000,
  } = retryOptions;

  const baseUrl = new URL(url).origin;
  const circuitBreaker = getCircuitBreaker(baseUrl);

  // Check circuit breaker
  if (!circuitBreaker.canAttempt()) {
    const state = circuitBreaker.getState();
    defaultLogger.warn('Circuit breaker is open, request blocked', {
      url,
      state: state.state,
      failures: state.failures,
    });
    throw new Error(`Circuit breaker is open for ${baseUrl}. Service is unavailable.`);
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Check if we should retry based on status code
        if (retryOn.includes(response.status) && attempt < maxRetries) {
          const backoffDelay = calculateBackoff(attempt, retryDelay);
          defaultLogger.warn('Request failed, retrying', {
            url,
            status: response.status,
            attempt: attempt + 1,
            maxRetries,
            backoffDelay,
          });
          await sleep(backoffDelay);
          continue;
        }

        // Success - record in circuit breaker
        if (response.ok) {
          circuitBreaker.recordSuccess();
        } else {
          circuitBreaker.recordFailure();
        }

        return response;
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
    } catch (error: any) {
      lastError = error;

      // Don't retry on certain errors
      if (error.name === 'AbortError' || error.name === 'TypeError') {
        if (attempt < maxRetries) {
          const backoffDelay = calculateBackoff(attempt, retryDelay);
          defaultLogger.warn('Request error, retrying', {
            url,
            error: error.message,
            attempt: attempt + 1,
            maxRetries,
            backoffDelay,
          });
          await sleep(backoffDelay);
          continue;
        }
      }

      // If this is the last attempt, record failure and throw
      if (attempt === maxRetries) {
        circuitBreaker.recordFailure();
        defaultLogger.error('Request failed after all retries', {
          url,
          error: error.message,
          attempts: attempt + 1,
        });
        throw error;
      }

      // Calculate backoff and retry
      const backoffDelay = calculateBackoff(attempt, retryDelay);
      defaultLogger.warn('Request error, retrying', {
        url,
        error: error.message,
        attempt: attempt + 1,
        maxRetries,
        backoffDelay,
      });
      await sleep(backoffDelay);
    }
  }

  // This should never be reached, but TypeScript needs it
  circuitBreaker.recordFailure();
  throw lastError || new Error('Request failed after all retries');
}

/**
 * GET request with retry and circuit breaker
 */
export async function httpGet(
  url: string,
  options: RequestInit = {},
  retryOptions?: RetryOptions
): Promise<Response> {
  return httpClient(url, { ...options, method: 'GET' }, retryOptions);
}

/**
 * POST request with retry and circuit breaker
 */
export async function httpPost(
  url: string,
  body: any,
  options: RequestInit = {},
  retryOptions?: RetryOptions
): Promise<Response> {
  return httpClient(
    url,
    {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    },
    retryOptions
  );
}
