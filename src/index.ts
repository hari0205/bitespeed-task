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
  apiVersioning,
  analyticsMiddleware,
  addAnalyticsToHealth,
  responseCache,
  cacheControl,
  etags,
  invalidateCache,
} from './middleware';
import {
  validateEnvironment,
  getAppConfig,
  connectDatabase,
  checkDatabaseHealth,
  runDatabaseMigrations,
  generatePrismaClient,
} from './config';
import { createGracefulShutdownManager } from './config/graceful-shutdown';
import { logger } from './utils/logger';
import { createHybridCacheService } from './services/hybrid-cache-service';

// Validate environment variables before starting
validateEnvironment();

// Load application configuration
const config = getAppConfig();
const app = express();

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

// API versioning middleware
app.use('/api', apiVersioning);

// Analytics middleware
app.use(analyticsMiddleware as any);
app.use(addAnalyticsToHealth);

// Caching middleware
app.use(etags);
app.use('/api/v1/health', responseCache({ ttl: 30000 })); // Cache health for 30 seconds
app.use('/api/v1/health', cacheControl({ maxAge: 30, private: false }));

// Cache invalidation for mutations
app.use('/api/v1/identify', invalidateCache(['contact']));

// API routes with versioning
app.use('/api', createRoutes());

// Root endpoint for API information
app.get('/', (_req, res) => {
  res.status(200).json({
    message: 'Identity Reconciliation API',
    version: '1.0.0',
    apiVersions: {
      v1: '/api/v1',
      current: '/api/v1',
      latest: '/api/v1',
    },
    endpoints: {
      health: 'GET /api/v1/health',
      identify: 'POST /api/v1/identify',
    },
    documentation: {
      note: 'All endpoints are available at both /api/v1/* and /api/* (current version)',
      examples: {
        versioned: 'POST /api/v1/identify',
        unversioned: 'POST /api/identify (redirects to current version)',
      },
    },
  });
});

// Error handling middleware (should be last)
app.use(notFoundHandler);
app.use(errorHandler as any);

/**
 * Start the application server
 */
async function startServer(): Promise<void> {
  try {
    logger.info('Starting Identity Reconciliation API server', {
      nodeEnv: config.nodeEnv,
      port: config.port,
      logLevel: config.logLevel,
    });

    // Initialize hybrid cache service
    try {
      const hybridCache = createHybridCacheService();
      const cacheStats = await hybridCache.getStats();
      logger.info('Cache service initialized', {
        mode: cacheStats.mode,
        redisAvailable: cacheStats.redisAvailable,
      });
    } catch (error) {
      logger.warn(
        'Cache service initialization failed, continuing with basic setup',
        {
          error: error instanceof Error ? error.message : error,
        }
      );
    }

    // Run database migrations on startup
    await runDatabaseMigrations();

    // Generate Prisma client to ensure it's up to date (optional in development)
    try {
      await generatePrismaClient();
    } catch (error) {
      logger.warn(
        'Prisma client generation failed, continuing with existing client',
        {
          error: error instanceof Error ? error.message : error,
        }
      );
    }

    // Connect to database
    await connectDatabase();

    // Verify database health
    const dbHealth = await checkDatabaseHealth();
    if (dbHealth.status === 'unhealthy') {
      throw new Error(`Database health check failed: ${dbHealth.message}`);
    }

    // Start HTTP server
    const server = app.listen(config.port, '0.0.0.0', () => {
      logger.info('Identity Reconciliation API server started successfully', {
        port: config.port,
        host: '0.0.0.0',
        environment: config.nodeEnv,
        timestamp: new Date().toISOString(),
        databaseStatus: dbHealth.status,
      });
    });

    // Initialize graceful shutdown manager
    const shutdownManager = createGracefulShutdownManager({
      gracefulTimeoutMs: 5000,
      forceTimeoutMs: 10000,
    });

    shutdownManager.setServer(server);
    shutdownManager.initialize();

    // Add custom cleanup functions if needed
    shutdownManager.addCleanupFunction(async () => {
      logger.info('Performing application-specific cleanup');
      // Add any additional cleanup logic here
    });
  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  startServer();
}

export default app;
