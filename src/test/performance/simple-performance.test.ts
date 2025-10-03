/**
 * Simple Performance Test to verify setup
 * Basic performance validation for the Identity Reconciliation API
 */

import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import testApp from './test-app';

describe('Simple Performance Test', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env['DATABASE_URL'] || 'file:./test.db',
        },
      },
    });
    await prisma.$connect();
  });

  beforeEach(async () => {
    await prisma.contact.deleteMany({});
  });

  afterAll(async () => {
    await prisma.contact.deleteMany({});
    await prisma.$disconnect();
  });

  it('should handle basic performance test', async () => {
    const startTime = Date.now();

    // Perform 10 simple requests
    const requests = [];
    for (let i = 0; i < 10; i++) {
      const requestPromise = request(testApp)
        .post('/identify')
        .send({
          email: `perf-test-${i}@example.com`,
          phoneNumber: `+1234567${i.toString().padStart(3, '0')}`,
        })
        .expect(200);

      requests.push(requestPromise);
    }

    const responses = await Promise.all(requests);
    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`Completed 10 requests in ${duration}ms`);
    console.log(`Average response time: ${duration / 10}ms`);

    // Basic assertions
    expect(responses).toHaveLength(10);
    expect(duration).toBeLessThan(5000); // Should complete in less than 5 seconds

    responses.forEach(response => {
      expect(response.body.contact).toBeDefined();
      expect(response.body.contact.primaryContactId).toBeDefined();
    });

    // Verify database state
    const contactCount = await prisma.contact.count();
    expect(contactCount).toBe(10);
  }, 10000);

  it('should handle health endpoint performance', async () => {
    const startTime = Date.now();

    // Perform 20 health check requests
    const requests = [];
    for (let i = 0; i < 20; i++) {
      const requestPromise = request(testApp).get('/health');

      requests.push(requestPromise);
    }

    const responses = await Promise.all(requests);
    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`Completed 20 health checks in ${duration}ms`);
    console.log(`Average response time: ${duration / 20}ms`);

    // Basic assertions
    expect(responses).toHaveLength(20);
    expect(duration).toBeLessThan(2000); // Should complete in less than 2 seconds

    responses.forEach(response => {
      expect([200, 503]).toContain(response.status); // Allow for database connection issues
    });
  }, 10000);
});
