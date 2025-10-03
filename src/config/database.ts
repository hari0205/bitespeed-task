import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

// Global Prisma client instance
let prismaInstance: PrismaClient;

/**
 * Get or create a Prisma client instance
 * Implements singleton pattern to ensure single database connection
 */
export function getPrismaClient(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      log:
        process.env['NODE_ENV'] === 'development'
          ? ['query', 'info', 'warn', 'error']
          : ['error'],
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
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    logger.info('Database disconnected');
  }
}

/**
 * Connect to the database and verify connection
 * Should be called during application startup
 */
export async function connectDatabase(): Promise<void> {
  const client = getPrismaClient();
  try {
    await client.$connect();
    logger.info('Database connected successfully');
  } catch (error) {
    logger.error('Failed to connect to database', { error });
    throw error;
  }
}
