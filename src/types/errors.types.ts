/**
 * Custom error classes for the Identity Reconciliation system
 */

/**
 * Base application error class
 */
export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: string;

  constructor(
    message: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error thrown when request validation fails
 */
export class ValidationError extends AppError {
  readonly statusCode = 400;
  readonly code = 'VALIDATION_ERROR';

  constructor(message: string, details?: any) {
    super(message, details);
  }
}

/**
 * Error thrown when a contact is not found
 */
export class ContactNotFoundError extends AppError {
  readonly statusCode = 404;
  readonly code = 'CONTACT_NOT_FOUND';

  constructor(message: string = 'Contact not found', details?: any) {
    super(message, details);
  }
}

/**
 * Error thrown when database operations fail
 */
export class DatabaseError extends AppError {
  readonly statusCode = 500;
  readonly code = 'DATABASE_ERROR';

  constructor(message: string = 'Database operation failed', details?: any) {
    super(message, details);
  }
}

/**
 * Error thrown when contact linking operations fail
 */
export class ContactLinkingError extends AppError {
  readonly statusCode = 422;
  readonly code = 'CONTACT_LINKING_ERROR';

  constructor(
    message: string = 'Contact linking operation failed',
    details?: any
  ) {
    super(message, details);
  }
}

/**
 * Error thrown when configuration is invalid or missing
 */
export class ConfigurationError extends AppError {
  readonly statusCode = 500;
  readonly code = 'CONFIGURATION_ERROR';

  constructor(message: string = 'Configuration error', details?: any) {
    super(message, details);
  }
}

/**
 * Error thrown when rate limits are exceeded
 */
export class RateLimitError extends AppError {
  readonly statusCode = 429;
  readonly code = 'RATE_LIMIT_EXCEEDED';

  constructor(message: string = 'Rate limit exceeded', details?: any) {
    super(message, details);
  }
}
