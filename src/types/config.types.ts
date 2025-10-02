/**
 * Configuration and environment variable type definitions
 */

/**
 * Application configuration interface
 */
export interface AppConfig {
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
  databaseUrl: string;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  corsOrigin: string;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
}

/**
 * Environment variables interface for type safety
 */
export interface EnvironmentConfig {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: string;
  DATABASE_URL: string;
  LOG_LEVEL: 'error' | 'warn' | 'info' | 'debug';
  CORS_ORIGIN: string;
  RATE_LIMIT_WINDOW_MS: string;
  RATE_LIMIT_MAX_REQUESTS: string;
}

/**
 * Database configuration interface
 */
export interface DatabaseConfig {
  url: string;
  provider: 'sqlite' | 'postgresql' | 'mysql';
  maxConnections?: number;
  connectionTimeout?: number;
}

/**
 * Logging configuration interface
 */
export interface LoggingConfig {
  level: 'error' | 'warn' | 'info' | 'debug';
  format: 'json' | 'simple';
  enableConsole: boolean;
  enableFile: boolean;
  filePath?: string;
}
