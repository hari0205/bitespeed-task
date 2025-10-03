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

/**
 * Error thrown when request timeout occurs
 */
export class TimeoutError extends AppError {
  readonly statusCode = 408;
  readonly code = 'REQUEST_TIMEOUT';

  constructor(message: string = 'Request timeout', details?: any) {
    super(message, details);
  }
}

/**
 * Error thrown when request payload is too large
 */
export class PayloadTooLargeError extends AppError {
  readonly statusCode = 413;
  readonly code = 'PAYLOAD_TOO_LARGE';

  constructor(message: string = 'Request payload too large', details?: any) {
    super(message, details);
  }
}

/**
 * Error thrown when service is unavailable
 */
export class ServiceUnavailableError extends AppError {
  readonly statusCode = 503;
  readonly code = 'SERVICE_UNAVAILABLE';

  constructor(
    message: string = 'Service temporarily unavailable',
    details?: any
  ) {
    super(message, details);
  }
}

/**
 * Error thrown when unauthorized access is attempted
 */
export class UnauthorizedError extends AppError {
  readonly statusCode = 401;
  readonly code = 'UNAUTHORIZED';

  constructor(message: string = 'Unauthorized access', details?: any) {
    super(message, details);
  }
}

/**
 * Error thrown when access is forbidden
 */
export class ForbiddenError extends AppError {
  readonly statusCode = 403;
  readonly code = 'FORBIDDEN';

  constructor(message: string = 'Access forbidden', details?: any) {
    super(message, details);
  }
}
