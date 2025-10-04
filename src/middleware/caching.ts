/**
 * Caching Middleware
 * Provides HTTP response caching and cache control headers
 */

import { Request, Response, NextFunction } from 'express';
import { cacheService } from '../services/cache-service';
import { logger } from '../utils/logger';
import { RequestWithCorrelation } from './logging';

/**
 * Cache configuration interface
 */
interface CacheConfig {
  ttl?: number; // Time to live in milliseconds
  keyGenerator?: (req: Request) => string;
  condition?: (req: Request, res: Response) => boolean;
  varyBy?: string[]; // Headers to vary cache by
}

/**
 * Generate cache key from request
 */
function generateCacheKey(req: Request, config?: CacheConfig): string {
  if (config?.keyGenerator) {
    return config.keyGenerator(req);
  }

  // Default key generation
  const method = req.method;
  const path = req.path;
  const query = JSON.stringify(req.query);
  const body = req.method === 'POST' ? JSON.stringify(req.body) : '';

  // Include vary headers in key
  let varyPart = '';
  if (config?.varyBy) {
    const varyValues = config.varyBy
      .map(header => req.headers[header.toLowerCase()] || '')
      .join('|');
    varyPart = `|vary:${varyValues}`;
  }

  return `response:${method}:${path}:${query}:${body}${varyPart}`;
}

/**
 * Response caching middleware
 */
export function responseCache(
  config: CacheConfig = {}
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const correlatedReq = req as RequestWithCorrelation;
    // Skip caching for non-GET requests by default
    if (req.method !== 'GET' && !config.condition) {
      return next();
    }

    // Check condition if provided
    if (config.condition && !config.condition(req, res)) {
      return next();
    }

    const cacheKey = generateCacheKey(req, config);
    const cached = cacheService.getCachedQuery(cacheKey);

    if (cached) {
      // Set cache headers
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('X-Cache-Key', cacheKey);

      // Set vary headers
      if (config.varyBy) {
        res.setHeader('Vary', config.varyBy.join(', '));
      }

      logger.debug('Cache hit for response', {
        correlationId: correlatedReq.correlationId,
        cacheKey,
        method: req.method,
        path: req.path,
      });

      res.status(cached.statusCode).json(cached.body);
      return;
    }

    // Cache miss - intercept response
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('X-Cache-Key', cacheKey);

    // Override res.json to cache the response
    const originalJson = res.json;
    res.json = function (body: any) {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const cacheData = {
          statusCode: res.statusCode,
          body,
          timestamp: Date.now(),
        };

        cacheService.cacheQuery(cacheKey, cacheData, config.ttl);

        logger.debug('Response cached', {
          correlationId: correlatedReq.correlationId,
          cacheKey,
          statusCode: res.statusCode,
          ttl: config.ttl,
        });
      }

      // Set vary headers
      if (config.varyBy) {
        res.setHeader('Vary', config.varyBy.join(', '));
      }

      return originalJson.call(this, body);
    };

    next();
  };
}

/**
 * Cache control headers middleware
 */
export function cacheControl(
  options: {
    maxAge?: number;
    private?: boolean;
    noCache?: boolean;
    noStore?: boolean;
    mustRevalidate?: boolean;
  } = {}
): (req: Request, res: Response, next: NextFunction) => void {
  return (_req: Request, res: Response, next: NextFunction): void => {
    // Suppress unused parameter warning
    void _req;
    const directives: string[] = [];

    if (options.noStore) {
      directives.push('no-store');
    } else if (options.noCache) {
      directives.push('no-cache');
    } else {
      if (options.private) {
        directives.push('private');
      } else {
        directives.push('public');
      }

      if (options.maxAge !== undefined) {
        directives.push(`max-age=${options.maxAge}`);
      }

      if (options.mustRevalidate) {
        directives.push('must-revalidate');
      }
    }

    if (directives.length > 0) {
      res.setHeader('Cache-Control', directives.join(', '));
    }

    next();
  };
}

/**
 * ETags middleware for conditional requests
 */
export function etags(req: Request, res: Response, next: NextFunction): void {
  const originalJson = res.json;

  res.json = function (body: any) {
    // Generate ETag based on response body
    const etag = `"${Buffer.from(JSON.stringify(body)).toString('base64').slice(0, 16)}"`;
    res.setHeader('ETag', etag);

    // Check If-None-Match header
    const ifNoneMatch = req.headers['if-none-match'];
    if (ifNoneMatch === etag) {
      return res.status(304).end();
    }

    return originalJson.call(this, body);
  };

  next();
}

/**
 * Cache warming middleware for health endpoint
 */
export function warmCache(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Suppress unused parameter warning
  void res;
  // Pre-warm cache with health data if it's empty
  if (req.path === '/health') {
    const healthCacheKey = 'health:status';
    const cached = cacheService.getCachedAnalytics(healthCacheKey);

    if (!cached) {
      // This will be populated by the actual health check
      logger.debug('Health cache warming initiated');
    }
  }

  next();
}

/**
 * Cache invalidation middleware
 */
export function invalidateCache(
  patterns: string[]
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const correlatedReq = req as RequestWithCorrelation;
    // Invalidate cache after successful mutations
    res.on('finish', () => {
      if (
        res.statusCode >= 200 &&
        res.statusCode < 300 &&
        req.method !== 'GET'
      ) {
        patterns.forEach(pattern => {
          // Simple pattern matching - in production, use more sophisticated cache invalidation
          if (
            pattern.includes('contact') &&
            (req.body?.email || req.body?.phoneNumber)
          ) {
            cacheService.invalidateContactCaches(
              req.body.email,
              req.body.phoneNumber
            );
          }
        });

        logger.debug('Cache invalidated', {
          correlationId: correlatedReq.correlationId,
          patterns,
          method: req.method,
          path: req.path,
        });
      }
    });

    next();
  };
}
