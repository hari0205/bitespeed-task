/**
 * Health Controller
 * Handles health check and monitoring endpoints
 */

import { Request, Response } from 'express';
import { HealthResponse } from '../types/api.types';
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

      const healthResponse: HealthResponse = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime,
        version: process.env['npm_package_version'] || '1.0.0',
      };

      logger.debug('Health check requested', {
        correlationId,
        uptime,
      });

      res.status(200).json(healthResponse);
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
      };

      res.status(503).json(errorResponse);
    }
  }
}
