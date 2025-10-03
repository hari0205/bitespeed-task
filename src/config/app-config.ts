/**
 * Application configuration loader and validator
 * Centralizes environment variable loading with validation and type safety
 */

import { AppConfig, EnvironmentConfig } from '../types/config.types';
import { validateConfiguration } from './validation';
import { logger } from '../utils/logger';

/**
 * Load and validate environment variables using comprehensive validation
 */
function loadEnvironmentVariables(): EnvironmentConfig {
  try {
    const validatedEnv = validateConfiguration();
    return validatedEnv as EnvironmentConfig;
  } catch (error) {
    logger.error('Failed to load environment variables', { error });
    throw error;
  }
}

/**
 * Transform environment variables to application configuration
 */
function createAppConfig(env: EnvironmentConfig): AppConfig {
  return {
    port: Number(env.PORT),
    nodeEnv: env.NODE_ENV,
    databaseUrl: env.DATABASE_URL,
    logLevel: env.LOG_LEVEL,
    corsOrigin: env.CORS_ORIGIN,
    rateLimitWindowMs: Number(env.RATE_LIMIT_WINDOW_MS),
    rateLimitMaxRequests: Number(env.RATE_LIMIT_MAX_REQUESTS),
  };
}

/**
 * Load and create application configuration
 */
export function loadAppConfig(): AppConfig {
  try {
    const env = loadEnvironmentVariables();
    const config = createAppConfig(env);

    logger.info('Application configuration loaded', {
      nodeEnv: config.nodeEnv,
      port: config.port,
      logLevel: config.logLevel,
    });

    return config;
  } catch (error) {
    logger.error('Failed to load application configuration', { error });
    throw error;
  }
}

/**
 * Validate required environment variables are present
 * Uses comprehensive validation from validation module
 */
export function validateEnvironment(): void {
  try {
    validateConfiguration();
    logger.info('Environment validation completed successfully');
  } catch (error) {
    logger.error('Environment validation failed', { error });
    throw error;
  }
}

/**
 * Get configuration for specific environment
 */
export function getEnvironmentConfig(): {
  isDevelopment: boolean;
  isProduction: boolean;
  isTest: boolean;
} {
  const nodeEnv = process.env['NODE_ENV'] || 'development';

  return {
    isDevelopment: nodeEnv === 'development',
    isProduction: nodeEnv === 'production',
    isTest: nodeEnv === 'test',
  };
}

// Export singleton configuration instance
let configInstance: AppConfig | null = null;

/**
 * Get application configuration singleton
 */
export function getAppConfig(): AppConfig {
  if (!configInstance) {
    configInstance = loadAppConfig();
  }
  return configInstance;
}
