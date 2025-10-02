/**
 * Request validation middleware using Zod schemas
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError } from '../types/errors.types';

/**
 * Zod schema for IdentifyRequest validation
 */
export const identifyRequestSchema = z
  .object({
    email: z
      .string()
      .optional()
      .transform(val => val?.toLowerCase().trim())
      .refine(val => !val || z.string().email().safeParse(val).success, {
        message: 'Invalid email format',
      }),
    phoneNumber: z
      .string()
      .optional()
      .refine(val => !val || /^\+?[\d\s\-\(\)]+$/.test(val), {
        message: 'Invalid phone number format',
      })
      .transform(val => val?.replace(/\s+/g, '').replace(/[^\d+]/g, '')),
  })
  .refine(data => data.email || data.phoneNumber, {
    message: 'Either email or phoneNumber must be provided',
    path: ['email', 'phoneNumber'],
  });

/**
 * Type for validated IdentifyRequest
 */
export type ValidatedIdentifyRequest = z.infer<typeof identifyRequestSchema>;

/**
 * Generic validation middleware factory
 */
export function validateRequest<T>(schema: z.ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const validatedData = schema.parse(req.body);
      req.body = validatedData;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = new ValidationError(
          'Request validation failed',
          {
            issues: error.issues.map(issue => ({
              path: issue.path.join('.'),
              message: issue.message,
              code: issue.code,
            })),
          }
        );
        next(validationError);
      } else {
        next(error);
      }
    }
  };
}

/**
 * Middleware for validating /identify endpoint requests
 */
export const validateIdentifyRequest = validateRequest(identifyRequestSchema);
