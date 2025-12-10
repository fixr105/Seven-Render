/**
 * Cache Service for Webhook Data
 * Prevents excessive webhook executions by caching GET responses
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export class CacheService {
  private cache: Map<string, CacheEntry<any>> = new Map();

  /**
   * Get cached data if available
   * Cache persists until explicitly invalidated (no TTL expiration)
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    // Return cached data (no expiration check - cache holds until invalidated)
    return entry.data as T;
  }

  /**
   * Set cached data (persists until explicitly invalidated)
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const now = Date.now();

    this.cache.set(key, {
      data,
      timestamp: now,
      // No expiresAt - cache holds until invalidated
    });
  }

  /**
   * Clear specific cache entry
   */
  clear(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries matching a pattern
   */
  clearPattern(pattern: string | RegExp): void {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    const keysToDelete: string[] = [];

    this.cache.forEach((_, key) => {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Clear all cache
   */
  clearAll(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Singleton instance
export const cacheService = new CacheService();

