/**
 * Configuration validation utilities
 * Provides comprehensive validation for application configuration
 */

import { z } from 'zod';
import { logger } from '../utils/logger';

/**
 * Environment variable validation schema
 */
const environmentValidationSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  CORS_ORIGIN: z.string().default('*'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().min(1).default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().min(1).default(100),
});

/**
 * Validate environment variables with detailed error reporting
 */
export function validateEnvironmentVariables(): Record<string, any> {
  const env = {
    NODE_ENV: process.env['NODE_ENV'],
    PORT: process.env['PORT'],
    DATABASE_URL: process.env['DATABASE_URL'],
    LOG_LEVEL: process.env['LOG_LEVEL'],
    CORS_ORIGIN: process.env['CORS_ORIGIN'],
    RATE_LIMIT_WINDOW_MS: process.env['RATE_LIMIT_WINDOW_MS'],
    RATE_LIMIT_MAX_REQUESTS: process.env['RATE_LIMIT_MAX_REQUESTS'],
  };

  try {
    const validatedEnv = environmentValidationSchema.parse(env);

    logger.info('Environment variables validated successfully', {
      nodeEnv: validatedEnv.NODE_ENV,
      port: validatedEnv.PORT,
      logLevel: validatedEnv.LOG_LEVEL,
      databaseProvider: validatedEnv.DATABASE_URL.startsWith('file:')
        ? 'sqlite'
        : 'postgresql',
    });

    return validatedEnv;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.issues
        .map((issue: z.ZodIssue) => `${issue.path.join('.')}: ${issue.message}`)
        .join(', ');

      logger.error('Environment variable validation failed', {
        issues: error.issues,
        summary: errorMessages,
      });

      throw new Error(`Invalid environment configuration: ${errorMessages}`);
    }

    logger.error('Unexpected error during environment validation', { error });
    throw error;
  }
}

/**
 * Check for missing critical environment variables
 */
export function checkCriticalEnvironmentVariables(): void {
  const criticalVars = ['DATABASE_URL'];
  const missingVars = criticalVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    const error = `Missing critical environment variables: ${missingVars.join(', ')}`;
    logger.error(error, { missingVariables: missingVars });
    throw new Error(error);
  }

  logger.info('Critical environment variables check passed');
}

/**
 * Validate configuration consistency
 */
export function validateConfigurationConsistency(): void {
  const nodeEnv = process.env['NODE_ENV'] || 'development';
  const logLevel = process.env['LOG_LEVEL'] || 'info';

  // Warn about potentially problematic configurations
  if (nodeEnv === 'production' && logLevel === 'debug') {
    logger.warn('Debug logging enabled in production environment', {
      nodeEnv,
      logLevel,
    });
  }

  if (
    nodeEnv === 'development' &&
    process.env['DATABASE_URL']?.includes('postgresql')
  ) {
    logger.info('Using PostgreSQL in development environment', {
      nodeEnv,
      databaseType: 'postgresql',
    });
  }

  logger.info('Configuration consistency check completed');
}

/**
 * Comprehensive configuration validation
 */
export function validateConfiguration(): Record<string, any> {
  logger.info('Starting comprehensive configuration validation');

  try {
    // Check critical variables first
    checkCriticalEnvironmentVariables();

    // Validate all environment variables
    const validatedEnv = validateEnvironmentVariables();

    // Check configuration consistency
    validateConfigurationConsistency();

    logger.info('Configuration validation completed successfully');
    return validatedEnv;
  } catch (error) {
    logger.error('Configuration validation failed', { error });
    throw error;
  }
}
