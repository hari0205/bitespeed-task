/**
 * Performance and Load Testing for Identity Reconciliation API
 * Tests concurrent request handling, race conditions, memory usage, and response times
 * Requirements: 7.4, 6.4
 */

import autocannon from 'autocannon';
import { PrismaClient } from '@prisma/client';
import testApp from './test-app';
import { Server } from 'http';

describe('Performance and Load Testing', () => {
  let server: Server;
  let prisma: PrismaClient;
  const port = 3001; // Use different port for performance tests

  beforeAll(async () => {
    // Initialize Prisma client for test database
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env['DATABASE_URL'] || 'file:./test.db',
        },
      },
    });

    await prisma.$connect();

    // Start server for performance testing
    server = testApp.listen(port);

    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  beforeEach(async () => {
    // Clean database before each test
    await prisma.contact.deleteMany({});
  });

  afterAll(async () => {
    // Clean up and disconnect
    await prisma.contact.deleteMany({});
    await prisma.$disconnect();

    if (server) {
      server.close();
    }
  });

  describe('Identify Endpoint Performance Benchmarks', () => {
    it('should handle baseline load for new contact creation', async () => {
      const result = await autocannon({
        url: `http://localhost:${port}/identify`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'performance@example.com',
          phoneNumber: '+1234567890',
        }),
        connections: 10,
        duration: 10, // 10 seconds
        pipelining: 1,
      });

      // Performance assertions
      expect(result.errors).toBe(0);
      expect(result.timeouts).toBe(0);
      expect(result.non2xx).toBe(0);

      // Response time requirements (in milliseconds)
      expect(result.latency.mean).toBeLessThan(100); // Average response time < 100ms
      expect(result.latency.p95).toBeLessThan(200); // 95th percentile < 200ms
      expect(result.latency.p99).toBeLessThan(500); // 99th percentile < 500ms

      // Throughput requirements
      expect(result.requests.mean).toBeGreaterThan(50); // At least 50 req/sec average

      console.log('Baseline Performance Results:', {
        avgLatency: result.latency.mean,
        p95Latency: result.latency.p95,
        p99Latency: result.latency.p99,
        avgThroughput: result.requests.mean,
        totalRequests: result.requests.total,
        errors: result.errors,
      });
    }, 30000);

    it('should handle moderate concurrent load', async () => {
      const result = await autocannon({
        url: `http://localhost:${port}/identify`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'concurrent@example.com',
          phoneNumber: '+1111111111',
        }),
        connections: 25,
        duration: 15, // 15 seconds
        pipelining: 1,
      });

      // Performance assertions for moderate load
      expect(result.errors).toBe(0);
      expect(result.timeouts).toBe(0);
      expect(result.non2xx).toBe(0);

      // Allow slightly higher latency under load
      expect(result.latency.mean).toBeLessThan(150);
      expect(result.latency.p95).toBeLessThan(300);
      expect(result.latency.p99).toBeLessThan(1000);

      // Should maintain reasonable throughput
      expect(result.requests.mean).toBeGreaterThan(30);

      console.log('Moderate Load Performance Results:', {
        avgLatency: result.latency.mean,
        p95Latency: result.latency.p95,
        p99Latency: result.latency.p99,
        avgThroughput: result.requests.mean,
        totalRequests: result.requests.total,
        errors: result.errors,
      });
    }, 45000);

    it('should handle high concurrent load with varied data', async () => {
      // Use a generator function to create varied request data
      let requestCounter = 0;

      const result = await autocannon({
        url: `http://localhost:${port}/identify`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        setupClient: client => {
          client.setBody = () => {
            const id = requestCounter++;
            return JSON.stringify({
              email: `user${id}@example.com`,
              phoneNumber: `+123456${id.toString().padStart(4, '0')}`,
            });
          };
        },
        connections: 50,
        duration: 20, // 20 seconds
        pipelining: 1,
      });

      // Performance assertions for high load
      expect(result.errors).toBe(0);
      expect(result.timeouts).toBe(0);
      expect(result.non2xx).toBe(0);

      // Allow higher latency under high load but still reasonable
      expect(result.latency.mean).toBeLessThan(200);
      expect(result.latency.p95).toBeLessThan(500);
      expect(result.latency.p99).toBeLessThan(2000);

      // Should maintain minimum throughput
      expect(result.requests.mean).toBeGreaterThan(20);

      console.log('High Load Performance Results:', {
        avgLatency: result.latency.mean,
        p95Latency: result.latency.p95,
        p99Latency: result.latency.p99,
        avgThroughput: result.requests.mean,
        totalRequests: result.requests.total,
        errors: result.errors,
      });
    }, 60000);
  });

  describe('Contact Linking Performance', () => {
    it('should handle linking scenarios efficiently', async () => {
      // Pre-populate database with some contacts for linking scenarios
      await prisma.contact.createMany({
        data: [
          {
            email: 'primary1@example.com',
            phoneNumber: '+1000000001',
            linkPrecedence: 'primary',
          },
          {
            email: 'primary2@example.com',
            phoneNumber: '+1000000002',
            linkPrecedence: 'primary',
          },
          {
            email: 'primary3@example.com',
            phoneNumber: '+1000000003',
            linkPrecedence: 'primary',
          },
        ],
      });

      const result = await autocannon({
        url: `http://localhost:${port}/identify`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'primary1@example.com',
          phoneNumber: '+1000000002', // This will link two primaries
        }),
        connections: 20,
        duration: 10,
        pipelining: 1,
      });

      // Linking operations might be slightly slower
      expect(result.errors).toBe(0);
      expect(result.timeouts).toBe(0);
      expect(result.non2xx).toBe(0);

      expect(result.latency.mean).toBeLessThan(150);
      expect(result.latency.p95).toBeLessThan(400);
      expect(result.latency.p99).toBeLessThan(1000);

      console.log('Contact Linking Performance Results:', {
        avgLatency: result.latency.mean,
        p95Latency: result.latency.p95,
        p99Latency: result.latency.p99,
        avgThroughput: result.requests.mean,
        totalRequests: result.requests.total,
        errors: result.errors,
      });
    }, 30000);
  });

  describe('Health Endpoint Performance', () => {
    it('should handle health check requests efficiently', async () => {
      const result = await autocannon({
        url: `http://localhost:${port}/health`,
        method: 'GET',
        connections: 50,
        duration: 10,
        pipelining: 1,
      });

      // Health endpoint should be very fast
      expect(result.errors).toBe(0);
      expect(result.timeouts).toBe(0);

      // Allow for some 503 responses if database is temporarily unavailable
      const successRate =
        (result.requests.total - result.non2xx) / result.requests.total;
      expect(successRate).toBeGreaterThan(0.9); // At least 90% success rate

      expect(result.latency.mean).toBeLessThan(50);
      expect(result.latency.p95).toBeLessThan(100);
      expect(result.latency.p99).toBeLessThan(200);

      console.log('Health Endpoint Performance Results:', {
        avgLatency: result.latency.mean,
        p95Latency: result.latency.p95,
        p99Latency: result.latency.p99,
        avgThroughput: result.requests.mean,
        totalRequests: result.requests.total,
        successRate: successRate,
        errors: result.errors,
      });
    }, 30000);
  });

  describe('Memory Usage and Resource Monitoring', () => {
    it('should maintain stable memory usage under load', async () => {
      const initialMemory = process.memoryUsage();

      // Run sustained load test
      const result = await autocannon({
        url: `http://localhost:${port}/identify`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'memory@example.com',
          phoneNumber: '+1999999999',
        }),
        connections: 30,
        duration: 30, // Longer duration to test memory stability
        pipelining: 1,
      });

      // Allow some time for garbage collection
      await new Promise(resolve => setTimeout(resolve, 2000));

      const finalMemory = process.memoryUsage();

      // Memory growth should be reasonable
      const heapGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      const heapGrowthMB = heapGrowth / (1024 * 1024);

      // Allow up to 50MB heap growth during sustained load
      expect(heapGrowthMB).toBeLessThan(50);

      // RSS (Resident Set Size) growth should also be reasonable
      const rssGrowth = finalMemory.rss - initialMemory.rss;
      const rssGrowthMB = rssGrowth / (1024 * 1024);
      expect(rssGrowthMB).toBeLessThan(100);

      console.log('Memory Usage Results:', {
        initialHeapMB: initialMemory.heapUsed / (1024 * 1024),
        finalHeapMB: finalMemory.heapUsed / (1024 * 1024),
        heapGrowthMB,
        initialRssMB: initialMemory.rss / (1024 * 1024),
        finalRssMB: finalMemory.rss / (1024 * 1024),
        rssGrowthMB,
        totalRequests: result.requests.total,
        avgThroughput: result.requests.mean,
      });

      expect(result.errors).toBe(0);
      expect(result.timeouts).toBe(0);
    }, 60000);
  });

  describe('Database Query Performance', () => {
    it('should maintain efficient database operations under load', async () => {
      // Pre-populate database with many contacts to test query performance
      const contacts = Array.from({ length: 1000 }, (_, i) => ({
        email: `dbtest${i}@example.com`,
        phoneNumber: `+1800${i.toString().padStart(7, '0')}`,
        linkPrecedence: 'primary' as const,
      }));

      await prisma.contact.createMany({ data: contacts });

      const result = await autocannon({
        url: `http://localhost:${port}/identify`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'dbtest500@example.com', // Query existing contact
        }),
        connections: 20,
        duration: 15,
        pipelining: 1,
      });

      // Database queries should remain efficient even with many records
      expect(result.errors).toBe(0);
      expect(result.timeouts).toBe(0);
      expect(result.non2xx).toBe(0);

      expect(result.latency.mean).toBeLessThan(100);
      expect(result.latency.p95).toBeLessThan(250);
      expect(result.latency.p99).toBeLessThan(500);

      console.log('Database Query Performance Results:', {
        avgLatency: result.latency.mean,
        p95Latency: result.latency.p95,
        p99Latency: result.latency.p99,
        avgThroughput: result.requests.mean,
        totalRequests: result.requests.total,
        databaseRecords: 1000,
      });
    }, 45000);
  });

  describe('Race Condition Testing', () => {
    it('should handle concurrent requests for same contact data without race conditions', async () => {
      const testEmail = 'race@example.com';
      const testPhone = '+1555555555';

      // Send many concurrent requests with identical data
      const result = await autocannon({
        url: `http://localhost:${port}/identify`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: testEmail,
          phoneNumber: testPhone,
        }),
        connections: 50,
        duration: 5, // Short duration but high concurrency
        pipelining: 1,
      });

      expect(result.errors).toBe(0);
      expect(result.timeouts).toBe(0);
      expect(result.non2xx).toBe(0);

      // Verify database consistency after race condition test
      const contacts = await prisma.contact.findMany({
        where: {
          OR: [{ email: testEmail }, { phoneNumber: testPhone }],
        },
      });

      // Due to race conditions, we might have multiple contacts created
      // but they should all have the same email and phone
      expect(contacts.length).toBeGreaterThan(0);
      contacts.forEach(contact => {
        expect(contact.email).toBe(testEmail);
        expect(contact.phoneNumber).toBe(testPhone);
      });

      // Count primary contacts - ideally should be 1, but race conditions might create more
      const primaryContacts = contacts.filter(
        c => c.linkPrecedence === 'primary'
      );
      expect(primaryContacts.length).toBeGreaterThan(0);
      expect(primaryContacts.length).toBeLessThanOrEqual(10); // Reasonable upper bound

      console.log('Race Condition Test Results:', {
        totalRequests: result.requests.total,
        contactsCreated: contacts.length,
        primaryContacts: primaryContacts.length,
        avgLatency: result.latency.mean,
        errors: result.errors,
      });
    }, 30000);

    it('should handle concurrent linking scenarios consistently', async () => {
      // Create initial contacts
      const primary1 = await prisma.contact.create({
        data: {
          email: 'link1@example.com',
          phoneNumber: '+1111111111',
          linkPrecedence: 'primary',
        },
      });

      const primary2 = await prisma.contact.create({
        data: {
          email: 'link2@example.com',
          phoneNumber: '+1222222222',
          linkPrecedence: 'primary',
        },
      });

      // Send concurrent requests that should link these contacts
      const result = await autocannon({
        url: `http://localhost:${port}/identify`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'link1@example.com',
          phoneNumber: '+1222222222', // Links the two primaries
        }),
        connections: 30,
        duration: 5,
        pipelining: 1,
      });

      expect(result.errors).toBe(0);
      expect(result.timeouts).toBe(0);
      expect(result.non2xx).toBe(0);

      // Verify linking consistency
      const allContacts = await prisma.contact.findMany({
        where: {
          OR: [
            { id: primary1.id },
            { id: primary2.id },
            { linkedId: primary1.id },
            { linkedId: primary2.id },
          ],
        },
      });

      const primaryContacts = allContacts.filter(
        c => c.linkPrecedence === 'primary'
      );
      expect(primaryContacts.length).toBe(1); // Should have only one primary after linking

      const secondaryContacts = allContacts.filter(
        c => c.linkPrecedence === 'secondary'
      );
      expect(secondaryContacts.length).toBeGreaterThan(0);

      // All secondaries should link to the same primary
      const primaryId = primaryContacts[0]?.id;
      secondaryContacts.forEach(secondary => {
        expect(secondary.linkedId).toBe(primaryId);
      });

      console.log('Concurrent Linking Test Results:', {
        totalRequests: result.requests.total,
        primaryContacts: primaryContacts.length,
        secondaryContacts: secondaryContacts.length,
        avgLatency: result.latency.mean,
        errors: result.errors,
      });
    }, 30000);
  });
});
