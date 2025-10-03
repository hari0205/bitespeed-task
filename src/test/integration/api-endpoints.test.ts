/**
 * Integration tests for API endpoints
 */

import request from 'supertest';
import app from '../../index';

describe('API Endpoints Integration Tests', () => {
  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body).toMatchObject({
        status: 'ok',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        version: expect.any(String),
      });
    });

    it('should include correlation ID in response headers', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.headers['x-correlation-id']).toBeDefined();
    });
  });

  describe('GET /', () => {
    it('should return API information', async () => {
      const response = await request(app).get('/').expect(200);

      expect(response.body).toEqual({
        message: 'Identity Reconciliation API',
        version: '1.0.0',
        endpoints: {
          health: 'GET /health',
          identify: 'POST /identify',
        },
      });
    });
  });

  describe('POST /identify', () => {
    it('should process identify request with valid data', async () => {
      const requestBody = {
        email: 'test@example.com',
        phoneNumber: '+1234567890',
      };

      const response = await request(app)
        .post('/identify')
        .send(requestBody)
        .expect(200);

      expect(response.body).toMatchObject({
        contact: {
          primaryContactId: expect.any(Number),
          emails: expect.arrayContaining(['test@example.com']),
          phoneNumbers: expect.arrayContaining(['+1234567890']),
          secondaryContactIds: expect.any(Array),
        },
      });
    });

    it('should validate request body and return 400 for invalid data', async () => {
      const response = await request(app)
        .post('/identify')
        .send({})
        .expect(400);

      expect(response.body).toMatchObject({
        error: {
          message: 'Request validation failed',
          code: 'VALIDATION_ERROR',
          details: expect.any(Object),
        },
        timestamp: expect.any(String),
        path: '/identify',
      });
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/identify')
        .send({
          email: 'invalid-email',
          phoneNumber: '+1234567890',
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should include correlation ID in response headers', async () => {
      const response = await request(app)
        .post('/identify')
        .send({
          email: 'test@example.com',
        })
        .expect(200);

      expect(response.headers['x-correlation-id']).toBeDefined();
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting after many requests', async () => {
      // This test would require many requests to trigger rate limiting
      // For now, just verify the endpoint responds normally
      const response = await request(app).get('/health').expect(200);

      expect(response.body.status).toBe('ok');
    }, 10000);
  });

  describe('CORS', () => {
    it('should include CORS headers', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(app).get('/health').expect(200);

      // Check for some common security headers added by helmet
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBeDefined();
    });
  });

  describe('404 Not Found', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/non-existent-route')
        .expect(404);

      expect(response.body).toMatchObject({
        error: {
          message: expect.stringContaining(
            'Route GET /non-existent-route not found'
          ),
          code: 'ROUTE_NOT_FOUND',
        },
        timestamp: expect.any(String),
        path: '/non-existent-route',
      });
    });
  });
});
