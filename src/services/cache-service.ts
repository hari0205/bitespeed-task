/**
 * Cache Service
 * Provides multiple caching strategies for improved performance
 */

import { logger } from '../utils/logger';

/**
 * Cache entry interface
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  hits: number;
}

/**
 * Cache statistics interface
 */
export interface CacheStats {
  hits: number;
  misses: number;
  entries: number;
  hitRate: number;
  memoryUsage: number;
}

/**
 * In-memory cache implementation
 * In production, consider using Redis for distributed caching
 */
export class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private stats = {
    hits: 0,
    misses: 0,
  };

  constructor(
    private defaultTtl: number = 300000, // 5 minutes default
    private maxSize: number = 1000 // Maximum cache entries
  ) {
    // Clean up expired entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Get value from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update hit count and stats
    entry.hits++;
    this.stats.hits++;

    logger.debug('Cache hit', {
      key,
      hits: entry.hits,
      age: Date.now() - entry.timestamp,
    });

    return entry.data;
  }

  /**
   * Set value in cache
   */
  set<T>(key: string, data: T, ttl?: number): void {
    // Enforce cache size limit
    if (this.cache.size >= this.maxSize) {
      this.evictLeastRecentlyUsed();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTtl,
      hits: 0,
    };

    this.cache.set(key, entry);

    logger.debug('Cache set', {
      key,
      ttl: entry.ttl,
      cacheSize: this.cache.size,
    });
  }

  /**
   * Delete value from cache
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      logger.debug('Cache delete', { key });
    }
    return deleted;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.stats.hits = 0;
    this.stats.misses = 0;
    logger.info('Cache cleared', { previousSize: size });
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;

    // Estimate memory usage (rough calculation)
    const memoryUsage = JSON.stringify([...this.cache.entries()]).length;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      entries: this.cache.size,
      hitRate: Math.round(hitRate * 100) / 100,
      memoryUsage,
    };
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug('Cache cleanup completed', {
        entriesRemoved: cleaned,
        remainingEntries: this.cache.size,
      });
    }
  }

  /**
   * Evict least recently used entry when cache is full
   */
  private evictLeastRecentlyUsed(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      logger.debug('Cache eviction', {
        evictedKey: oldestKey,
        age: Date.now() - oldestTime,
      });
    }
  }
}

/**
 * Cache service with multiple cache instances
 */
export class CacheService {
  // Different caches for different data types with appropriate TTLs
  private contactCache = new MemoryCache(600000, 500); // 10 minutes, 500 entries
  private queryCache = new MemoryCache(300000, 1000); // 5 minutes, 1000 entries
  private analyticsCache = new MemoryCache(60000, 100); // 1 minute, 100 entries

  /**
   * Cache contact data
   */
  cacheContact(key: string, contact: any, ttl?: number): void {
    this.contactCache.set(key, contact, ttl);
  }

  /**
   * Get cached contact data
   */
  getCachedContact(key: string): any | null {
    return this.contactCache.get(key);
  }

  /**
   * Cache query results
   */
  cacheQuery(key: string, result: any, ttl?: number): void {
    this.queryCache.set(key, result, ttl);
  }

  /**
   * Get cached query results
   */
  getCachedQuery(key: string): any | null {
    return this.queryCache.get(key);
  }

  /**
   * Cache analytics data
   */
  cacheAnalytics(key: string, data: any, ttl?: number): void {
    this.analyticsCache.set(key, data, ttl);
  }

  /**
   * Get cached analytics data
   */
  getCachedAnalytics(key: string): any | null {
    return this.analyticsCache.get(key);
  }

  /**
   * Invalidate contact-related caches
   */
  invalidateContactCaches(email?: string, phoneNumber?: string): void {
    // Invalidate specific contact caches
    if (email) {
      this.contactCache.delete(`contact:email:${email}`);
      this.queryCache.delete(`contacts:email:${email}`);
    }
    if (phoneNumber) {
      this.contactCache.delete(`contact:phone:${phoneNumber}`);
      this.queryCache.delete(`contacts:phone:${phoneNumber}`);
    }

    logger.debug('Contact caches invalidated', { email, phoneNumber });
  }

  /**
   * Get comprehensive cache statistics
   */
  getStats(): {
    contact: CacheStats;
    query: CacheStats;
    analytics: CacheStats;
    total: {
      hits: number;
      misses: number;
      entries: number;
      hitRate: number;
      memoryUsage: number;
    };
  } {
    const contactStats = this.contactCache.getStats();
    const queryStats = this.queryCache.getStats();
    const analyticsStats = this.analyticsCache.getStats();

    const totalHits = contactStats.hits + queryStats.hits + analyticsStats.hits;
    const totalMisses =
      contactStats.misses + queryStats.misses + analyticsStats.misses;
    const totalRequests = totalHits + totalMisses;
    const totalHitRate = totalRequests > 0 ? totalHits / totalRequests : 0;

    return {
      contact: contactStats,
      query: queryStats,
      analytics: analyticsStats,
      total: {
        hits: totalHits,
        misses: totalMisses,
        entries:
          contactStats.entries + queryStats.entries + analyticsStats.entries,
        hitRate: Math.round(totalHitRate * 100) / 100,
        memoryUsage:
          contactStats.memoryUsage +
          queryStats.memoryUsage +
          analyticsStats.memoryUsage,
      },
    };
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    this.contactCache.clear();
    this.queryCache.clear();
    this.analyticsCache.clear();
    logger.info('All caches cleared');
  }
}

// Export singleton instance
export const cacheService = new CacheService();

// Re-export hybrid cache types
export type { HybridCacheConfig } from './hybrid-cache-service';
export {
  HybridCacheService,
  createHybridCacheService,
} from './hybrid-cache-service';
