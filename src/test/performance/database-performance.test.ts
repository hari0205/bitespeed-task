/**
 * Database Performance Tests for Identity Reconciliation API
 * Tests database query performance, connection handling, and optimization
 * Requirements: 7.4, 6.4
 */

import { PrismaClient } from '@prisma/client';
import {
  DatabaseQueryMonitor,
  measureAsyncExecution,
} from './performance-monitor';
import request from 'supertest';
import testApp from './test-app';

describe('Database Performance Tests', () => {
  let prisma: PrismaClient;
  let queryMonitor: DatabaseQueryMonitor;

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env['DATABASE_URL'] || 'file:./test.db',
        },
      },
    });
    await prisma.$connect();
    queryMonitor = new DatabaseQueryMonitor();
  });

  beforeEach(async () => {
    await prisma.contact.deleteMany({});
    queryMonitor.reset();
  });

  afterAll(async () => {
    await prisma.contact.deleteMany({});
    await prisma.$disconnect();
  });

  describe('Query Performance Benchmarks', () => {
    it('should perform basic CRUD operations efficiently', async () => {
      // Test CREATE performance
      const createTimer = queryMonitor.startQuery('contact_create');
      const contact = await prisma.contact.create({
        data: {
          email: 'perf-test@example.com',
          phoneNumber: '+1234567890',
          linkPrecedence: 'primary',
        },
      });
      createTimer();

      // Test READ performance
      const readTimer = queryMonitor.startQuery('contact_read');
      const foundContact = await prisma.contact.findUnique({
        where: { id: contact.id },
      });
      readTimer();

      // Test UPDATE performance
      const updateTimer = queryMonitor.startQuery('contact_update');
      await prisma.contact.update({
        where: { id: contact.id },
        data: { linkPrecedence: 'secondary', linkedId: contact.id },
      });
      updateTimer();

      // Test DELETE performance
      const deleteTimer = queryMonitor.startQuery('contact_delete');
      await prisma.contact.delete({
        where: { id: contact.id },
      });
      deleteTimer();

      expect(foundContact).toBeTruthy();

      // Log query performance
      queryMonitor.logQueryStats();

      // Assert performance requirements
      const createStats = queryMonitor.getQueryStats('contact_create');
      const readStats = queryMonitor.getQueryStats('contact_read');
      const updateStats = queryMonitor.getQueryStats('contact_update');
      const deleteStats = queryMonitor.getQueryStats('contact_delete');

      expect(createStats?.average).toBeLessThan(50); // CREATE < 50ms
      expect(readStats?.average).toBeLessThan(20); // READ < 20ms
      expect(updateStats?.average).toBeLessThan(50); // UPDATE < 50ms
      expect(deleteStats?.average).toBeLessThan(30); // DELETE < 30ms
    });

    it('should handle bulk operations efficiently', async () => {
      const recordCount = 1000;

      // Test bulk INSERT performance
      const bulkData = Array.from({ length: recordCount }, (_, i) => ({
        email: `bulk-${i}@example.com`,
        phoneNumber: `+1800${i.toString().padStart(7, '0')}`,
        linkPrecedence: 'primary' as const,
      }));

      const { duration: insertDuration } = await measureAsyncExecution(
        () => prisma.contact.createMany({ data: bulkData }),
        'Bulk insert'
      );

      // Test bulk SELECT performance
      const { duration: selectDuration } = await measureAsyncExecution(
        () =>
          prisma.contact.findMany({
            where: {
              email: { startsWith: 'bulk-' },
            },
          }),
        'Bulk select'
      );

      // Test bulk UPDATE performance
      const { duration: updateDuration } = await measureAsyncExecution(
        () =>
          prisma.contact.updateMany({
            where: {
              email: { startsWith: 'bulk-' },
            },
            data: {
              updatedAt: new Date(),
            },
          }),
        'Bulk update'
      );

      // Test bulk DELETE performance
      const { duration: deleteDuration } = await measureAsyncExecution(
        () =>
          prisma.contact.deleteMany({
            where: {
              email: { startsWith: 'bulk-' },
            },
          }),
        'Bulk delete'
      );

      console.log('Bulk Operations Performance:', {
        recordCount,
        insertDuration: `${insertDuration.toFixed(2)}ms`,
        selectDuration: `${selectDuration.toFixed(2)}ms`,
        updateDuration: `${updateDuration.toFixed(2)}ms`,
        deleteDuration: `${deleteDuration.toFixed(2)}ms`,
        insertRate: `${((recordCount / insertDuration) * 1000).toFixed(0)} records/sec`,
        selectRate: `${((recordCount / selectDuration) * 1000).toFixed(0)} records/sec`,
      });

      // Performance assertions for bulk operations
      expect(insertDuration).toBeLessThan(5000); // Bulk insert < 5 seconds
      expect(selectDuration).toBeLessThan(1000); // Bulk select < 1 second
      expect(updateDuration).toBeLessThan(3000); // Bulk update < 3 seconds
      expect(deleteDuration).toBeLessThan(2000); // Bulk delete < 2 seconds
    }, 30000);

    it('should optimize queries with indexes', async () => {
      // Create test data with various patterns
      const testData = [
        ...Array.from({ length: 500 }, (_, i) => ({
          email: `indexed-test-${i}@example.com`,
          phoneNumber: `+1700${i.toString().padStart(7, '0')}`,
          linkPrecedence: 'primary' as const,
        })),
        ...Array.from({ length: 200 }, (_, i) => ({
          email: `indexed-secondary-${i}@example.com`,
          phoneNumber: `+1701${i.toString().padStart(7, '0')}`,
          linkPrecedence: 'secondary' as const,
          linkedId: 1, // Link to first contact
        })),
      ];

      await prisma.contact.createMany({ data: testData });

      // Test email index performance
      const { duration: emailQueryDuration } = await measureAsyncExecution(
        () =>
          prisma.contact.findMany({
            where: { email: 'indexed-test-250@example.com' },
          }),
        'Email index query'
      );

      // Test phone number index performance
      const { duration: phoneQueryDuration } = await measureAsyncExecution(
        () =>
          prisma.contact.findMany({
            where: { phoneNumber: '+17000000250' },
          }),
        'Phone number index query'
      );

      // Test linkedId index performance
      const { duration: linkedIdQueryDuration } = await measureAsyncExecution(
        () =>
          prisma.contact.findMany({
            where: { linkedId: 1 },
          }),
        'LinkedId index query'
      );

      // Test compound query performance
      const { duration: compoundQueryDuration } = await measureAsyncExecution(
        () =>
          prisma.contact.findMany({
            where: {
              OR: [
                { email: 'indexed-test-100@example.com' },
                { phoneNumber: '+17000000200' },
              ],
            },
          }),
        'Compound OR query'
      );

      console.log('Index Performance Results:', {
        emailQuery: `${emailQueryDuration.toFixed(2)}ms`,
        phoneQuery: `${phoneQueryDuration.toFixed(2)}ms`,
        linkedIdQuery: `${linkedIdQueryDuration.toFixed(2)}ms`,
        compoundQuery: `${compoundQueryDuration.toFixed(2)}ms`,
        totalRecords: testData.length,
      });

      // Indexed queries should be very fast even with large dataset
      expect(emailQueryDuration).toBeLessThan(50); // Email index < 50ms
      expect(phoneQueryDuration).toBeLessThan(50); // Phone index < 50ms
      expect(linkedIdQueryDuration).toBeLessThan(100); // LinkedId index < 100ms
      expect(compoundQueryDuration).toBeLessThan(100); // Compound query < 100ms
    }, 20000);
  });

  describe('Connection and Transaction Performance', () => {
    it('should handle concurrent database connections efficiently', async () => {
      const concurrentQueries = 20;
      const queriesPerConnection = 10;

      const connectionPromises = Array.from(
        { length: concurrentQueries },
        async (_, connectionIndex) => {
          const queries = [];

          for (
            let queryIndex = 0;
            queryIndex < queriesPerConnection;
            queryIndex++
          ) {
            const queryPromise = prisma.contact.create({
              data: {
                email: `concurrent-${connectionIndex}-${queryIndex}@example.com`,
                phoneNumber: `+1800${connectionIndex.toString().padStart(3, '0')}${queryIndex.toString().padStart(3, '0')}`,
                linkPrecedence: 'primary',
              },
            });
            queries.push(queryPromise);
          }

          return Promise.all(queries);
        }
      );

      const { duration: concurrentDuration } = await measureAsyncExecution(
        () => Promise.all(connectionPromises),
        'Concurrent database operations'
      );

      const totalQueries = concurrentQueries * queriesPerConnection;
      const queriesPerSecond = (totalQueries / concurrentDuration) * 1000;

      console.log('Concurrent Connection Performance:', {
        concurrentConnections: concurrentQueries,
        queriesPerConnection: queriesPerConnection,
        totalQueries,
        duration: `${concurrentDuration.toFixed(2)}ms`,
        queriesPerSecond: queriesPerSecond.toFixed(0),
      });

      // Should handle concurrent connections efficiently
      expect(concurrentDuration).toBeLessThan(10000); // < 10 seconds total
      expect(queriesPerSecond).toBeGreaterThan(50); // > 50 queries/sec

      // Verify all records were created
      const recordCount = await prisma.contact.count({
        where: {
          email: { startsWith: 'concurrent-' },
        },
      });
      expect(recordCount).toBe(totalQueries);
    }, 30000);

    it('should handle database transactions efficiently', async () => {
      const transactionCount = 10;
      const operationsPerTransaction = 5;

      const transactionPromises = Array.from(
        { length: transactionCount },
        async (_, txIndex) => {
          return prisma.$transaction(async tx => {
            const operations = [];

            for (
              let opIndex = 0;
              opIndex < operationsPerTransaction;
              opIndex++
            ) {
              const operation = tx.contact.create({
                data: {
                  email: `tx-${txIndex}-${opIndex}@example.com`,
                  phoneNumber: `+1900${txIndex.toString().padStart(3, '0')}${opIndex.toString().padStart(3, '0')}`,
                  linkPrecedence: 'primary',
                },
              });
              operations.push(operation);
            }

            return Promise.all(operations);
          });
        }
      );

      const { duration: transactionDuration } = await measureAsyncExecution(
        () => Promise.all(transactionPromises),
        'Database transactions'
      );

      const totalOperations = transactionCount * operationsPerTransaction;
      const operationsPerSecond =
        (totalOperations / transactionDuration) * 1000;

      console.log('Transaction Performance:', {
        transactionCount,
        operationsPerTransaction,
        totalOperations,
        duration: `${transactionDuration.toFixed(2)}ms`,
        operationsPerSecond: operationsPerSecond.toFixed(0),
        avgTransactionTime: `${(transactionDuration / transactionCount).toFixed(2)}ms`,
      });

      // Transaction performance should be reasonable
      expect(transactionDuration).toBeLessThan(15000); // < 15 seconds total
      expect(operationsPerSecond).toBeGreaterThan(20); // > 20 ops/sec

      // Verify all records were created (transaction integrity)
      const recordCount = await prisma.contact.count({
        where: {
          email: { startsWith: 'tx-' },
        },
      });
      expect(recordCount).toBe(totalOperations);
    }, 30000);
  });

  describe('API Endpoint Database Performance', () => {
    it('should maintain database performance under API load', async () => {
      // Pre-populate database with some data
      const initialData = Array.from({ length: 100 }, (_, i) => ({
        email: `api-perf-${i}@example.com`,
        phoneNumber: `+1500${i.toString().padStart(7, '0')}`,
        linkPrecedence: 'primary' as const,
      }));

      await prisma.contact.createMany({ data: initialData });

      // Test API performance with database queries
      const apiRequests: Promise<any>[] = [];
      const requestCount = 50;

      for (let i = 0; i < requestCount; i++) {
        let requestPromise;

        if (i % 3 === 0) {
          // New contact creation (INSERT)
          requestPromise = request(testApp)
            .post('/identify')
            .send({
              email: `api-new-${i}@example.com`,
              phoneNumber: `+1600${i.toString().padStart(7, '0')}`,
            })
            .expect(200);
        } else if (i % 3 === 1) {
          // Existing contact query (SELECT)
          requestPromise = request(testApp)
            .post('/identify')
            .send({
              email: `api-perf-${i % 100}@example.com`,
            })
            .expect(200);
        } else {
          // Contact linking (SELECT + UPDATE/INSERT)
          requestPromise = request(testApp)
            .post('/identify')
            .send({
              email: `api-perf-${i % 100}@example.com`,
              phoneNumber: `+1700${i.toString().padStart(7, '0')}`,
            })
            .expect(200);
        }

        apiRequests.push(requestPromise);
      }

      const { duration: apiDuration } = await measureAsyncExecution(
        () => Promise.all(apiRequests),
        'API requests with database operations'
      );

      const requestsPerSecond = (requestCount / apiDuration) * 1000;
      const avgResponseTime = apiDuration / requestCount;

      console.log('API Database Performance:', {
        totalRequests: requestCount,
        duration: `${apiDuration.toFixed(2)}ms`,
        requestsPerSecond: requestsPerSecond.toFixed(1),
        avgResponseTime: `${avgResponseTime.toFixed(2)}ms`,
        initialDataSize: initialData.length,
      });

      // API with database operations should maintain good performance
      expect(apiDuration).toBeLessThan(20000); // < 20 seconds total
      expect(requestsPerSecond).toBeGreaterThan(5); // > 5 req/sec
      expect(avgResponseTime).toBeLessThan(400); // < 400ms avg response
    }, 45000);

    it('should handle complex linking scenarios efficiently', async () => {
      // Create a complex scenario with multiple primary contacts
      const primaryContacts = Array.from({ length: 20 }, (_, i) => ({
        email: `complex-primary-${i}@example.com`,
        phoneNumber: `+1400${i.toString().padStart(7, '0')}`,
        linkPrecedence: 'primary' as const,
      }));

      await prisma.contact.createMany({ data: primaryContacts });

      // Create linking requests that will cause complex database operations
      const linkingRequests: Promise<any>[] = [];
      for (let i = 0; i < 10; i++) {
        // Each request links two primary contacts
        const requestPromise = request(testApp)
          .post('/identify')
          .send({
            email: `complex-primary-${i * 2}@example.com`,
            phoneNumber: `+1400${(i * 2 + 1).toString().padStart(7, '0')}`,
          })
          .expect(200);

        linkingRequests.push(requestPromise);
      }

      const { duration: linkingDuration } = await measureAsyncExecution(
        () => Promise.all(linkingRequests),
        'Complex linking operations'
      );

      const avgLinkingTime = linkingDuration / linkingRequests.length;

      console.log('Complex Linking Performance:', {
        initialPrimaries: primaryContacts.length,
        linkingOperations: linkingRequests.length,
        totalDuration: `${linkingDuration.toFixed(2)}ms`,
        avgLinkingTime: `${avgLinkingTime.toFixed(2)}ms`,
      });

      // Complex linking should still be reasonably fast
      expect(linkingDuration).toBeLessThan(10000); // < 10 seconds total
      expect(avgLinkingTime).toBeLessThan(1000); // < 1 second per linking

      // Verify linking worked correctly
      const finalPrimaryCount = await prisma.contact.count({
        where: { linkPrecedence: 'primary' },
      });
      const secondaryCount = await prisma.contact.count({
        where: { linkPrecedence: 'secondary' },
      });

      console.log('Linking Results:', {
        finalPrimaries: finalPrimaryCount,
        secondaries: secondaryCount,
        totalContacts: finalPrimaryCount + secondaryCount,
      });

      expect(finalPrimaryCount).toBeLessThan(primaryContacts.length);
      expect(secondaryCount).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Database Resource Monitoring', () => {
    it('should monitor database connection pool usage', async () => {
      // This test would ideally monitor actual connection pool metrics
      // For now, we'll test concurrent database operations and measure performance

      const concurrentOperations = 30;
      const operationsPerBatch = 5;

      const batches = Array.from(
        { length: concurrentOperations },
        async (_, batchIndex) => {
          const operations = [];

          for (let opIndex = 0; opIndex < operationsPerBatch; opIndex++) {
            const operation = prisma.contact.create({
              data: {
                email: `pool-test-${batchIndex}-${opIndex}@example.com`,
                phoneNumber: `+1300${batchIndex.toString().padStart(3, '0')}${opIndex.toString().padStart(3, '0')}`,
                linkPrecedence: 'primary',
              },
            });
            operations.push(operation);
          }

          return Promise.all(operations);
        }
      );

      const { duration: poolTestDuration } = await measureAsyncExecution(
        () => Promise.all(batches),
        'Connection pool stress test'
      );

      const totalOperations = concurrentOperations * operationsPerBatch;
      const operationsPerSecond = (totalOperations / poolTestDuration) * 1000;

      console.log('Connection Pool Performance:', {
        concurrentBatches: concurrentOperations,
        operationsPerBatch,
        totalOperations,
        duration: `${poolTestDuration.toFixed(2)}ms`,
        operationsPerSecond: operationsPerSecond.toFixed(0),
      });

      // Connection pool should handle concurrent operations efficiently
      expect(poolTestDuration).toBeLessThan(15000); // < 15 seconds
      expect(operationsPerSecond).toBeGreaterThan(30); // > 30 ops/sec

      // Verify all operations completed successfully
      const recordCount = await prisma.contact.count({
        where: {
          email: { startsWith: 'pool-test-' },
        },
      });
      expect(recordCount).toBe(totalOperations);
    }, 30000);
  });
});
