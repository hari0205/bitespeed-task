/**
 * Tests for validation middleware
 */

import { Request, Response, NextFunction } from 'express';
import {
  validateIdentifyRequest,
  identifyRequestSchema,
} from '../../middleware/validation';
import { ValidationError } from '../../types/errors.types';

describe('Validation Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {};
    mockResponse = {};
    mockNext = jest.fn();
  });

  describe('identifyRequestSchema', () => {
    it('should validate valid email only request', () => {
      const validData = { email: 'test@example.com' };
      const result = identifyRequestSchema.parse(validData);

      expect(result).toEqual({ email: 'test@example.com' });
    });

    it('should validate valid phone number only request', () => {
      const validData = { phoneNumber: '+1234567890' };
      const result = identifyRequestSchema.parse(validData);

      expect(result).toEqual({ phoneNumber: '+1234567890' });
    });

    it('should validate request with both email and phone', () => {
      const validData = {
        email: 'test@example.com',
        phoneNumber: '+1234567890',
      };
      const result = identifyRequestSchema.parse(validData);

      expect(result).toEqual({
        email: 'test@example.com',
        phoneNumber: '+1234567890',
      });
    });

    it('should normalize email to lowercase and trim', () => {
      const validData = { email: '  TEST@EXAMPLE.COM  ' };
      const result = identifyRequestSchema.parse(validData);

      expect(result).toEqual({ email: 'test@example.com' });
    });

    it('should normalize phone number by removing spaces and non-digits', () => {
      const validData = { phoneNumber: '+1 (234) 567-890' };
      const result = identifyRequestSchema.parse(validData);

      expect(result).toEqual({ phoneNumber: '+1234567890' });
    });

    it('should reject request with neither email nor phone', () => {
      const invalidData = {};

      expect(() => identifyRequestSchema.parse(invalidData)).toThrow();
    });

    it('should reject invalid email format', () => {
      const invalidData = { email: 'invalid-email' };

      expect(() => identifyRequestSchema.parse(invalidData)).toThrow();
    });

    it('should reject invalid phone number format', () => {
      const invalidData = { phoneNumber: 'abc123' };

      expect(() => identifyRequestSchema.parse(invalidData)).toThrow();
    });
  });

  describe('validateIdentifyRequest middleware', () => {
    it('should pass valid request through', () => {
      mockRequest.body = { email: 'test@example.com' };

      validateIdentifyRequest(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockRequest.body).toEqual({ email: 'test@example.com' });
    });

    it('should call next with ValidationError for invalid request', () => {
      mockRequest.body = { email: 'invalid-email' };

      validateIdentifyRequest(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    it('should call next with ValidationError for empty request', () => {
      mockRequest.body = {};

      validateIdentifyRequest(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
    });
  });
});
