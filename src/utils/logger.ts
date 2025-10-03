/**
 * Winston logger configuration for structured logging
 */

import winston from 'winston';
import { LoggingConfig } from '../types/config.types';

/**
 * Log levels configuration
 */
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

/**
 * Create logging configuration from environment
 */
function createLoggingConfig(): LoggingConfig {
  const nodeEnv = process.env['NODE_ENV'] || 'development';
  const logLevel =
    (process.env['LOG_LEVEL'] as LoggingConfig['level']) || 'info';

  const config: LoggingConfig = {
    level: logLevel,
    format: nodeEnv === 'production' ? 'json' : 'simple',
    enableConsole: true,
    enableFile: nodeEnv === 'production',
  };

  if (nodeEnv === 'production') {
    config.filePath = 'logs';
  }

  return config;
}

/**
 * Create console transport based on environment
 */
function createConsoleTransport(
  config: LoggingConfig
): winston.transports.ConsoleTransportInstance {
  const format =
    config.format === 'json'
      ? winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.json()
        )
      : winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const metaStr = Object.keys(meta).length
              ? JSON.stringify(meta, null, 2)
              : '';
            return `${timestamp} [${level}]: ${message} ${metaStr}`;
          })
        );

  return new winston.transports.Console({ format });
}

/**
 * Create file transports for production
 */
function createFileTransports(config: LoggingConfig): winston.transport[] {
  if (!config.enableFile || !config.filePath) {
    return [];
  }

  const fileFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  );

  return [
    new winston.transports.File({
      filename: `${config.filePath}/error.log`,
      level: 'error',
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: `${config.filePath}/combined.log`,
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ];
}

/**
 * Initialize logger with configuration
 */
function initializeLogger(): winston.Logger {
  const config = createLoggingConfig();
  const transports: winston.transport[] = [];

  // Add console transport
  if (config.enableConsole) {
    transports.push(createConsoleTransport(config));
  }

  // Add file transports for production
  transports.push(...createFileTransports(config));

  return winston.createLogger({
    levels: logLevels,
    level: config.level,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true })
    ),
    defaultMeta: {
      service: 'identity-reconciliation',
      environment: process.env['NODE_ENV'] || 'development',
    },
    transports,
    // Handle uncaught exceptions and rejections
    exceptionHandlers:
      config.enableFile && config.filePath
        ? [
            new winston.transports.File({
              filename: `${config.filePath}/exceptions.log`,
            }),
          ]
        : [],
    rejectionHandlers:
      config.enableFile && config.filePath
        ? [
            new winston.transports.File({
              filename: `${config.filePath}/rejections.log`,
            }),
          ]
        : [],
  });
}

/**
 * Create Winston logger instance
 */
export const logger = initializeLogger();

/**
 * Create child logger with additional context
 */
export function createChildLogger(context: Record<string, any>) {
  return logger.child(context);
}
