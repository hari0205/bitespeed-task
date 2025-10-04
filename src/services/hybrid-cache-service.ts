/**
 * Hybrid Cache Service
 * Provides caching with Redis as primary and in-memory as fallback
 */

import { MemoryCache, CacheStats } from './cache-service';
import { RedisCacheService, RedisCacheConfig } from './redis-cache-service';
import { logger } from '../utils/logger';

/**
 * Cache configuration interface
 */
export interface HybridCacheConfig {
  useRedis: boolean;
  redis?: RedisCacheConfig | undefined;
  fallbackToMemory: boolean;
  memoryCache?: {
    defaultTtl: number;
    maxSize: number;
  };
}

/**
 * Hybrid cache implementation that uses Redis when available,
 * falls back to in-memory cache when Redis is unavailable
 */
export class HybridCacheService {
  private redisCache?: RedisCacheService;
  private memoryCache: MemoryCache;
  private useRedis: boolean;
  private fallbackToMemory: boolean;

  constructor(config: HybridCacheConfig) {
    this.useRedis = config.useRedis;
    this.fallbackToMemory = config.fallbackToMemory;

    // Initialize memory cache as fallback
    const memoryConfig = config.memoryCache || {
      defaultTtl: 300000,
      maxSize: 1000,
    };
    this.memoryCache = new MemoryCache(
      memoryConfig.defaultTtl,
      memoryConfig.maxSize
    );

    // Initialize Redis cache if configured
    if (this.useRedis && config.redis) {
      try {
        this.redisCache = new RedisCacheService(config.redis);
        logger.info('Hybrid cache initialized with Redis support');
      } catch (error) {
        logger.error('Failed to initialize Redis cache', {
          error: error instanceof Error ? error.message : error,
        });
        if (!this.fallbackToMemory) {
          throw error;
        }
      }
    } else {
      logger.info('Hybrid cache initialized with memory-only mode');
    }
  }

  /**
   * Get value from cache (Redis first, then memory fallback)
   */
  async get<T>(key: string): Promise<T | null> {
    // Try Redis first if available
    if (this.useRedis && this.redisCache) {
      try {
        const redisResult = await this.redisCache.get<T>(key);
        if (redisResult !== null) {
          // Also cache in memory for faster subsequent access
          if (this.fallbackToMemory) {
            this.memoryCache.set(key, redisResult);
          }
          return redisResult;
        }
      } catch (error) {
        logger.warn('Redis get failed, falling back to memory cache', {
          key,
          error: error instanceof Error ? error.message : error,
        });
      }
    }

    // Fallback to memory cache
    if (this.fallbackToMemory) {
      return this.memoryCache.get<T>(key);
    }

    return null;
  }

  /**
   * Set value in cache (both Redis and memory if configured)
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const promises: Promise<any>[] = [];

    // Set in Redis if available
    if (this.useRedis && this.redisCache) {
      promises.push(
        this.redisCache.set(key, value, ttl).catch(error => {
          logger.warn('Redis set failed', {
            key,
            error: error instanceof Error ? error.message : error,
          });
        })
      );
    }

    // Set in memory cache if fallback is enabled
    if (this.fallbackToMemory) {
      this.memoryCache.set(key, value, ttl);
    }

    // Wait for Redis operation to complete (but don't fail if it doesn't)
    if (promises.length > 0) {
      await Promise.allSettled(promises);
    }
  }

  /**
   * Delete value from cache (both Redis and memory)
   */
  async delete(key: string): Promise<boolean> {
    let redisResult = false;
    let memoryResult = false;

    // Delete from Redis if available
    if (this.useRedis && this.redisCache) {
      try {
        redisResult = await this.redisCache.delete(key);
      } catch (error) {
        logger.warn('Redis delete failed', {
          key,
          error: error instanceof Error ? error.message : error,
        });
      }
    }

    // Delete from memory cache
    if (this.fallbackToMemory) {
      memoryResult = this.memoryCache.delete(key);
    }

    return redisResult || memoryResult;
  }

  /**
   * Delete multiple keys matching a pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    let deletedCount = 0;

    // Delete from Redis if available
    if (this.useRedis && this.redisCache) {
      try {
        deletedCount += await this.redisCache.deletePattern(pattern);
      } catch (error) {
        logger.warn('Redis pattern delete failed', {
          pattern,
          error: error instanceof Error ? error.message : error,
        });
      }
    }

    // Note: Memory cache doesn't support pattern deletion in current implementation
    // This could be enhanced if needed

    return deletedCount;
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    const promises: Promise<any>[] = [];

    // Clear Redis if available
    if (this.useRedis && this.redisCache) {
      promises.push(
        this.redisCache.clear().catch(error => {
          logger.warn('Redis clear failed', {
            error: error instanceof Error ? error.message : error,
          });
        })
      );
    }

    // Clear memory cache
    if (this.fallbackToMemory) {
      this.memoryCache.clear();
    }

    // Wait for Redis operation to complete
    if (promises.length > 0) {
      await Promise.allSettled(promises);
    }

    logger.info('Hybrid cache cleared');
  }

  /**
   * Get comprehensive cache statistics
   */
  async getStats(): Promise<{
    redis?: CacheStats & { connected: boolean; errors: number };
    memory?: CacheStats;
    mode: 'redis' | 'memory' | 'hybrid';
    redisAvailable: boolean;
  }> {
    const result: any = {
      mode: this.useRedis
        ? this.fallbackToMemory
          ? 'hybrid'
          : 'redis'
        : 'memory',
      redisAvailable: false,
    };

    // Get Redis stats if available
    if (this.useRedis && this.redisCache) {
      try {
        result.redis = await this.redisCache.getStats();
        result.redisAvailable = result.redis.connected;
      } catch (error) {
        logger.warn('Failed to get Redis stats', {
          error: error instanceof Error ? error.message : error,
        });
        result.redisAvailable = false;
      }
    }

    // Get memory cache stats if available
    if (this.fallbackToMemory) {
      result.memory = this.memoryCache.getStats();
    }

    return result;
  }

  /**
   * Check if Redis is available
   */
  async isRedisAvailable(): Promise<boolean> {
    if (!this.useRedis || !this.redisCache) {
      return false;
    }

    try {
      return await this.redisCache.ping();
    } catch (error) {
      return false;
    }
  }

  /**
   * Get Redis info if available
   */
  async getRedisInfo(): Promise<any> {
    if (!this.useRedis || !this.redisCache) {
      return null;
    }

    try {
      return await this.redisCache.getInfo();
    } catch (error) {
      logger.warn('Failed to get Redis info', {
        error: error instanceof Error ? error.message : error,
      });
      return null;
    }
  }

  /**
   * Disconnect from Redis gracefully
   */
  async disconnect(): Promise<void> {
    if (this.redisCache) {
      await this.redisCache.disconnect();
    }
  }
}

/**
 * Create hybrid cache service based on environment configuration
 */
export function createHybridCacheService(): HybridCacheService {
  const useRedis = process.env['USE_REDIS'] === 'true';
  const redisUrl = process.env['REDIS_URL'] || 'redis://localhost:6379';

  // Parse Redis URL
  let redisConfig: RedisCacheConfig | undefined;

  if (useRedis) {
    try {
      const url = new URL(redisUrl);
      redisConfig = {
        host: url.hostname,
        port: parseInt(url.port) || 6379,
        db: url.pathname ? parseInt(url.pathname.slice(1)) : 0,
        keyPrefix: process.env['REDIS_KEY_PREFIX'] || 'identity-api:',
      };

      // Only add password if it exists
      if (url.password) {
        redisConfig.password = url.password;
      }
    } catch (error) {
      logger.error('Invalid Redis URL, falling back to memory cache', {
        redisUrl,
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  const config: HybridCacheConfig = {
    useRedis,
    redis: redisConfig,
    fallbackToMemory: true,
    memoryCache: {
      defaultTtl: parseInt(process.env['CACHE_DEFAULT_TTL'] || '300000'),
      maxSize: parseInt(process.env['CACHE_MAX_SIZE'] || '1000'),
    },
  };

  return new HybridCacheService(config);
}
