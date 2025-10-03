/**
 * Main application entry point for Identity Reconciliation System
 */

import express from 'express';
import { createRoutes } from './routes';
import {
  securityHeaders,
  corsMiddleware,
  rateLimiter,
  requestSizeLimit,
  requestLogger,
  sanitizeHeaders,
  errorHandler,
  notFoundHandler,
} from './middleware';
import { connectDatabase, disconnectDatabase } from './config/database';
import { logger } from './utils/logger';

const app = express();
const PORT = process.env['PORT'] || 3000;

// Request logging middleware (should be first)
app.use(requestLogger as any);
app.use(sanitizeHeaders);

// Security middleware
app.use(securityHeaders);
app.use(corsMiddleware);
app.use(rateLimiter);
app.use(requestSizeLimit);

// Body parsing middleware
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// API routes
app.use('/', createRoutes());

// Root endpoint for basic API information
app.get('/', (_req, res) => {
  res.status(200).json({
    message: 'Identity Reconciliation API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      identify: 'POST /identify',
    },
  });
});

// Error handling middleware (should be last)
app.use(notFoundHandler);
app.use(errorHandler);

/**
 * Start the application server
 */
async function startServer(): Promise<void> {
  try {
    // Connect to database
    await connectDatabase();

    // Start HTTP server
    const server = app.listen(PORT, () => {
      logger.info(`Identity Reconciliation API server started`, {
        port: PORT,
        environment: process.env['NODE_ENV'] || 'development',
        timestamp: new Date().toISOString(),
      });
    });

    // Graceful shutdown handling
    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully`);

      server.close(async () => {
        try {
          await disconnectDatabase();
          logger.info('Server closed successfully');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown', { error });
          process.exit(1);
        }
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown due to timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  startServer();
}

export default app;
