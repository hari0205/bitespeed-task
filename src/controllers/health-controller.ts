/**
 * Health Controller
 * Handles health check and monitoring endpoints
 */

import { Request, Response } from 'express';
import { HealthResponse } from '../types/api.types';
import { checkDatabaseHealth, isDatabaseConnected } from '../config';
import { logger } from '../utils/logger';

/**
 * Controller class for health and monitoring endpoints
 */
export class HealthController {
  private readonly startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  /**
   * GET /health endpoint handler
   * Returns application health status and basic metrics
   */
  async health(req: Request, res: Response<HealthResponse>): Promise<void> {
    const correlationId = req.headers['x-correlation-id'] || 'unknown';

    try {
      const uptime = Math.floor((Date.now() - this.startTime) / 1000);

      // Check database health
      const dbHealth = await checkDatabaseHealth();
      const isDbConnected = isDatabaseConnected();

      // Determine overall health status
      const isHealthy = dbHealth.status === 'healthy' && isDbConnected;
      const status = isHealthy ? 'ok' : 'degraded';

      const healthResponse: HealthResponse = {
        status,
        timestamp: new Date().toISOString(),
        uptime,
        version: process.env['npm_package_version'] || '1.0.0',
        database: {
          status: dbHealth.status,
          connected: isDbConnected,
          message: dbHealth.message,
        },
      };

      logger.debug('Health check requested', {
        correlationId,
        uptime,
        databaseStatus: dbHealth.status,
        databaseConnected: isDbConnected,
      });

      // Return 200 for ok, 503 for degraded/error
      const statusCode = status === 'ok' ? 200 : 503;
      res.status(statusCode).json(healthResponse);
    } catch (error) {
      logger.error('Health check failed', {
        correlationId,
        error: {
          name: error instanceof Error ? error.name : 'Unknown',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      const errorResponse: HealthResponse = {
        status: 'error',
        timestamp: new Date().toISOString(),
        uptime: Math.floor((Date.now() - this.startTime) / 1000),
        database: {
          status: 'unhealthy',
          connected: false,
          message: 'Health check failed',
        },
      };

      res.status(503).json(errorResponse);
    }
  }
}
