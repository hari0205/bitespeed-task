/**
 * Error handling middleware for standardized error responses
 */

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../types/errors.types';
import { ErrorResponse } from '../types/api.types';
import { logger } from '../utils/logger';
import { RequestWithCorrelation } from './logging';

/**
 * Sanitizes request data for logging by removing sensitive information
 */
function sanitizeRequestForLogging(req: RequestWithCorrelation) {
  const sanitizedHeaders = { ...req.headers };

  // Remove sensitive headers
  delete sanitizedHeaders.authorization;
  delete sanitizedHeaders.cookie;
  delete sanitizedHeaders['x-api-key'];
  delete sanitizedHeaders['x-auth-token'];

  const sanitizedBody = req.body ? { ...req.body } : {};

  // Remove or mask sensitive fields from body
  if (sanitizedBody.password) {
    sanitizedBody.password = '[REDACTED]';
  }
  if (sanitizedBody.token) {
    sanitizedBody.token = '[REDACTED]';
  }
  if (sanitizedBody.apiKey) {
    sanitizedBody.apiKey = '[REDACTED]';
  }

  // Include enhanced metadata if available
  const metadata = req.requestMetadata;

  return {
    method: req.method,
    url: req.url,
    path: req.path,
    query: req.query,
    headers: sanitizedHeaders,
    body: sanitizedBody,
    client: metadata
      ? {
          ip: metadata.realIp || metadata.ip,
          userAgent: metadata.userAgent,
          referer: metadata.referer,
          origin: metadata.origin,
          host: metadata.host,
          protocol: metadata.protocol,
          secure: metadata.secure,
        }
      : {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
        },
  };
}

/**
 * Check for suspicious activity patterns
 */
function checkSuspiciousActivity(
  req: RequestWithCorrelation,
  error: Error
): boolean {
  const metadata = req.requestMetadata;
  if (!metadata) return false;

  // Check for common attack patterns
  const suspiciousPatterns = [
    'sql injection',
    'xss',
    'script',
    'union select',
    '../',
    '..\\',
    'eval(',
    'javascript:',
  ];

  const requestData = JSON.stringify({
    url: req.url,
    body: req.body,
    query: req.query,
  }).toLowerCase();

  return suspiciousPatterns.some(pattern => requestData.includes(pattern));
}

/**
 * Check if request might be hitting rate limits
 */
function checkRateLimit(req: RequestWithCorrelation): {
  nearLimit: boolean;
  remaining?: number;
} {
  const rateLimitRemaining = req.headers['x-ratelimit-remaining'];
  const remaining = rateLimitRemaining
    ? parseInt(rateLimitRemaining as string, 10)
    : undefined;

  return {
    nearLimit: remaining !== undefined && remaining < 10,
    remaining,
  };
}

/**
 * Sanitizes error details to prevent sensitive data exposure
 */
function sanitizeErrorDetails(details: any): any {
  if (!details) return undefined;

  // If details is a string, return as-is (assuming it's safe)
  if (typeof details === 'string') return details;

  // If details is an object, sanitize it
  if (typeof details === 'object') {
    const sanitized = { ...details };

    // Remove common sensitive fields
    delete sanitized.password;
    delete sanitized.token;
    delete sanitized.apiKey;
    delete sanitized.secret;
    delete sanitized.connectionString;
    delete sanitized.databaseUrl;

    // Sanitize nested objects
    Object.keys(sanitized).forEach(key => {
      if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = sanitizeErrorDetails(sanitized[key]);
      }
    });

    return sanitized;
  }

  return details;
}

/**
 * Global error handling middleware
 * Converts all errors to standardized ErrorResponse format
 */
export function errorHandler(
  error: Error,
  req: RequestWithCorrelation,
  res: Response,
  _next: NextFunction
): void {
  // Generate or extract correlation ID for request tracking
  const correlationId =
    req.correlationId ||
    (req.headers['x-correlation-id'] as string) ||
    `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Sanitize request data for logging
  const sanitizedRequest = sanitizeRequestForLogging(req);

  // Enhanced error logging with security context
  logger.error('Request error', {
    correlationId,
    error: {
      name: error.name,
      message: error.message,
      stack:
        process.env['NODE_ENV'] === 'development' ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    },
    request: sanitizedRequest,
    security: {
      suspiciousActivity: checkSuspiciousActivity(req, error),
      rateLimit: checkRateLimit(req),
      timestamp: new Date().toISOString(),
    },
  });

  // Handle known application errors
  if (error instanceof AppError) {
    const errorResponse: ErrorResponse = {
      error: {
        message: error.message,
        code: error.code,
        details: sanitizeErrorDetails(error.details),
      },
      timestamp: new Date().toISOString(),
      path: req.path,
      correlationId,
    };

    res.status(error.statusCode).json(errorResponse);
    return;
  }

  // Handle specific Node.js/Express errors
  if (error.name === 'SyntaxError' && 'body' in error) {
    const errorResponse: ErrorResponse = {
      error: {
        message: 'Invalid JSON in request body',
        code: 'INVALID_JSON',
      },
      timestamp: new Date().toISOString(),
      path: req.path,
      correlationId,
    };

    res.status(400).json(errorResponse);
    return;
  }

  // Handle payload too large errors
  if (error.message && error.message.includes('request entity too large')) {
    const errorResponse: ErrorResponse = {
      error: {
        message: 'Request payload too large',
        code: 'PAYLOAD_TOO_LARGE',
      },
      timestamp: new Date().toISOString(),
      path: req.path,
      correlationId,
    };

    res.status(413).json(errorResponse);
    return;
  }

  // Handle timeout errors
  if (error.message && error.message.includes('timeout')) {
    const errorResponse: ErrorResponse = {
      error: {
        message: 'Request timeout',
        code: 'REQUEST_TIMEOUT',
      },
      timestamp: new Date().toISOString(),
      path: req.path,
      correlationId,
    };

    res.status(408).json(errorResponse);
    return;
  }

  // Handle unknown errors - never expose internal error details in production
  const errorResponse: ErrorResponse = {
    error: {
      message:
        process.env['NODE_ENV'] === 'development'
          ? error.message
          : 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR',
      details:
        process.env['NODE_ENV'] === 'development'
          ? { originalError: error.name }
          : undefined,
    },
    timestamp: new Date().toISOString(),
    path: req.path,
    correlationId,
  };

  res.status(500).json(errorResponse);
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const correlationId =
    (req.headers['x-correlation-id'] as string) ||
    `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  logger.warn('Route not found', {
    correlationId,
    method: req.method,
    path: req.path,
    url: req.url,
  });

  const errorResponse: ErrorResponse = {
    error: {
      message: `Route ${req.method} ${req.path} not found`,
      code: 'ROUTE_NOT_FOUND',
    },
    timestamp: new Date().toISOString(),
    path: req.path,
    correlationId,
  };

  res.status(404).json(errorResponse);
}

/**
 * Async error wrapper for route handlers
 * Catches async errors and passes them to error middleware
 */
export function asyncHandler<T extends Request, U extends Response>(
  fn: (req: T, res: U, next: NextFunction) => Promise<any>
) {
  return (req: T, res: U, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
