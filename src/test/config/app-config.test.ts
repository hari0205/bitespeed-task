/**
 * Tests for application configuration system
 */

import {
  validateEnvironmentVariables,
  validateConfiguration,
} from '../../config/validation';
import { loadAppConfig } from '../../config/app-config';

describe('Application Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables
    process.env = { ...originalEnv };
    // Clear NODE_ENV to test defaults
    delete process.env['NODE_ENV'];
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('validateEnvironmentVariables', () => {
    it('should validate environment variables with defaults', () => {
      process.env['DATABASE_URL'] = 'file:./test.db';

      const result = validateEnvironmentVariables();

      expect(result['NODE_ENV']).toBe('development');
      expect(result['PORT']).toBe(3000);
      expect(result['DATABASE_URL']).toBe('file:./test.db');
      expect(result['LOG_LEVEL']).toBe('info');
      expect(result['CORS_ORIGIN']).toBe('*');
      expect(result['RATE_LIMIT_WINDOW_MS']).toBe(900000);
      expect(result['RATE_LIMIT_MAX_REQUESTS']).toBe(100);
    });

    it('should use provided environment variables', () => {
      process.env['NODE_ENV'] = 'production';
      process.env['PORT'] = '8080';
      process.env['DATABASE_URL'] = 'postgresql://localhost:5432/test';
      process.env['LOG_LEVEL'] = 'error';
      process.env['CORS_ORIGIN'] = 'https://example.com';
      process.env['RATE_LIMIT_WINDOW_MS'] = '600000';
      process.env['RATE_LIMIT_MAX_REQUESTS'] = '200';

      const result = validateEnvironmentVariables();

      expect(result['NODE_ENV']).toBe('production');
      expect(result['PORT']).toBe(8080);
      expect(result['DATABASE_URL']).toBe('postgresql://localhost:5432/test');
      expect(result['LOG_LEVEL']).toBe('error');
      expect(result['CORS_ORIGIN']).toBe('https://example.com');
      expect(result['RATE_LIMIT_WINDOW_MS']).toBe(600000);
      expect(result['RATE_LIMIT_MAX_REQUESTS']).toBe(200);
    });

    it('should throw error for missing DATABASE_URL', () => {
      delete process.env['DATABASE_URL'];

      expect(() => validateEnvironmentVariables()).toThrow(
        'Invalid environment configuration'
      );
    });

    it('should throw error for invalid PORT', () => {
      process.env['DATABASE_URL'] = 'file:./test.db';
      process.env['PORT'] = 'invalid';

      expect(() => validateEnvironmentVariables()).toThrow(
        'Invalid environment configuration'
      );
    });
  });

  describe('loadAppConfig', () => {
    it('should load and transform configuration correctly', () => {
      process.env['DATABASE_URL'] = 'file:./test.db';
      process.env['PORT'] = '3001';
      process.env['NODE_ENV'] = 'test';

      const config = loadAppConfig();

      expect(config.port).toBe(3001);
      expect(config.nodeEnv).toBe('test');
      expect(config.databaseUrl).toBe('file:./test.db');
      expect(config.logLevel).toBe('info');
      expect(config.corsOrigin).toBe('*');
      expect(config.rateLimitWindowMs).toBe(900000);
      expect(config.rateLimitMaxRequests).toBe(100);
    });
  });

  describe('validateConfiguration', () => {
    it('should perform comprehensive validation', () => {
      process.env['DATABASE_URL'] = 'file:./test.db';

      expect(() => validateConfiguration()).not.toThrow();
    });
  });
});
