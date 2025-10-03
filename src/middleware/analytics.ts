/**
 * Analytics and metrics collection middleware
 * Collects detailed usage statistics and performance metrics
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { RequestWithCorrelation } from './logging';

/**
 * Analytics data interface
 */
export interface AnalyticsData {
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  timestamp: string;
  clientInfo: {
    ip: string;
    userAgent?: string;
    country?: string;
    city?: string;
  };
  usage: {
    isNewClient: boolean;
    requestCount: number;
    errorRate: number;
  };
}

/**
 * Simple in-memory store for client tracking
 * In production, this should be replaced with Redis or similar
 */
class ClientTracker {
  private clients = new Map<
    string,
    {
      firstSeen: Date;
      requestCount: number;
      errorCount: number;
      lastSeen: Date;
    }
  >();

  track(
    ip: string,
    isError: boolean
  ): {
    isNewClient: boolean;
    requestCount: number;
    errorRate: number;
  } {
    const now = new Date();
    const existing = this.clients.get(ip);

    if (!existing) {
      this.clients.set(ip, {
        firstSeen: now,
        requestCount: 1,
        errorCount: isError ? 1 : 0,
        lastSeen: now,
      });
      return {
        isNewClient: true,
        requestCount: 1,
        errorRate: isError ? 1 : 0,
      };
    }

    existing.requestCount++;
    existing.lastSeen = now;
    if (isError) existing.errorCount++;

    return {
      isNewClient: false,
      requestCount: existing.requestCount,
      errorRate:
        existing.requestCount > 0
          ? existing.errorCount / existing.requestCount
          : 0,
    };
  }

  getStats(): {
    totalClients: number;
    activeClients: number;
    totalRequests: number;
  } {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    let totalRequests = 0;
    let activeClients = 0;

    for (const client of this.clients.values()) {
      totalRequests += client.requestCount;
      if (client.lastSeen > oneHourAgo) {
        activeClients++;
      }
    }

    return {
      totalClients: this.clients.size,
      activeClients,
      totalRequests,
    };
  }

  // Clean up old clients (call periodically)
  cleanup(): void {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    for (const [ip, client] of this.clients.entries()) {
      if (client.lastSeen < oneDayAgo) {
        this.clients.delete(ip);
      }
    }
  }
}

const clientTracker = new ClientTracker();

// Clean up old clients every hour
setInterval(
  () => {
    clientTracker.cleanup();
  },
  60 * 60 * 1000
);

/**
 * Analytics middleware
 * Collects usage statistics and performance metrics
 */
export function analyticsMiddleware(
  req: RequestWithCorrelation,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();
  const metadata = req.requestMetadata;

  // Track response completion
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    const isError = res.statusCode >= 400;
    const clientIp = metadata?.realIp || req.ip || 'unknown';

    // Track client usage
    const usage = clientTracker.track(clientIp, isError);

    // Collect analytics data
    const analyticsData: AnalyticsData = {
      endpoint: req.path,
      method: req.method,
      statusCode: res.statusCode,
      responseTime,
      timestamp: new Date().toISOString(),
      clientInfo: {
        ip: clientIp,
        userAgent: metadata?.userAgent,
        // In production, you might want to add geolocation data here
      },
      usage,
    };

    // Log analytics data
    logger.info('Analytics data', {
      correlationId: req.correlationId,
      analytics: analyticsData,
    });

    // Log performance alerts
    if (responseTime > 5000) {
      logger.warn('Slow response detected', {
        correlationId: req.correlationId,
        performance: {
          responseTime,
          endpoint: req.path,
          method: req.method,
          clientIp,
        },
      });
    }

    // Log high error rate clients
    if (usage.errorRate > 0.5 && usage.requestCount > 10) {
      logger.warn('High error rate client detected', {
        correlationId: req.correlationId,
        security: {
          clientIp,
          errorRate: usage.errorRate,
          requestCount: usage.requestCount,
          endpoint: req.path,
        },
      });
    }

    // Log new client activity
    if (usage.isNewClient) {
      logger.info('New client detected', {
        correlationId: req.correlationId,
        client: {
          ip: clientIp,
          userAgent: metadata?.userAgent,
          firstEndpoint: req.path,
          timestamp: new Date().toISOString(),
        },
      });
    }
  });

  next();
}

/**
 * Get current analytics statistics
 */
export function getAnalyticsStats(): {
  totalClients: number;
  activeClients: number;
  totalRequests: number;
  timestamp: string;
} {
  const stats = clientTracker.getStats();
  return {
    ...stats,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Middleware to add analytics stats to health endpoint
 */
export function addAnalyticsToHealth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Add analytics stats to response if this is a health check
  if (req.path === '/health') {
    const originalJson = res.json;
    res.json = function (body: any) {
      const stats = getAnalyticsStats();
      const enhancedBody = {
        ...body,
        analytics: {
          clients: {
            total: stats.totalClients,
            active: stats.activeClients,
          },
          requests: {
            total: stats.totalRequests,
          },
          timestamp: stats.timestamp,
        },
      };
      return originalJson.call(this, enhancedBody);
    };
  }

  next();
}
