# Performance Testing Suite

This directory contains comprehensive performance and load testing for the Identity Reconciliation API. The tests validate response times, throughput, memory usage, and database performance under various load conditions.

## Test Structure

### Core Test Files

- **`load-testing.test.ts`** - High-level load testing using autocannon for realistic performance benchmarks
- **`memory-profiling.test.ts`** - Memory usage patterns, leak detection, and garbage collection behavior
- **`database-performance.test.ts`** - Database query performance, connection handling, and optimization validation
- **`simple-performance.test.ts`** - Basic performance validation for CI/CD pipelines

### Supporting Files

- **`performance-monitor.ts`** - Utilities for monitoring memory, database queries, and response times
- **`benchmark.ts`** - Standalone benchmark script for comprehensive performance analysis
- **`test-app.ts`** - Test application configuration without rate limiting

## Running Performance Tests

### Quick Performance Check

```bash
yarn test src/test/performance/simple-performance.test.ts
```

### Full Performance Suite

```bash
yarn test:performance
```

### Individual Test Categories

```bash
# Load testing with autocannon
yarn test src/test/performance/load-testing.test.ts

# Memory profiling
yarn test src/test/performance/memory-profiling.test.ts

# Database performance
yarn test src/test/performance/database-performance.test.ts
```

### Standalone Benchmark

```bash
# Full benchmark suite
yarn benchmark

# Quick benchmark (reduced duration)
yarn benchmark:quick
```

## Performance Requirements

### Response Time Targets

- **Average Response Time**: < 100ms for /identify endpoint
- **95th Percentile**: < 200ms under normal load
- **99th Percentile**: < 500ms under normal load
- **Health Endpoint**: < 50ms average

### Throughput Targets

- **Minimum Throughput**: > 50 requests/second
- **Target Throughput**: > 100 requests/second
- **Concurrent Users**: Support 50+ concurrent connections

### Memory Usage Limits

- **Memory Growth**: < 20MB for 100 requests
- **Sustained Load**: < 50MB growth over 30 seconds
- **Memory Leaks**: < 15MB total growth across test iterations

### Database Performance

- **Query Response Time**: < 50ms for indexed queries
- **Bulk Operations**: < 5 seconds for 1000 records
- **Connection Handling**: Support 30+ concurrent database operations

## Test Scenarios

### Load Testing Scenarios

1. **Baseline Load** - New contact creation with 10 connections
2. **Moderate Load** - Mixed operations with 25 connections
3. **High Load** - Varied data patterns with 50 connections
4. **Contact Linking** - Complex linking operations under load
5. **Race Conditions** - Concurrent requests with identical data

### Memory Profiling Scenarios

1. **Repeated Requests** - 100 sequential requests to test memory stability
2. **Large Datasets** - Performance with 1000+ database records
3. **Contact Linking** - Memory usage during complex linking operations
4. **Memory Leak Detection** - Sustained operations across multiple iterations
5. **Garbage Collection** - Memory reclamation behavior

### Database Performance Scenarios

1. **CRUD Operations** - Basic create, read, update, delete performance
2. **Bulk Operations** - Large dataset insertion and querying
3. **Index Optimization** - Query performance with database indexes
4. **Concurrent Connections** - Multiple simultaneous database operations
5. **Transaction Performance** - Database transaction handling

## Performance Monitoring

### Built-in Monitoring Tools

The test suite includes several monitoring utilities:

- **PerformanceMonitor** - Memory usage tracking and analysis
- **DatabaseQueryMonitor** - Database query performance metrics
- **ResponseTimeMonitor** - API endpoint response time tracking

### Example Usage

```typescript
import {
  PerformanceMonitor,
  measureAsyncExecution,
} from './performance-monitor';

const monitor = new PerformanceMonitor();
monitor.start();
monitor.startContinuousMonitoring(1000); // Monitor every second

// Perform operations...

const metrics = monitor.stop();
console.log('Memory growth:', metrics.memoryGrowth.heapUsed);
```

## Interpreting Results

### Good Performance Indicators

- ✅ Response times consistently under targets
- ✅ Stable memory usage patterns
- ✅ No memory leaks detected
- ✅ Database queries complete quickly
- ✅ High throughput maintained under load

### Performance Issues to Watch

- ⚠️ Increasing response times under load
- ⚠️ Memory growth exceeding limits
- ⚠️ Database query timeouts
- ⚠️ Error rates above 1%
- ⚠️ Throughput degradation

### Critical Issues

- ❌ Memory leaks detected
- ❌ Response times > 1 second
- ❌ Database connection failures
- ❌ System crashes under load
- ❌ Data corruption during concurrent operations

## Troubleshooting

### Common Issues

**Rate Limiting in Tests**

- Performance tests use `test-app.ts` which disables rate limiting
- Ensure tests import from `./test-app` not `../../index`

**Memory Test Failures**

- Memory limits may need adjustment based on system resources
- Consider running tests with `--expose-gc` flag for garbage collection tests

**Database Connection Issues**

- Ensure test database is properly configured
- Check connection pool settings for concurrent tests

**Timeout Issues**

- Increase test timeouts for long-running performance tests
- Use `--testTimeout=60000` for extended test duration

### Environment Variables

```bash
# Test database configuration
DATABASE_URL=file:./test.db

# Enable garbage collection for memory tests
NODE_OPTIONS="--expose-gc"

# Reduce benchmark duration for quick tests
BENCHMARK_QUICK=true
```

## Continuous Integration

### CI Performance Checks

For CI/CD pipelines, use the simple performance test:

```yaml
- name: Performance Tests
  run: yarn test src/test/performance/simple-performance.test.ts --testTimeout=30000
```

### Performance Regression Detection

Monitor key metrics across builds:

- Average response time trends
- Memory usage patterns
- Database query performance
- Error rates under load

## Performance Optimization Tips

### Application Level

- Implement database connection pooling
- Add response caching for frequent queries
- Optimize database indexes
- Use async/await properly
- Minimize memory allocations in hot paths

### Database Level

- Ensure proper indexing on email, phoneNumber, and linkedId
- Use database query optimization
- Consider read replicas for high load
- Monitor connection pool usage

### Infrastructure Level

- Scale horizontally with load balancers
- Use CDN for static assets
- Implement proper monitoring and alerting
- Consider database sharding for very high loads

## Contributing

When adding new performance tests:

1. Follow existing naming conventions
2. Include proper cleanup in `afterEach`/`afterAll`
3. Set appropriate timeouts
4. Document expected performance characteristics
5. Add meaningful assertions with clear failure messages
6. Consider both positive and negative test cases
