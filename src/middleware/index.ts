/**
 * Middleware exports for the Identity Reconciliation system
 */

export {
  validateRequest,
  validateIdentifyRequest,
  identifyRequestSchema,
  type ValidatedIdentifyRequest,
} from './validation';

export { errorHandler, notFoundHandler, asyncHandler } from './error-handler';

export {
  requestLogger,
  sanitizeHeaders,
  type RequestWithCorrelation,
} from './logging';

export {
  securityHeaders,
  corsMiddleware,
  corsOptions,
  rateLimiter,
  requestSizeLimit,
} from './security';
