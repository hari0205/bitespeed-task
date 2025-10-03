/**
 * Performance Monitoring Utilities
 * Provides tools for monitoring memory usage, database query performance, and system resources
 */

import { performance } from 'perf_hooks';

export interface MemorySnapshot {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  arrayBuffers: number;
}

export interface PerformanceMetrics {
  duration: number;
  memoryBefore: MemorySnapshot;
  memoryAfter: MemorySnapshot;
  memoryGrowth: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
  };
}

export class PerformanceMonitor {
  private startTime: number = 0;
  private memorySnapshots: MemorySnapshot[] = [];
  private intervalId: NodeJS.Timeout | null = null;

  /**
   * Start monitoring performance metrics
   */
  start(): void {
    this.startTime = performance.now();
    this.memorySnapshots = [];
    this.takeMemorySnapshot();
  }

  /**
   * Stop monitoring and return performance metrics
   */
  stop(): PerformanceMetrics {
    const endTime = performance.now();
    const finalSnapshot = this.takeMemorySnapshot();

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    const memoryBefore = this.memorySnapshots[0];
    const memoryAfter = finalSnapshot;

    if (!memoryBefore) {
      throw new Error('No initial memory snapshot available');
    }

    return {
      duration: endTime - this.startTime,
      memoryBefore,
      memoryAfter,
      memoryGrowth: {
        heapUsed: memoryAfter.heapUsed - memoryBefore.heapUsed,
        heapTotal: memoryAfter.heapTotal - memoryBefore.heapTotal,
        rss: memoryAfter.rss - memoryBefore.rss,
      },
    };
  }

  /**
   * Start continuous memory monitoring at specified interval
   */
  startContinuousMonitoring(intervalMs: number = 1000): void {
    this.intervalId = setInterval(() => {
      this.takeMemorySnapshot();
    }, intervalMs);
  }

  /**
   * Take a memory snapshot
   */
  takeMemorySnapshot(): MemorySnapshot {
    const memUsage = process.memoryUsage();
    const snapshot: MemorySnapshot = {
      timestamp: Date.now(),
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      arrayBuffers: memUsage.arrayBuffers,
    };

    this.memorySnapshots.push(snapshot);
    return snapshot;
  }

  /**
   * Get all memory snapshots
   */
  getMemorySnapshots(): MemorySnapshot[] {
    return [...this.memorySnapshots];
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats(): {
    peak: MemorySnapshot;
    average: Omit<MemorySnapshot, 'timestamp'>;
    growth: number;
  } {
    if (this.memorySnapshots.length === 0) {
      throw new Error('No memory snapshots available');
    }

    const peak = this.memorySnapshots.reduce((max, current) =>
      current.heapUsed > max.heapUsed ? current : max
    );

    const totals = this.memorySnapshots.reduce(
      (acc, snapshot) => ({
        heapUsed: acc.heapUsed + snapshot.heapUsed,
        heapTotal: acc.heapTotal + snapshot.heapTotal,
        external: acc.external + snapshot.external,
        rss: acc.rss + snapshot.rss,
        arrayBuffers: acc.arrayBuffers + snapshot.arrayBuffers,
      }),
      { heapUsed: 0, heapTotal: 0, external: 0, rss: 0, arrayBuffers: 0 }
    );

    const count = this.memorySnapshots.length;
    const average = {
      heapUsed: totals.heapUsed / count,
      heapTotal: totals.heapTotal / count,
      external: totals.external / count,
      rss: totals.rss / count,
      arrayBuffers: totals.arrayBuffers / count,
    };

    const first = this.memorySnapshots[0];
    const last = this.memorySnapshots[this.memorySnapshots.length - 1];
    const growth = first && last ? last.heapUsed - first.heapUsed : 0;

    return { peak, average, growth };
  }

  /**
   * Format memory size in human-readable format
   */
  static formatMemorySize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * Log memory snapshot in human-readable format
   */
  static logMemorySnapshot(snapshot: MemorySnapshot, label?: string): void {
    const prefix = label ? `[${label}] ` : '';
    console.log(`${prefix}Memory Usage:`, {
      timestamp: new Date(snapshot.timestamp).toISOString(),
      heapUsed: PerformanceMonitor.formatMemorySize(snapshot.heapUsed),
      heapTotal: PerformanceMonitor.formatMemorySize(snapshot.heapTotal),
      external: PerformanceMonitor.formatMemorySize(snapshot.external),
      rss: PerformanceMonitor.formatMemorySize(snapshot.rss),
      arrayBuffers: PerformanceMonitor.formatMemorySize(snapshot.arrayBuffers),
    });
  }
}

/**
 * Database Query Performance Monitor
 */
export class DatabaseQueryMonitor {
  private queryTimes: Map<string, number[]> = new Map();

  /**
   * Start timing a database query
   */
  startQuery(queryId: string): () => void {
    const startTime = performance.now();

    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;

      if (!this.queryTimes.has(queryId)) {
        this.queryTimes.set(queryId, []);
      }

      this.queryTimes.get(queryId)!.push(duration);
    };
  }

  /**
   * Get query performance statistics
   */
  getQueryStats(queryId: string): {
    count: number;
    average: number;
    min: number;
    max: number;
    p95: number;
    p99: number;
  } | null {
    const times = this.queryTimes.get(queryId);
    if (!times || times.length === 0) {
      return null;
    }

    const sorted = [...times].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);

    return {
      count,
      average: sum / count,
      min: sorted[0]!,
      max: sorted[count - 1]!,
      p95: sorted[Math.floor(count * 0.95)]!,
      p99: sorted[Math.floor(count * 0.99)]!,
    };
  }

  /**
   * Get all query statistics
   */
  getAllQueryStats(): Record<
    string,
    ReturnType<DatabaseQueryMonitor['getQueryStats']>
  > {
    const stats: Record<
      string,
      ReturnType<DatabaseQueryMonitor['getQueryStats']>
    > = {};

    for (const queryId of this.queryTimes.keys()) {
      stats[queryId] = this.getQueryStats(queryId);
    }

    return stats;
  }

  /**
   * Reset all query statistics
   */
  reset(): void {
    this.queryTimes.clear();
  }

  /**
   * Log query statistics
   */
  logQueryStats(queryId?: string): void {
    if (queryId) {
      const stats = this.getQueryStats(queryId);
      if (stats) {
        console.log(`Query Stats [${queryId}]:`, {
          count: stats.count,
          average: `${stats.average.toFixed(2)}ms`,
          min: `${stats.min.toFixed(2)}ms`,
          max: `${stats.max.toFixed(2)}ms`,
          p95: `${stats.p95.toFixed(2)}ms`,
          p99: `${stats.p99.toFixed(2)}ms`,
        });
      }
    } else {
      const allStats = this.getAllQueryStats();
      console.log('All Query Statistics:');
      for (const [id, stats] of Object.entries(allStats)) {
        if (stats) {
          console.log(`  ${id}:`, {
            count: stats.count,
            average: `${stats.average.toFixed(2)}ms`,
            min: `${stats.min.toFixed(2)}ms`,
            max: `${stats.max.toFixed(2)}ms`,
            p95: `${stats.p95.toFixed(2)}ms`,
            p99: `${stats.p99.toFixed(2)}ms`,
          });
        }
      }
    }
  }
}

/**
 * Response Time Monitor for API endpoints
 */
export class ResponseTimeMonitor {
  private responseTimes: Map<string, number[]> = new Map();

  /**
   * Record response time for an endpoint
   */
  recordResponseTime(endpoint: string, responseTime: number): void {
    if (!this.responseTimes.has(endpoint)) {
      this.responseTimes.set(endpoint, []);
    }

    this.responseTimes.get(endpoint)!.push(responseTime);
  }

  /**
   * Get response time statistics for an endpoint
   */
  getResponseTimeStats(endpoint: string): {
    count: number;
    average: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
  } | null {
    const times = this.responseTimes.get(endpoint);
    if (!times || times.length === 0) {
      return null;
    }

    const sorted = [...times].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);

    return {
      count,
      average: sum / count,
      min: sorted[0]!,
      max: sorted[count - 1]!,
      p50: sorted[Math.floor(count * 0.5)]!,
      p95: sorted[Math.floor(count * 0.95)]!,
      p99: sorted[Math.floor(count * 0.99)]!,
    };
  }

  /**
   * Reset all response time data
   */
  reset(): void {
    this.responseTimes.clear();
  }

  /**
   * Log response time statistics
   */
  logResponseTimeStats(endpoint?: string): void {
    if (endpoint) {
      const stats = this.getResponseTimeStats(endpoint);
      if (stats) {
        console.log(`Response Time Stats [${endpoint}]:`, {
          count: stats.count,
          average: `${stats.average.toFixed(2)}ms`,
          min: `${stats.min.toFixed(2)}ms`,
          max: `${stats.max.toFixed(2)}ms`,
          p50: `${stats.p50.toFixed(2)}ms`,
          p95: `${stats.p95.toFixed(2)}ms`,
          p99: `${stats.p99.toFixed(2)}ms`,
        });
      }
    } else {
      console.log('All Response Time Statistics:');
      for (const endpoint of this.responseTimes.keys()) {
        const stats = this.getResponseTimeStats(endpoint);
        if (stats) {
          console.log(`  ${endpoint}:`, {
            count: stats.count,
            average: `${stats.average.toFixed(2)}ms`,
            min: `${stats.min.toFixed(2)}ms`,
            max: `${stats.max.toFixed(2)}ms`,
            p50: `${stats.p50.toFixed(2)}ms`,
            p95: `${stats.p95.toFixed(2)}ms`,
            p99: `${stats.p99.toFixed(2)}ms`,
          });
        }
      }
    }
  }
}

/**
 * Utility function to measure async function execution time
 */
export async function measureAsyncExecution<T>(
  fn: () => Promise<T>,
  label?: string
): Promise<{ result: T; duration: number }> {
  const startTime = performance.now();
  const result = await fn();
  const endTime = performance.now();
  const duration = endTime - startTime;

  if (label) {
    console.log(`${label} completed in ${duration.toFixed(2)}ms`);
  }

  return { result, duration };
}

/**
 * Utility function to measure sync function execution time
 */
export function measureExecution<T>(
  fn: () => T,
  label?: string
): { result: T; duration: number } {
  const startTime = performance.now();
  const result = fn();
  const endTime = performance.now();
  const duration = endTime - startTime;

  if (label) {
    console.log(`${label} completed in ${duration.toFixed(2)}ms`);
  }

  return { result, duration };
}
