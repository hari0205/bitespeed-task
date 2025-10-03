/**
 * Error Handler Middleware Tests
 * Tests for comprehensive error handling functionality
 */

import request from 'supertest';
import express from 'express';
import { errorHandler, notFoundHandler } from '../../middleware/error-handler';
import {
  ValidationError,
  ContactNotFoundError,
  DatabaseError,
  ContactLinkingError,
} from '../../types/errors.types';

describe('Error Handler Middleware', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe('errorHandler', () => {
    it('should handle ValidationError with proper status and format', async () => {
      app.get('/test', (_req, _res, next) => {
        next(new ValidationError('Invalid input', { field: 'email' }));
      });
      app.use(errorHandler);

      const response = await request(app).get('/test');

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: {
          message: 'Invalid input',
          code: 'VALIDATION_ERROR',
          details: { field: 'email' },
        },
        timestamp: expect.any(String),
        path: '/test',
        correlationId: expect.any(String),
      });
    });

    it('should handle ContactNotFoundError with proper status', async () => {
      app.get('/test', (_req, _res, next) => {
        next(new ContactNotFoundError('Contact not found'));
      });
      app.use(errorHandler);

      const response = await request(app).get('/test');

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('CONTACT_NOT_FOUND');
    });

    it('should handle DatabaseError with proper status', async () => {
      app.get('/test', (_req, _res, next) => {
        next(new DatabaseError('Database connection failed'));
      });
      app.use(errorHandler);

      const response = await request(app).get('/test');

      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe('DATABASE_ERROR');
    });

    it('should handle ContactLinkingError with proper status', async () => {
      app.get('/test', (_req, _res, next) => {
        next(new ContactLinkingError('Linking failed'));
      });
      app.use(errorHandler);

      const response = await request(app).get('/test');

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('CONTACT_LINKING_ERROR');
    });

    it('should handle unknown errors safely in production', async () => {
      const originalEnv = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'production';

      app.get('/test', (_req, _res, next) => {
        next(new Error('Internal database connection string: secret123'));
      });
      app.use(errorHandler);

      const response = await request(app).get('/test');

      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe('INTERNAL_SERVER_ERROR');
      expect(response.body.error.message).toBe('Internal server error');
      expect(response.body.error.details).toBeUndefined();

      process.env['NODE_ENV'] = originalEnv;
    });

    it('should sanitize sensitive data from error details', async () => {
      app.get('/test', (_req, _res, next) => {
        next(
          new ValidationError('Validation failed', {
            password: 'secret123',
            token: 'jwt-token',
            apiKey: 'api-key-123',
            validField: 'this should remain',
          })
        );
      });
      app.use(errorHandler);

      const response = await request(app).get('/test');

      expect(response.body.error.details.password).toBeUndefined();
      expect(response.body.error.details.token).toBeUndefined();
      expect(response.body.error.details.apiKey).toBeUndefined();
      expect(response.body.error.details.validField).toBe('this should remain');
    });

    it('should include correlation ID from request headers', async () => {
      app.get('/test', (_req, _res, next) => {
        next(new ValidationError('Test error'));
      });
      app.use(errorHandler);

      const response = await request(app)
        .get('/test')
        .set('x-correlation-id', 'test-correlation-123');

      expect(response.body.correlationId).toBe('test-correlation-123');
    });
  });

  describe('notFoundHandler', () => {
    it('should handle 404 routes with proper format', async () => {
      app.use(notFoundHandler);

      const response = await request(app).get('/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        error: {
          message: 'Route GET /nonexistent not found',
          code: 'ROUTE_NOT_FOUND',
        },
        timestamp: expect.any(String),
        path: '/nonexistent',
        correlationId: expect.any(String),
      });
    });
  });
});
