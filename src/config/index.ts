/**
 * Configuration module exports
 * Centralizes all configuration-related exports
 */

// App configuration
export {
  loadAppConfig,
  validateEnvironment,
  getEnvironmentConfig,
  getAppConfig,
} from './app-config';

// Database configuration
export {
  getPrismaClient,
  prisma,
  connectDatabase,
  disconnectDatabase,
  isDatabaseConnected,
  checkDatabaseHealth,
  runDatabaseMigrations,
  generatePrismaClient,
} from './database';

// Validation utilities
export {
  validateConfiguration,
  validateEnvironmentVariables,
  checkCriticalEnvironmentVariables,
  validateConfigurationConsistency,
} from './validation';

// Graceful shutdown
export {
  GracefulShutdownManager,
  createGracefulShutdownManager,
} from './graceful-shutdown';

// Re-export types for convenience
export type {
  AppConfig,
  EnvironmentConfig,
  DatabaseConfig,
  LoggingConfig,
} from '../types/config.types';
