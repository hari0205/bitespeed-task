/**
 * Redis Cache Service
 * Provides distributed caching using Redis for production environments
 */

import Redis from 'ioredis';
import { logger } from '../utils/logger';
import { CacheStats } from './cache-service';

/**
 * Redis cache configuration interface
 */
export interface RedisCacheConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  maxRetriesPerRequest?: number;
  lazyConnect?: boolean;
}

/**
 * Redis cache implementation with fallback to memory cache
 */
export class RedisCacheService {
  private redis: Redis;
  private isConnected = false;
  private stats = {
    hits: 0,
    misses: 0,
    errors: 0,
  };

  constructor(config: RedisCacheConfig) {
    const redisOptions: any = {
      host: config.host,
      port: config.port,
      db: config.db || 0,
      keyPrefix: config.keyPrefix || 'identity-api:',
      maxRetriesPerRequest: config.maxRetriesPerRequest || 3,
      lazyConnect: config.lazyConnect !== false,
      // Connection timeout
      connectTimeout: 10000,
      // Command timeout
      commandTimeout: 5000,
      // Retry strategy
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        logger.warn('Redis connection retry', { attempt: times, delay });
        return delay;
      },
    };

    // Only add password if it exists
    if (config.password) {
      redisOptions.password = config.password;
    }

    this.redis = new Redis(redisOptions);

    this.setupEventHandlers();
  }

  /**
   * Setup Redis event handlers
   */
  private setupEventHandlers(): void {
    this.redis.on('connect', () => {
      logger.info('Redis connection established');
      this.isConnected = true;
    });

    this.redis.on('ready', () => {
      logger.info('Redis client ready');
    });

    this.redis.on('error', error => {
      logger.error('Redis connection error', { error: error.message });
      this.isConnected = false;
      this.stats.errors++;
    });

    this.redis.on('close', () => {
      logger.warn('Redis connection closed');
      this.isConnected = false;
    });

    this.redis.on('reconnecting', () => {
      logger.info('Redis reconnecting');
    });
  }

  /**
   * Get value from Redis cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      if (!this.isConnected) {
        this.stats.misses++;
        return null;
      }

      const value = await this.redis.get(key);

      if (value === null) {
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;

      logger.debug('Redis cache hit', { key });

      return JSON.parse(value);
    } catch (error) {
      logger.error('Redis get error', {
        key,
        error: error instanceof Error ? error.message : error,
      });
      this.stats.errors++;
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Set value in Redis cache
   */
  async set<T>(key: string, value: T, ttlMs?: number): Promise<boolean> {
    try {
      if (!this.isConnected) {
        return false;
      }

      const serialized = JSON.stringify(value);

      if (ttlMs) {
        const ttlSeconds = Math.floor(ttlMs / 1000);
        await this.redis.setex(key, ttlSeconds, serialized);
      } else {
        await this.redis.set(key, serialized);
      }

      logger.debug('Redis cache set', { key, ttl: ttlMs });

      return true;
    } catch (error) {
      logger.error('Redis set error', {
        key,
        error: error instanceof Error ? error.message : error,
      });
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Delete value from Redis cache
   */
  async delete(key: string): Promise<boolean> {
    try {
      if (!this.isConnected) {
        return false;
      }

      const result = await this.redis.del(key);

      logger.debug('Redis cache delete', { key, deleted: result > 0 });

      return result > 0;
    } catch (error) {
      logger.error('Redis delete error', {
        key,
        error: error instanceof Error ? error.message : error,
      });
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Delete multiple keys matching a pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    try {
      if (!this.isConnected) {
        return 0;
      }

      const keys = await this.redis.keys(pattern);

      if (keys.length === 0) {
        return 0;
      }

      const result = await this.redis.del(...keys);

      logger.debug('Redis pattern delete', { pattern, keysDeleted: result });

      return result;
    } catch (error) {
      logger.error('Redis pattern delete error', {
        pattern,
        error: error instanceof Error ? error.message : error,
      });
      this.stats.errors++;
      return 0;
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<boolean> {
    try {
      if (!this.isConnected) {
        return false;
      }

      await this.redis.flushdb();

      logger.info('Redis cache cleared');

      return true;
    } catch (error) {
      logger.error('Redis clear error', {
        error: error instanceof Error ? error.message : error,
      });
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<
    CacheStats & { connected: boolean; errors: number }
  > {
    try {
      let entries = 0;
      let memoryUsage = 0;

      if (this.isConnected) {
        // Get database size
        entries = await this.redis.dbsize();

        // Get memory usage info
        const info = await this.redis.memory('STATS');
        memoryUsage = typeof info === 'number' ? info : 0;
      }

      const totalRequests = this.stats.hits + this.stats.misses;
      const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;

      return {
        hits: this.stats.hits,
        misses: this.stats.misses,
        entries,
        hitRate: Math.round(hitRate * 100) / 100,
        memoryUsage,
        connected: this.isConnected,
        errors: this.stats.errors,
      };
    } catch (error) {
      logger.error('Redis stats error', {
        error: error instanceof Error ? error.message : error,
      });

      return {
        hits: this.stats.hits,
        misses: this.stats.misses,
        entries: 0,
        hitRate: 0,
        memoryUsage: 0,
        connected: false,
        errors: this.stats.errors,
      };
    }
  }

  /**
   * Check if Redis is connected
   */
  isRedisConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Ping Redis to check connectivity
   */
  async ping(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Redis ping error', {
        error: error instanceof Error ? error.message : error,
      });
      return false;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    try {
      await this.redis.quit();
      logger.info('Redis connection closed gracefully');
    } catch (error) {
      logger.error('Redis disconnect error', {
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  /**
   * Get Redis client info
   */
  async getInfo(): Promise<{
    version?: string;
    mode?: string;
    connectedClients?: number;
    usedMemory?: number;
    totalSystemMemory?: number;
  }> {
    try {
      if (!this.isConnected) {
        return {};
      }

      const info = await this.redis.info();
      const lines = info.split('\r\n');
      const result: any = {};

      for (const line of lines) {
        if (line.includes(':')) {
          const [key, value] = line.split(':');
          switch (key) {
            case 'redis_version':
              result.version = value || '';
              break;
            case 'redis_mode':
              result.mode = value || '';
              break;
            case 'connected_clients':
              result.connectedClients = parseInt(value || '0', 10);
              break;
            case 'used_memory':
              result.usedMemory = parseInt(value || '0', 10);
              break;
            case 'total_system_memory':
              result.totalSystemMemory = parseInt(value || '0', 10);
              break;
          }
        }
      }

      return result;
    } catch (error) {
      logger.error('Redis info error', {
        error: error instanceof Error ? error.message : error,
      });
      return {};
    }
  }
}
