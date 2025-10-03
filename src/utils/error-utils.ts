/**
 * Error utility functions for consistent error handling
 */

import {
  AppError,
  DatabaseError,
  ContactLinkingError,
  ValidationError,
  ContactNotFoundError,
  ConfigurationError,
  ServiceUnavailableError,
} from '../types/errors.types';
import { logger } from './logger';

/**
 * Wraps database operations and converts database errors to appropriate AppError types
 */
export async function handleDatabaseOperation<T>(
  operation: () => Promise<T>,
  context: string,
  correlationId?: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    logger.error(`Database operation failed: ${context}`, {
      correlationId,
      error: {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    // Handle specific Prisma errors
    if (error instanceof Error) {
      // Prisma unique constraint violation
      if (error.message.includes('Unique constraint')) {
        throw new DatabaseError('Duplicate record found', {
          operation: context,
          originalError: error.name,
        });
      }

      // Prisma foreign key constraint violation
      if (error.message.includes('Foreign key constraint')) {
        throw new DatabaseError('Referenced record not found', {
          operation: context,
          originalError: error.name,
        });
      }

      // Prisma connection errors
      if (
        error.message.includes('connection') ||
        error.message.includes('timeout')
      ) {
        throw new ServiceUnavailableError('Database connection unavailable', {
          operation: context,
          originalError: error.name,
        });
      }

      // Prisma record not found
      if (
        error.message.includes('Record to update not found') ||
        error.message.includes('Record to delete does not exist')
      ) {
        throw new ContactNotFoundError('Contact record not found', {
          operation: context,
        });
      }
    }

    // Generic database error
    throw new DatabaseError(`Database operation failed: ${context}`, {
      operation: context,
      originalError: error instanceof Error ? error.name : 'Unknown',
    });
  }
}

/**
 * Wraps service operations and provides consistent error handling
 */
export async function handleServiceOperation<T>(
  operation: () => Promise<T>,
  context: string,
  correlationId?: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    // If it's already an AppError, just re-throw it
    if (error instanceof AppError) {
      throw error;
    }

    logger.error(`Service operation failed: ${context}`, {
      correlationId,
      error: {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    // Convert unknown errors to appropriate AppError types
    if (error instanceof Error) {
      if (
        error.message.includes('validation') ||
        error.message.includes('invalid')
      ) {
        throw new ValidationError(`Validation failed: ${context}`, {
          operation: context,
          originalError: error.message,
        });
      }

      if (
        error.message.includes('linking') ||
        error.message.includes('contact')
      ) {
        throw new ContactLinkingError(`Contact linking failed: ${context}`, {
          operation: context,
          originalError: error.message,
        });
      }
    }

    // Generic service error
    throw new ContactLinkingError(`Service operation failed: ${context}`, {
      operation: context,
      originalError: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Creates a standardized error context object
 */
export function createErrorContext(
  operation: string,
  correlationId?: string,
  additionalContext?: Record<string, any>
): Record<string, any> {
  return {
    operation,
    correlationId,
    timestamp: new Date().toISOString(),
    ...additionalContext,
  };
}

/**
 * Validates that required configuration is present
 */
export function validateConfiguration(
  config: Record<string, any>,
  requiredFields: string[]
): void {
  const missingFields = requiredFields.filter(field => !config[field]);

  if (missingFields.length > 0) {
    throw new ConfigurationError(
      `Missing required configuration fields: ${missingFields.join(', ')}`,
      { missingFields }
    );
  }
}

/**
 * Safely extracts error message from unknown error types
 */
export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }

  return 'Unknown error occurred';
}

/**
 * Checks if an error is retryable (e.g., network errors, timeouts)
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof ServiceUnavailableError) {
    return true;
  }

  if (error instanceof DatabaseError) {
    const message = error.message.toLowerCase();
    return (
      message.includes('timeout') ||
      message.includes('connection') ||
      message.includes('network')
    );
  }

  return false;
}
