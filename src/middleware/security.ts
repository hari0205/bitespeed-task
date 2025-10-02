/**
 * Security middleware for the Identity Reconciliation system
 */

import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { RateLimitError } from '../types/errors.types';

/**
 * Helmet security middleware configuration
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
});

/**
 * CORS configuration
 */
export const corsOptions = {
  origin: process.env['CORS_ORIGIN'] || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id'],
  credentials: true,
  maxAge: 86400, // 24 hours
};

export const corsMiddleware = cors(corsOptions);

/**
 * Rate limiting configuration
 */
export const rateLimiter = rateLimit({
  windowMs: parseInt(process.env['RATE_LIMIT_WINDOW_MS'] || '900000'), // 15 minutes
  max: parseInt(process.env['RATE_LIMIT_MAX_REQUESTS'] || '100'), // 100 requests per window
  message: {
    error: {
      message: 'Too many requests from this IP, please try again later',
      code: 'RATE_LIMIT_EXCEEDED',
    },
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, _res: Response, next: NextFunction) => {
    const error = new RateLimitError('Rate limit exceeded');
    next(error);
  },
});

/**
 * Request size limiting middleware
 */
export function requestSizeLimit(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const maxSize = parseInt(process.env['MAX_REQUEST_SIZE'] || '1048576'); // 1MB default

  if (req.headers['content-length']) {
    const contentLength = parseInt(req.headers['content-length']);
    if (contentLength > maxSize) {
      res.status(413).json({
        error: {
          message: 'Request entity too large',
          code: 'REQUEST_TOO_LARGE',
        },
        timestamp: new Date().toISOString(),
        path: req.path,
      });
      return;
    }
  }

  next();
}
