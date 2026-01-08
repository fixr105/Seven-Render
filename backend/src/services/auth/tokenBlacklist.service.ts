/**
 * Token Blacklist Service
 * Manages blacklisted JWT tokens (for logout and security)
 * 
 * Note: In production, this should use Redis for distributed systems
 * For now, using in-memory storage which works for single-instance deployments
 */

interface BlacklistedToken {
  token: string;
  expiresAt: number; // Unix timestamp
  reason: 'logout' | 'security' | 'rotation';
}

class TokenBlacklistService {
  private blacklist: Map<string, BlacklistedToken> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Clean up expired tokens every hour
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 60 * 1000);
  }

  /**
   * Add token to blacklist
   */
  addToken(token: string, expiresAt: number, reason: 'logout' | 'security' | 'rotation' = 'logout'): void {
    // Store token hash for security (don't store full token)
    const tokenHash = this.hashToken(token);
    this.blacklist.set(tokenHash, {
      token: tokenHash,
      expiresAt,
      reason,
    });
  }

  /**
   * Check if token is blacklisted
   */
  isBlacklisted(token: string): boolean {
    const tokenHash = this.hashToken(token);
    const entry = this.blacklist.get(tokenHash);
    
    if (!entry) {
      return false;
    }

    // Check if token has expired (cleanup should handle this, but double-check)
    if (Date.now() > entry.expiresAt * 1000) {
      this.blacklist.delete(tokenHash);
      return false;
    }

    return true;
  }

  /**
   * Remove token from blacklist (for testing or manual cleanup)
   */
  removeToken(token: string): void {
    const tokenHash = this.hashToken(token);
    this.blacklist.delete(tokenHash);
  }

  /**
   * Clear all blacklisted tokens
   */
  clear(): void {
    this.blacklist.clear();
  }

  /**
   * Clean up expired tokens
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [hash, entry] of this.blacklist.entries()) {
      if (now > entry.expiresAt * 1000) {
        this.blacklist.delete(hash);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[TokenBlacklist] Cleaned up ${cleaned} expired tokens`);
    }
  }

  /**
   * Hash token for storage (simple hash, not cryptographic)
   * In production, use crypto.createHash('sha256')
   */
  private hashToken(token: string): string {
    // Simple hash for now - in production use crypto
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      const char = token.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `blacklist_${Math.abs(hash).toString(36)}`;
  }

  /**
   * Get blacklist stats (for monitoring)
   */
  getStats(): { total: number; byReason: Record<string, number> } {
    const byReason: Record<string, number> = {};
    for (const entry of this.blacklist.values()) {
      byReason[entry.reason] = (byReason[entry.reason] || 0) + 1;
    }
    return {
      total: this.blacklist.size,
      byReason,
    };
  }

  /**
   * Cleanup on shutdown
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.blacklist.clear();
  }
}

export const tokenBlacklist = new TokenBlacklistService();
