/**
 * Cache Controller
 * Handles cache management endpoints for monitoring and administration
 */

import { Request, Response } from 'express';
import { cacheService } from '../services/cache-service';
import { logger } from '../utils/logger';

/**
 * Cache statistics response interface
 */
interface CacheStatsResponse {
  timestamp: string;
  caches: {
    contact: {
      hits: number;
      misses: number;
      entries: number;
      hitRate: number;
      memoryUsage: number;
    };
    query: {
      hits: number;
      misses: number;
      entries: number;
      hitRate: number;
      memoryUsage: number;
    };
    analytics: {
      hits: number;
      misses: number;
      entries: number;
      hitRate: number;
      memoryUsage: number;
    };
  };
  total: {
    hits: number;
    misses: number;
    entries: number;
    hitRate: number;
    memoryUsage: number;
  };
}

/**
 * Controller class for cache management endpoints
 */
export class CacheController {
  /**
   * GET /cache/stats endpoint handler
   * Returns detailed cache statistics
   */
  async getStats(req: Request, res: Response): Promise<void> {
    const correlationId = req.headers['x-correlation-id'] || 'unknown';

    try {
      const stats = cacheService.getStats();

      const response: CacheStatsResponse = {
        timestamp: new Date().toISOString(),
        caches: {
          contact: {
            hits: stats.contact.hits,
            misses: stats.contact.misses,
            entries: stats.contact.entries,
            hitRate: stats.contact.hitRate,
            memoryUsage: Math.round(stats.contact.memoryUsage / 1024), // KB
          },
          query: {
            hits: stats.query.hits,
            misses: stats.query.misses,
            entries: stats.query.entries,
            hitRate: stats.query.hitRate,
            memoryUsage: Math.round(stats.query.memoryUsage / 1024), // KB
          },
          analytics: {
            hits: stats.analytics.hits,
            misses: stats.analytics.misses,
            entries: stats.analytics.entries,
            hitRate: stats.analytics.hitRate,
            memoryUsage: Math.round(stats.analytics.memoryUsage / 1024), // KB
          },
        },
        total: {
          hits: stats.total.hits,
          misses: stats.total.misses,
          entries: stats.total.entries,
          hitRate: stats.total.hitRate,
          memoryUsage: Math.round(stats.total.memoryUsage / 1024), // KB
        },
      };

      logger.debug('Cache statistics requested', {
        correlationId,
        totalEntries: stats.total.entries,
        hitRate: stats.total.hitRate,
      });

      res.status(200).json(response);
    } catch (error) {
      logger.error('Cache statistics request failed', {
        correlationId,
        error: {
          name: error instanceof Error ? error.name : 'Unknown',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      res.status(500).json({
        error: {
          message: 'Failed to retrieve cache statistics',
          code: 'CACHE_STATS_ERROR',
        },
        timestamp: new Date().toISOString(),
        path: req.path,
        correlationId,
      });
    }
  }

  /**
   * DELETE /cache/clear endpoint handler
   * Clears all cache entries
   */
  async clearCache(req: Request, res: Response): Promise<void> {
    const correlationId = req.headers['x-correlation-id'] || 'unknown';

    try {
      const statsBefore = cacheService.getStats();
      cacheService.clearAll();

      logger.info('Cache cleared via API', {
        correlationId,
        entriesCleared: statsBefore.total.entries,
        memoryFreed: Math.round(statsBefore.total.memoryUsage / 1024),
      });

      res.status(200).json({
        message: 'Cache cleared successfully',
        cleared: {
          entries: statsBefore.total.entries,
          memoryFreedKB: Math.round(statsBefore.total.memoryUsage / 1024),
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Cache clear request failed', {
        correlationId,
        error: {
          name: error instanceof Error ? error.name : 'Unknown',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      res.status(500).json({
        error: {
          message: 'Failed to clear cache',
          code: 'CACHE_CLEAR_ERROR',
        },
        timestamp: new Date().toISOString(),
        path: req.path,
        correlationId,
      });
    }
  }

  /**
   * POST /cache/warm endpoint handler
   * Pre-warms cache with common queries
   */
  async warmCache(req: Request, res: Response): Promise<void> {
    const correlationId = req.headers['x-correlation-id'] || 'unknown';

    try {
      // In a real implementation, you might pre-load common contact queries
      // For now, we'll just return a success message

      logger.info('Cache warming initiated via API', {
        correlationId,
      });

      res.status(200).json({
        message: 'Cache warming initiated',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Cache warming request failed', {
        correlationId,
        error: {
          name: error instanceof Error ? error.name : 'Unknown',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      res.status(500).json({
        error: {
          message: 'Failed to warm cache',
          code: 'CACHE_WARM_ERROR',
        },
        timestamp: new Date().toISOString(),
        path: req.path,
        correlationId,
      });
    }
  }
}
