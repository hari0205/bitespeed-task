/**
 * Test Application Configuration for Performance Tests
 * Creates an Express app without rate limiting for performance testing
 */

import express from 'express';
import { createRoutes } from '../../routes';
import {
  securityHeaders,
  corsMiddleware,
  requestSizeLimit,
  requestLogger,
  sanitizeHeaders,
  errorHandler,
  notFoundHandler,
} from '../../middleware';

// Create test app without rate limiting
const testApp = express();

// Request logging middleware (should be first)
testApp.use(requestLogger as any);
testApp.use(sanitizeHeaders);

// Security middleware (without rate limiting)
testApp.use(securityHeaders);
testApp.use(corsMiddleware);
testApp.use(requestSizeLimit);

// Body parsing middleware
testApp.use(express.json({ limit: '1mb' }));
testApp.use(express.urlencoded({ extended: true, limit: '1mb' }));

// API routes
testApp.use('/', createRoutes());

// Root endpoint for basic API information
testApp.get('/', (_req, res) => {
  res.status(200).json({
    message: 'Identity Reconciliation API (Test Mode)',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      identify: 'POST /identify',
    },
  });
});

// Error handling middleware (should be last)
testApp.use(notFoundHandler);
testApp.use(errorHandler);

export default testApp;
