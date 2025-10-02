/**
 * Tests for error handling middleware
 */

import { Request, Response, NextFunction } from 'express';
import {
  errorHandler,
  notFoundHandler,
  asyncHandler,
} from '../../middleware/error-handler';
import { ValidationError, DatabaseError } from '../../types/errors.types';

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

describe('Error Handler Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      method: 'POST',
      url: '/identify',
      path: '/identify',
      headers: {},
      body: {},
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  describe('errorHandler', () => {
    it('should handle ValidationError correctly', () => {
      const error = new ValidationError('Validation failed', {
        field: 'email',
      });

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: { field: 'email' },
        },
        timestamp: expect.any(String),
        path: '/identify',
      });
    });

    it('should handle DatabaseError correctly', () => {
      const error = new DatabaseError('Database connection failed');

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          message: 'Database connection failed',
          code: 'DATABASE_ERROR',
          details: undefined,
        },
        timestamp: expect.any(String),
        path: '/identify',
      });
    });

    it('should handle unknown errors as internal server error', () => {
      const error = new Error('Unknown error');

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          message: 'Internal server error',
          code: 'INTERNAL_SERVER_ERROR',
        },
        timestamp: expect.any(String),
        path: '/identify',
      });
    });
  });

  describe('notFoundHandler', () => {
    it('should return 404 for unknown routes', () => {
      const unknownRequest = {
        ...mockRequest,
        method: 'GET',
        path: '/unknown',
      } as Request;

      notFoundHandler(unknownRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          message: 'Route GET /unknown not found',
          code: 'ROUTE_NOT_FOUND',
        },
        timestamp: expect.any(String),
        path: '/unknown',
      });
    });
  });

  describe('asyncHandler', () => {
    it('should handle successful async operations', async () => {
      const asyncFn = jest.fn().mockResolvedValue('success');
      const wrappedFn = asyncHandler(asyncFn);

      await wrappedFn(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(asyncFn).toHaveBeenCalledWith(mockRequest, mockResponse, mockNext);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should catch and pass async errors to next', async () => {
      const error = new Error('Async error');
      const asyncFn = jest.fn().mockRejectedValue(error);
      const wrappedFn = asyncHandler(asyncFn);

      await wrappedFn(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});
