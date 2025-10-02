/**
 * Error handling middleware for standardized error responses
 */

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../types/errors.types';
import { ErrorResponse } from '../types/api.types';
import { logger } from '../utils/logger';

/**
 * Global error handling middleware
 * Converts all errors to standardized ErrorResponse format
 */
export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log the error with request context
  const correlationId = req.headers['x-correlation-id'] || 'unknown';

  logger.error('Request error', {
    correlationId,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    request: {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
    },
  });

  // Handle known application errors
  if (error instanceof AppError) {
    const errorResponse: ErrorResponse = {
      error: {
        message: error.message,
        code: error.code,
        details: error.details,
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    };

    res.status(error.statusCode).json(errorResponse);
    return;
  }

  // Handle unknown errors
  const errorResponse: ErrorResponse = {
    error: {
      message: 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR',
    },
    timestamp: new Date().toISOString(),
    path: req.path,
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
  const errorResponse: ErrorResponse = {
    error: {
      message: `Route ${req.method} ${req.path} not found`,
      code: 'ROUTE_NOT_FOUND',
    },
    timestamp: new Date().toISOString(),
    path: req.path,
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
