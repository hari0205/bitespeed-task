/**
 * Standalone Performance Benchmark Script
 * Can be run independently to benchmark the Identity Reconciliation API
 * Usage: yarn ts-node src/test/performance/benchmark.ts
 */

import autocannon from 'autocannon';
import { PrismaClient } from '@prisma/client';
import app from '../../index';
import { Server } from 'http';
import { PerformanceMonitor } from './performance-monitor';

interface BenchmarkConfig {
  baseUrl: string;
  port: number;
  warmupDuration: number;
  testDuration: number;
  connections: number[];
  scenarios: BenchmarkScenario[];
}

interface BenchmarkScenario {
  name: string;
  method: 'GET' | 'POST';
  path: string;
  body?: any;
  headers?: Record<string, string>;
  setupData?: () => Promise<void>;
  cleanupData?: () => Promise<void>;
}

interface BenchmarkResult {
  scenario: string;
  connections: number;
  duration: number;
  requests: {
    total: number;
    mean: number;
    stddev: number;
  };
  latency: {
    mean: number;
    stddev: number;
    p50: number;
    p95: number;
    p99: number;
    max: number;
  };
  throughput: {
    mean: number;
    stddev: number;
  };
  errors: number;
  timeouts: number;
  non2xx: number;
}

class PerformanceBenchmark {
  private server: Server | null = null;
  private prisma: PrismaClient;
  private config: BenchmarkConfig;
  private performanceMonitor: PerformanceMonitor;

  constructor(config: BenchmarkConfig) {
    this.config = config;
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env['DATABASE_URL'] || 'file:./test.db',
        },
      },
    });
    this.performanceMonitor = new PerformanceMonitor();
  }

  async initialize(): Promise<void> {
    console.log('🚀 Initializing Performance Benchmark...');

    // Connect to database
    await this.prisma.$connect();
    console.log('✅ Database connected');

    // Start server
    this.server = app.listen(this.config.port);
    console.log(`✅ Server started on port ${this.config.port}`);

    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('✅ Server ready for benchmarking');
  }

  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up...');

    if (this.server) {
      this.server.close();
      console.log('✅ Server closed');
    }

    await this.prisma.$disconnect();
    console.log('✅ Database disconnected');
  }

  async warmup(): Promise<void> {
    console.log(`🔥 Warming up for ${this.config.warmupDuration}s...`);

    await autocannon({
      url: `${this.config.baseUrl}/health`,
      method: 'GET',
      connections: 10,
      duration: this.config.warmupDuration,
    });

    console.log('✅ Warmup completed');
  }

  async runBenchmark(): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = [];

    for (const scenario of this.config.scenarios) {
      console.log(`\n📊 Running scenario: ${scenario.name}`);

      // Setup scenario data if needed
      if (scenario.setupData) {
        console.log('  🔧 Setting up scenario data...');
        await scenario.setupData();
      }

      for (const connections of this.config.connections) {
        console.log(`  🔗 Testing with ${connections} connections...`);

        // Start performance monitoring
        this.performanceMonitor.start();
        this.performanceMonitor.startContinuousMonitoring(1000);

        const result = await autocannon({
          url: `${this.config.baseUrl}${scenario.path}`,
          method: scenario.method,
          headers: scenario.headers || {},
          body: scenario.body ? JSON.stringify(scenario.body) : undefined,
          connections,
          duration: this.config.testDuration,
          pipelining: 1,
        });

        // Stop performance monitoring
        const perfMetrics = this.performanceMonitor.stop();

        const benchmarkResult: BenchmarkResult = {
          scenario: scenario.name,
          connections,
          duration: this.config.testDuration,
          requests: {
            total: result.requests.total,
            mean: result.requests.mean,
            stddev: result.requests.stddev,
          },
          latency: {
            mean: result.latency.mean,
            stddev: result.latency.stddev,
            p50: result.latency.p50,
            p95: (result.latency as any).p95 || 0,
            p99: (result.latency as any).p99 || 0,
            max: result.latency.max,
          },
          throughput: {
            mean: result.throughput.mean,
            stddev: result.throughput.stddev,
          },
          errors: result.errors,
          timeouts: result.timeouts,
          non2xx: result.non2xx,
        };

        results.push(benchmarkResult);

        // Log immediate results
        this.logBenchmarkResult(benchmarkResult, perfMetrics);
      }

      // Cleanup scenario data if needed
      if (scenario.cleanupData) {
        console.log('  🧹 Cleaning up scenario data...');
        await scenario.cleanupData();
      }
    }

    return results;
  }

  private logBenchmarkResult(result: BenchmarkResult, perfMetrics: any): void {
    console.log(`    📈 Results for ${result.connections} connections:`);
    console.log(
      `      Requests: ${result.requests.total} total, ${result.requests.mean.toFixed(1)}/sec avg`
    );
    console.log(
      `      Latency: ${result.latency.mean.toFixed(1)}ms avg, ${result.latency.p95.toFixed(1)}ms p95, ${result.latency.p99.toFixed(1)}ms p99`
    );
    console.log(
      `      Throughput: ${(result.throughput.mean / 1024 / 1024).toFixed(2)} MB/sec`
    );
    console.log(
      `      Errors: ${result.errors}, Timeouts: ${result.timeouts}, Non-2xx: ${result.non2xx}`
    );
    console.log(
      `      Memory Growth: ${PerformanceMonitor.formatMemorySize(perfMetrics.memoryGrowth.heapUsed)}`
    );
  }

  generateReport(results: BenchmarkResult[]): void {
    console.log('\n📋 PERFORMANCE BENCHMARK REPORT');
    console.log('================================');

    // Group results by scenario
    const scenarioGroups = results.reduce(
      (groups, result) => {
        if (!groups[result.scenario]) {
          groups[result.scenario] = [];
        }
        groups[result.scenario]!.push(result);
        return groups;
      },
      {} as Record<string, BenchmarkResult[]>
    );

    for (const [scenarioName, scenarioResults] of Object.entries(
      scenarioGroups
    )) {
      console.log(`\n🎯 ${scenarioName}`);
      console.log('-'.repeat(50));

      // Create table header
      console.log(
        'Connections | Req/sec | Avg Latency | P95 Latency | P99 Latency | Errors'
      );
      console.log(
        '------------|---------|-------------|-------------|-------------|-------'
      );

      for (const result of scenarioResults) {
        const reqPerSec = result.requests.mean.toFixed(1).padStart(7);
        const avgLatency = `${result.latency.mean.toFixed(1)}ms`.padStart(9);
        const p95Latency = `${result.latency.p95.toFixed(1)}ms`.padStart(9);
        const p99Latency = `${result.latency.p99.toFixed(1)}ms`.padStart(9);
        const errors = result.errors.toString().padStart(6);

        console.log(
          `${result.connections.toString().padStart(11)} | ${reqPerSec} | ${avgLatency} | ${p95Latency} | ${p99Latency} | ${errors}`
        );
      }

      // Calculate performance summary
      const bestThroughput = Math.max(
        ...scenarioResults.map(r => r.requests.mean)
      );
      const bestLatency = Math.min(...scenarioResults.map(r => r.latency.mean));
      const totalErrors = scenarioResults.reduce((sum, r) => sum + r.errors, 0);

      console.log(`\n📊 Summary:`);
      console.log(`   Best Throughput: ${bestThroughput.toFixed(1)} req/sec`);
      console.log(`   Best Avg Latency: ${bestLatency.toFixed(1)}ms`);
      console.log(`   Total Errors: ${totalErrors}`);
    }

    // Performance recommendations
    console.log('\n💡 PERFORMANCE RECOMMENDATIONS');
    console.log('==============================');

    const allResults = Object.values(scenarioGroups).flat();
    const avgLatency =
      allResults.reduce((sum, r) => sum + r.latency.mean, 0) /
      allResults.length;
    const avgThroughput =
      allResults.reduce((sum, r) => sum + r.requests.mean, 0) /
      allResults.length;
    const totalErrors = allResults.reduce((sum, r) => sum + r.errors, 0);

    if (avgLatency > 100) {
      console.log('⚠️  High average latency detected. Consider:');
      console.log('   - Database query optimization');
      console.log('   - Connection pooling tuning');
      console.log('   - Caching implementation');
    }

    if (avgThroughput < 50) {
      console.log('⚠️  Low throughput detected. Consider:');
      console.log('   - Increasing server resources');
      console.log('   - Optimizing business logic');
      console.log('   - Implementing async processing');
    }

    if (totalErrors > 0) {
      console.log('❌ Errors detected during testing. Review:');
      console.log('   - Error logs for root causes');
      console.log('   - Database connection stability');
      console.log('   - Resource limits and timeouts');
    }

    if (avgLatency <= 100 && avgThroughput >= 50 && totalErrors === 0) {
      console.log('✅ Performance looks good! System is meeting targets.');
    }
  }
}

// Define benchmark scenarios
const scenarios: BenchmarkScenario[] = [
  {
    name: 'Health Check',
    method: 'GET',
    path: '/health',
  },
  {
    name: 'New Contact Creation',
    method: 'POST',
    path: '/identify',
    headers: { 'Content-Type': 'application/json' },
    body: {
      email: 'benchmark@example.com',
      phoneNumber: '+1234567890',
    },
  },
  {
    name: 'Existing Contact Query',
    method: 'POST',
    path: '/identify',
    headers: { 'Content-Type': 'application/json' },
    body: {
      email: 'existing@example.com',
    },
    setupData: async () => {
      const prisma = new PrismaClient();
      await prisma.contact.create({
        data: {
          email: 'existing@example.com',
          phoneNumber: '+1111111111',
          linkPrecedence: 'primary',
        },
      });
      await prisma.$disconnect();
    },
    cleanupData: async () => {
      const prisma = new PrismaClient();
      await prisma.contact.deleteMany({
        where: { email: 'existing@example.com' },
      });
      await prisma.$disconnect();
    },
  },
  {
    name: 'Contact Linking',
    method: 'POST',
    path: '/identify',
    headers: { 'Content-Type': 'application/json' },
    body: {
      email: 'primary1@example.com',
      phoneNumber: '+2222222222',
    },
    setupData: async () => {
      const prisma = new PrismaClient();
      await prisma.contact.createMany({
        data: [
          {
            email: 'primary1@example.com',
            phoneNumber: '+1111111111',
            linkPrecedence: 'primary',
          },
          {
            email: 'primary2@example.com',
            phoneNumber: '+2222222222',
            linkPrecedence: 'primary',
          },
        ],
      });
      await prisma.$disconnect();
    },
    cleanupData: async () => {
      const prisma = new PrismaClient();
      await prisma.contact.deleteMany({
        where: {
          OR: [
            { email: 'primary1@example.com' },
            { email: 'primary2@example.com' },
          ],
        },
      });
      await prisma.$disconnect();
    },
  },
];

// Benchmark configuration
const config: BenchmarkConfig = {
  baseUrl: 'http://localhost:3002',
  port: 3002,
  warmupDuration: 5, // 5 seconds warmup
  testDuration: 15, // 15 seconds per test
  connections: [1, 5, 10, 25, 50], // Different connection levels
  scenarios,
};

// Main benchmark execution
async function main(): Promise<void> {
  const benchmark = new PerformanceBenchmark(config);

  try {
    await benchmark.initialize();
    await benchmark.warmup();

    console.log('\n🏁 Starting Performance Benchmark...');
    const results = await benchmark.runBenchmark();

    benchmark.generateReport(results);
  } catch (error) {
    console.error('❌ Benchmark failed:', error);
    process.exit(1);
  } finally {
    await benchmark.cleanup();
  }
}

// Run benchmark if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

export {
  PerformanceBenchmark,
  BenchmarkConfig,
  BenchmarkScenario,
  BenchmarkResult,
};
