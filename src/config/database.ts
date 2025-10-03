import { PrismaClient } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger';
import { getAppConfig, getEnvironmentConfig } from './app-config';
import { DatabaseConfig } from '../types/config.types';

const execAsync = promisify(exec);

// Global Prisma client instance
let prismaInstance: PrismaClient | null = null;
let isConnected = false;

/**
 * Create database configuration from app config
 */
function createDatabaseConfig(): DatabaseConfig {
  const appConfig = getAppConfig();
  const envConfig = getEnvironmentConfig();

  return {
    url: appConfig.databaseUrl,
    provider: appConfig.databaseUrl.startsWith('file:')
      ? 'sqlite'
      : 'postgresql',
    maxConnections: envConfig.isProduction ? 10 : 5,
    connectionTimeout: envConfig.isProduction ? 30000 : 10000,
  };
}

/**
 * Get or create a Prisma client instance
 * Implements singleton pattern to ensure single database connection
 */
export function getPrismaClient(): PrismaClient {
  if (!prismaInstance) {
    const dbConfig = createDatabaseConfig();
    const envConfig = getEnvironmentConfig();

    prismaInstance = new PrismaClient({
      datasources: {
        db: {
          url: dbConfig.url,
        },
      },
      log: envConfig.isDevelopment
        ? ['query', 'info', 'warn', 'error']
        : ['error'],
      errorFormat: envConfig.isDevelopment ? 'pretty' : 'minimal',
    });

    // Log client creation
    logger.info('Prisma client created successfully');

    logger.info('Prisma client instance created', {
      provider: dbConfig.provider,
      maxConnections: dbConfig.maxConnections,
    });
  }
  return prismaInstance;
}

/**
 * Export the singleton Prisma client instance
 */
export const prisma = getPrismaClient();

/**
 * Disconnect from the database
 * Should be called during application shutdown
 */
export async function disconnectDatabase(): Promise<void> {
  if (prismaInstance && isConnected) {
    try {
      await prismaInstance.$disconnect();
      isConnected = false;
      prismaInstance = null;
      logger.info('Database disconnected successfully');
    } catch (error) {
      logger.error('Error during database disconnection', { error });
      throw error;
    }
  } else {
    logger.info('Database already disconnected or not connected');
  }
}

/**
 * Check if database is connected
 */
export function isDatabaseConnected(): boolean {
  return isConnected;
}

/**
 * Health check for database connection
 */
export async function checkDatabaseHealth(): Promise<{
  status: 'healthy' | 'unhealthy';
  message: string;
}> {
  try {
    if (!isConnected) {
      return { status: 'unhealthy', message: 'Database not connected' };
    }

    const client = getPrismaClient();
    await client.$queryRaw`SELECT 1`;

    return { status: 'healthy', message: 'Database connection is healthy' };
  } catch (error) {
    logger.error('Database health check failed', { error });
    return {
      status: 'unhealthy',
      message:
        error instanceof Error ? error.message : 'Unknown database error',
    };
  }
}

/**
 * Run database migrations
 * Should be called during application startup before connecting
 */
export async function runDatabaseMigrations(): Promise<void> {
  const envConfig = getEnvironmentConfig();

  try {
    logger.info('Running database migrations...');

    if (envConfig.isProduction) {
      // In production, use prisma migrate deploy for safety
      const { stdout, stderr } = await execAsync('npx prisma migrate deploy');
      if (
        stderr &&
        !stderr.includes('warning') &&
        !stderr.includes('Environment variables loaded')
      ) {
        throw new Error(`Migration stderr: ${stderr}`);
      }
      logger.info('Production database migrations completed', {
        output: stdout,
      });
    } else {
      // In development, use prisma migrate dev to apply and create migrations
      const { stdout, stderr } = await execAsync(
        'npx prisma migrate dev --name auto-migration'
      );
      if (
        stderr &&
        !stderr.includes('warning') &&
        !stderr.includes('Already in sync') &&
        !stderr.includes('Environment variables loaded') &&
        !stderr.includes('No migration found to apply')
      ) {
        // Only throw if it's a real error, not informational messages
        throw new Error(`Migration stderr: ${stderr}`);
      }
      logger.info('Development database migrations completed', {
        output: stdout,
      });
    }
  } catch (error) {
    logger.error('Database migration failed', {
      error: error instanceof Error ? error.message : error,
      environment: process.env['NODE_ENV'] || 'development',
    });
    throw error;
  }
}

/**
 * Generate Prisma client
 * Should be called after migrations to ensure client is up to date
 */
export async function generatePrismaClient(): Promise<void> {
  try {
    logger.info('Generating Prisma client...');
    const { stdout, stderr } = await execAsync('npx prisma generate');
    if (
      stderr &&
      !stderr.includes('warning') &&
      !stderr.includes('Environment variables loaded')
    ) {
      throw new Error(`Prisma generate stderr: ${stderr}`);
    }
    logger.info('Prisma client generated successfully', { output: stdout });
  } catch (error) {
    logger.error('Prisma client generation failed', {
      error: error instanceof Error ? error.message : error,
    });
    throw error;
  }
}

/**
 * Connect to the database and verify connection
 * Should be called during application startup after migrations
 */
export async function connectDatabase(): Promise<void> {
  if (isConnected) {
    logger.info('Database already connected');
    return;
  }

  const client = getPrismaClient();
  const dbConfig = createDatabaseConfig();

  try {
    // Set connection timeout
    const connectPromise = client.$connect();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error('Database connection timeout')),
        dbConfig.connectionTimeout
      );
    });

    await Promise.race([connectPromise, timeoutPromise]);

    // Verify connection with a simple query
    await client.$queryRaw`SELECT 1`;

    isConnected = true;
    logger.info('Database connected and verified successfully', {
      provider: dbConfig.provider,
      url: dbConfig.url.replace(/\/\/.*@/, '//***@'), // Hide credentials in logs
    });
  } catch (error) {
    isConnected = false;
    logger.error('Failed to connect to database', {
      error: error instanceof Error ? error.message : error,
      provider: dbConfig.provider,
    });
    throw error;
  }
}
