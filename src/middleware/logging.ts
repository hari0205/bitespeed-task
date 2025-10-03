/**
 * Logging middleware for request/response tracking
 */

import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger';

/**
 * Extended Request interface with correlation ID
 */
export interface RequestWithCorrelation extends Request {
  correlationId: string;
}

/**
 * Request logging middleware
 * Adds correlation ID and logs incoming requests
 */
export function requestLogger(
  req: RequestWithCorrelation,
  res: Response,
  next: NextFunction
): void {
  // Generate or use existing correlation ID
  const correlationId =
    (req.headers['x-correlation-id'] as string) || randomUUID();
  req.correlationId = correlationId;

  // Add correlation ID to response headers
  res.setHeader('x-correlation-id', correlationId);

  // Log incoming request
  logger.info('Incoming request', {
    correlationId,
    request: {
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      timestamp: new Date().toISOString(),
    },
  });

  // Track response time
  const startTime = Date.now();

  // Override res.json to log responses
  const originalJson = res.json;
  res.json = function (body: any) {
    const responseTime = Date.now() - startTime;

    // Log response (excluding sensitive data)
    logger.info('Outgoing response', {
      correlationId,
      response: {
        statusCode: res.statusCode,
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString(),
      },
    });

    return originalJson.call(this, body);
  };

  // Log response on finish
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;

    logger.info('Request completed', {
      correlationId,
      summary: {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString(),
      },
    });
  });

  next();
}

/**
 * Security headers middleware
 * Removes sensitive headers from logs
 */
export function sanitizeHeaders(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  // Remove sensitive headers from logging
  const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];

  sensitiveHeaders.forEach(header => {
    if (req.headers[header]) {
      req.headers[header] = '[REDACTED]';
    }
  });

  next();
}
