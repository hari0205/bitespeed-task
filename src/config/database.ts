import { PrismaClient } from '@prisma/client';

// Global Prisma client instance
let prisma: PrismaClient;

/**
 * Get or create a Prisma client instance
 * Implements singleton pattern to ensure single database connection
 */
export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      log:
        process.env['NODE_ENV'] === 'development'
          ? ['query', 'info', 'warn', 'error']
          : ['error'],
    });
  }
  return prisma;
}

/**
 * Disconnect from the database
 * Should be called during application shutdown
 */
export async function disconnectDatabase(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
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
    console.log('Database connected successfully');
  } catch (error) {
    console.error('Failed to connect to database:', error);
    throw error;
  }
}
