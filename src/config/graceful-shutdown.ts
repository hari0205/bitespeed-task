/**
 * Graceful shutdown handler for the application
 * Manages cleanup of resources during application termination
 */

import { Server } from 'http';
import { logger } from '../utils/logger';
import { disconnectDatabase } from './database';

/**
 * Shutdown handler configuration
 */
interface ShutdownConfig {
  gracefulTimeoutMs: number;
  forceTimeoutMs: number;
}

/**
 * Default shutdown configuration
 */
const DEFAULT_SHUTDOWN_CONFIG: ShutdownConfig = {
  gracefulTimeoutMs: 5000, // 5 seconds for graceful shutdown
  forceTimeoutMs: 10000, // 10 seconds before force exit
};

/**
 * Cleanup function type
 */
type CleanupFunction = () => Promise<void> | void;

/**
 * Graceful shutdown manager
 */
export class GracefulShutdownManager {
  private server: Server | null = null;
  private cleanupFunctions: CleanupFunction[] = [];
  private config: ShutdownConfig;
  private isShuttingDown = false;

  constructor(config: Partial<ShutdownConfig> = {}) {
    this.config = { ...DEFAULT_SHUTDOWN_CONFIG, ...config };
  }

  /**
   * Set the HTTP server instance
   */
  setServer(server: Server): void {
    this.server = server;
  }

  /**
   * Add a cleanup function to be called during shutdown
   */
  addCleanupFunction(fn: CleanupFunction): void {
    this.cleanupFunctions.push(fn);
  }

  /**
   * Initialize graceful shutdown handlers
   */
  initialize(): void {
    // Handle termination signals
    process.on('SIGTERM', () => this.handleShutdown('SIGTERM'));
    process.on('SIGINT', () => this.handleShutdown('SIGINT'));

    // Handle uncaught exceptions and rejections
    process.on('uncaughtException', error => {
      logger.error('Uncaught exception', { error });
      this.handleShutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection', { reason, promise });
      this.handleShutdown('unhandledRejection');
    });

    logger.info('Graceful shutdown handlers initialized');
  }

  /**
   * Handle shutdown process
   */
  private async handleShutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn(`${signal} received during shutdown, ignoring`);
      return;
    }

    this.isShuttingDown = true;
    logger.info(`${signal} received, initiating graceful shutdown`);

    // Set force exit timeout
    const forceExitTimer = setTimeout(() => {
      logger.error('Graceful shutdown timeout exceeded, forcing exit');
      process.exit(1);
    }, this.config.forceTimeoutMs);

    try {
      // Stop accepting new connections
      if (this.server) {
        await this.stopServer();
      }

      // Run cleanup functions
      await this.runCleanupFunctions();

      // Disconnect from database
      await this.disconnectDatabase();

      logger.info('Graceful shutdown completed successfully');
      clearTimeout(forceExitTimer);
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown', { error });
      clearTimeout(forceExitTimer);
      process.exit(1);
    }
  }

  /**
   * Stop the HTTP server
   */
  private async stopServer(): Promise<void> {
    if (!this.server) {
      return;
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Server shutdown timeout'));
      }, this.config.gracefulTimeoutMs);

      this.server!.close(error => {
        clearTimeout(timeout);
        if (error) {
          logger.error('Error closing server', { error });
          reject(error);
        } else {
          logger.info('HTTP server closed successfully');
          resolve();
        }
      });
    });
  }

  /**
   * Run all registered cleanup functions
   */
  private async runCleanupFunctions(): Promise<void> {
    logger.info(`Running ${this.cleanupFunctions.length} cleanup functions`);

    const cleanupPromises = this.cleanupFunctions.map(async (fn, index) => {
      try {
        await fn();
        logger.debug(`Cleanup function ${index + 1} completed`);
      } catch (error) {
        logger.error(`Cleanup function ${index + 1} failed`, { error });
      }
    });

    await Promise.allSettled(cleanupPromises);
    logger.info('All cleanup functions completed');
  }

  /**
   * Disconnect from database
   */
  private async disconnectDatabase(): Promise<void> {
    try {
      await disconnectDatabase();
    } catch (error) {
      logger.error('Error disconnecting from database', { error });
      throw error;
    }
  }
}

/**
 * Create and configure graceful shutdown manager
 */
export function createGracefulShutdownManager(
  config?: Partial<ShutdownConfig>
): GracefulShutdownManager {
  return new GracefulShutdownManager(config);
}
