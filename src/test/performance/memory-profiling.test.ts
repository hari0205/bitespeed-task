/**
 * Memory Profiling Tests for Identity Reconciliation API
 * Tests memory usage patterns, garbage collection, and memory leaks
 * Requirements: 7.4, 6.4
 */

import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import testApp from './test-app';
import {
  PerformanceMonitor,
  measureAsyncExecution,
} from './performance-monitor';

describe('Memory Profiling Tests', () => {
  let prisma: PrismaClient;
  let performanceMonitor: PerformanceMonitor;

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env['DATABASE_URL'] || 'file:./test.db',
        },
      },
    });
    await prisma.$connect();
    performanceMonitor = new PerformanceMonitor();
  });

  beforeEach(async () => {
    await prisma.contact.deleteMany({});
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  });

  afterAll(async () => {
    await prisma.contact.deleteMany({});
    await prisma.$disconnect();
  });

  describe('Memory Usage Patterns', () => {
    it('should maintain stable memory usage during repeated requests', async () => {
      performanceMonitor.start();
      performanceMonitor.startContinuousMonitoring(500); // Monitor every 500ms

      const initialMemory = process.memoryUsage();
      console.log(
        'Initial Memory:',
        PerformanceMonitor.formatMemorySize(initialMemory.heapUsed)
      );

      // Perform many requests to test memory stability
      const requestCount = 100;
      const requests = [];

      for (let i = 0; i < requestCount; i++) {
        const requestPromise = request(testApp)
          .post('/identify')
          .send({
            email: `memory-test-${i}@example.com`,
            phoneNumber: `+1234${i.toString().padStart(6, '0')}`,
          })
          .expect(200);

        requests.push(requestPromise);

        // Add small delay every 10 requests to prevent overwhelming
        if (i % 10 === 0) {
          await Promise.all(requests.splice(0, 10));

          // Take memory snapshot
          const currentMemory = performanceMonitor.takeMemorySnapshot();
          if (i % 20 === 0) {
            PerformanceMonitor.logMemorySnapshot(
              currentMemory,
              `After ${i} requests`
            );
          }
        }
      }

      // Wait for remaining requests
      await Promise.all(requests);

      // Allow time for garbage collection
      await new Promise(resolve => setTimeout(resolve, 2000));
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const perfMetrics = performanceMonitor.stop();

      console.log(
        'Final Memory:',
        PerformanceMonitor.formatMemorySize(finalMemory.heapUsed)
      );
      console.log(
        'Memory Growth:',
        PerformanceMonitor.formatMemorySize(perfMetrics.memoryGrowth.heapUsed)
      );

      // Memory growth should be reasonable for 100 requests
      const memoryGrowthMB = perfMetrics.memoryGrowth.heapUsed / (1024 * 1024);
      expect(memoryGrowthMB).toBeLessThan(20); // Less than 20MB growth

      // Log memory statistics
      const memoryStats = performanceMonitor.getMemoryStats();
      console.log('Memory Statistics:', {
        peakUsage: PerformanceMonitor.formatMemorySize(
          memoryStats.peak.heapUsed
        ),
        averageUsage: PerformanceMonitor.formatMemorySize(
          memoryStats.average.heapUsed
        ),
        totalGrowth: PerformanceMonitor.formatMemorySize(memoryStats.growth),
      });
    }, 60000);

    it('should handle large contact datasets without excessive memory usage', async () => {
      performanceMonitor.start();

      // Create a large dataset
      const contactCount = 1000;
      const contacts = Array.from({ length: contactCount }, (_, i) => ({
        email: `large-dataset-${i}@example.com`,
        phoneNumber: `+1800${i.toString().padStart(7, '0')}`,
        linkPrecedence: 'primary' as const,
      }));

      const { duration: insertDuration } = await measureAsyncExecution(
        () => prisma.contact.createMany({ data: contacts }),
        'Database insertion'
      );

      console.log(
        `Inserted ${contactCount} contacts in ${insertDuration.toFixed(2)}ms`
      );

      // Test querying with large dataset
      const memoryBefore = process.memoryUsage();

      const { duration: queryDuration } = await measureAsyncExecution(
        async () => {
          const response = await request(testApp)
            .post('/identify')
            .send({
              email: 'large-dataset-500@example.com', // Query existing contact
            })
            .expect(200);

          expect(response.body.contact.primaryContactId).toBeDefined();
          return response;
        },
        'Query with large dataset'
      );

      const memoryAfter = process.memoryUsage();
      const memoryGrowth = memoryAfter.heapUsed - memoryBefore.heapUsed;

      console.log('Query Performance with Large Dataset:', {
        queryDuration: `${queryDuration.toFixed(2)}ms`,
        memoryGrowth: PerformanceMonitor.formatMemorySize(memoryGrowth),
        contactCount,
      });

      // Query should remain fast even with large dataset
      expect(queryDuration).toBeLessThan(100); // Less than 100ms

      // Memory growth for single query should be minimal
      const memoryGrowthMB = memoryGrowth / (1024 * 1024);
      expect(memoryGrowthMB).toBeLessThan(5); // Less than 5MB for single query

      performanceMonitor.stop();
    }, 45000);

    it('should handle contact linking operations efficiently', async () => {
      performanceMonitor.start();
      performanceMonitor.startContinuousMonitoring(1000);

      // Create initial primary contacts
      const primaryContacts = Array.from({ length: 50 }, (_, i) => ({
        email: `primary-${i}@example.com`,
        phoneNumber: `+1900${i.toString().padStart(7, '0')}`,
        linkPrecedence: 'primary' as const,
      }));

      await prisma.contact.createMany({ data: primaryContacts });

      const memoryBefore = process.memoryUsage();

      // Perform linking operations
      const linkingRequests = [];
      for (let i = 0; i < 25; i++) {
        // Link pairs of primary contacts
        const request1 = request(testApp)
          .post('/identify')
          .send({
            email: `primary-${i * 2}@example.com`,
            phoneNumber: `+1900${(i * 2 + 1).toString().padStart(7, '0')}`,
          })
          .expect(200);

        linkingRequests.push(request1);
      }

      await Promise.all(linkingRequests);

      const memoryAfter = process.memoryUsage();
      const perfMetrics = performanceMonitor.stop();

      const memoryGrowth = memoryAfter.heapUsed - memoryBefore.heapUsed;
      console.log('Contact Linking Memory Usage:', {
        initialContacts: primaryContacts.length,
        linkingOperations: 25,
        memoryGrowth: PerformanceMonitor.formatMemorySize(memoryGrowth),
        totalMemoryGrowth: PerformanceMonitor.formatMemorySize(
          perfMetrics.memoryGrowth.heapUsed
        ),
      });

      // Linking operations should not cause excessive memory growth
      const memoryGrowthMB = memoryGrowth / (1024 * 1024);
      expect(memoryGrowthMB).toBeLessThan(10); // Less than 10MB for linking operations

      // Verify linking worked correctly
      const primaryCount = await prisma.contact.count({
        where: { linkPrecedence: 'primary' },
      });
      const secondaryCount = await prisma.contact.count({
        where: { linkPrecedence: 'secondary' },
      });

      console.log('Linking Results:', {
        primaryContacts: primaryCount,
        secondaryContacts: secondaryCount,
        totalContacts: primaryCount + secondaryCount,
      });

      expect(primaryCount).toBeLessThan(primaryContacts.length); // Some primaries should be converted
      expect(secondaryCount).toBeGreaterThan(0); // Some secondaries should be created
    }, 45000);
  });

  describe('Memory Leak Detection', () => {
    it('should not leak memory during sustained operations', async () => {
      const iterations = 5;
      const requestsPerIteration = 50;
      const memorySnapshots: number[] = [];

      for (let iteration = 0; iteration < iterations; iteration++) {
        console.log(
          `Memory leak test iteration ${iteration + 1}/${iterations}`
        );

        // Perform batch of requests
        const requests = [];
        for (let i = 0; i < requestsPerIteration; i++) {
          const requestPromise = request(testApp)
            .post('/identify')
            .send({
              email: `leak-test-${iteration}-${i}@example.com`,
              phoneNumber: `+1700${iteration}${i.toString().padStart(3, '0')}`,
            })
            .expect(200);

          requests.push(requestPromise);
        }

        await Promise.all(requests);

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }

        // Wait for GC to complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        const memoryUsage = process.memoryUsage();
        memorySnapshots.push(memoryUsage.heapUsed);

        console.log(
          `  Memory after iteration ${iteration + 1}: ${PerformanceMonitor.formatMemorySize(memoryUsage.heapUsed)}`
        );

        // Clean up database to prevent accumulation
        await prisma.contact.deleteMany({
          where: {
            email: {
              startsWith: `leak-test-${iteration}-`,
            },
          },
        });
      }

      // Analyze memory growth pattern
      const initialMemory = memorySnapshots[0]!;
      const finalMemory = memorySnapshots[memorySnapshots.length - 1]!;
      const totalGrowth = finalMemory - initialMemory;
      const totalGrowthMB = totalGrowth / (1024 * 1024);

      console.log('Memory Leak Analysis:', {
        initialMemory: PerformanceMonitor.formatMemorySize(initialMemory),
        finalMemory: PerformanceMonitor.formatMemorySize(finalMemory),
        totalGrowth: PerformanceMonitor.formatMemorySize(totalGrowth),
        totalRequests: iterations * requestsPerIteration,
        growthPerRequest: PerformanceMonitor.formatMemorySize(
          totalGrowth / (iterations * requestsPerIteration)
        ),
      });

      // Memory growth should be minimal across iterations
      expect(totalGrowthMB).toBeLessThan(15); // Less than 15MB total growth

      // Check for consistent growth pattern (potential leak indicator)
      const growthRates = [];
      for (let i = 1; i < memorySnapshots.length; i++) {
        const growth = memorySnapshots[i]! - memorySnapshots[i - 1]!;
        growthRates.push(growth);
      }

      const avgGrowthRate =
        growthRates.reduce((sum, rate) => sum + rate, 0) / growthRates.length;
      const maxGrowthRate = Math.max(...growthRates);

      console.log('Growth Rate Analysis:', {
        averageGrowthPerIteration:
          PerformanceMonitor.formatMemorySize(avgGrowthRate),
        maxGrowthPerIteration:
          PerformanceMonitor.formatMemorySize(maxGrowthRate),
      });

      // No single iteration should cause excessive growth
      const maxGrowthMB = maxGrowthRate / (1024 * 1024);
      expect(maxGrowthMB).toBeLessThan(5); // Less than 5MB per iteration
    }, 120000);
  });

  describe('Garbage Collection Behavior', () => {
    it('should respond well to garbage collection', async () => {
      if (!global.gc) {
        console.log('Skipping GC test - garbage collection not exposed');
        return;
      }

      // Perform operations that create garbage
      const requests = [];
      for (let i = 0; i < 100; i++) {
        const requestPromise = request(testApp)
          .post('/identify')
          .send({
            email: `gc-test-${i}@example.com`,
            phoneNumber: `+1600${i.toString().padStart(6, '0')}`,
          })
          .expect(200);

        requests.push(requestPromise);
      }

      await Promise.all(requests);

      const memoryBeforeGC = process.memoryUsage();
      console.log(
        'Memory before GC:',
        PerformanceMonitor.formatMemorySize(memoryBeforeGC.heapUsed)
      );

      // Force garbage collection
      global.gc();

      // Wait for GC to complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      const memoryAfterGC = process.memoryUsage();
      console.log(
        'Memory after GC:',
        PerformanceMonitor.formatMemorySize(memoryAfterGC.heapUsed)
      );

      const memoryReclaimed = memoryBeforeGC.heapUsed - memoryAfterGC.heapUsed;
      const reclaimedMB = memoryReclaimed / (1024 * 1024);

      console.log('Garbage Collection Results:', {
        memoryReclaimed: PerformanceMonitor.formatMemorySize(memoryReclaimed),
        reclaimedMB: reclaimedMB.toFixed(2),
        reclaimedPercentage:
          ((memoryReclaimed / memoryBeforeGC.heapUsed) * 100).toFixed(1) + '%',
      });

      // GC should reclaim some memory (at least 1MB)
      expect(reclaimedMB).toBeGreaterThan(1);

      // Memory after GC should be less than before
      expect(memoryAfterGC.heapUsed).toBeLessThan(memoryBeforeGC.heapUsed);
    }, 30000);
  });
});
