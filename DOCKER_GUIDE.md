# Docker Deployment Guide

## Overview

The Identity Reconciliation API is fully containerized with Docker support, including Redis caching, load balancing with Nginx, and comprehensive monitoring. This guide covers both development and production deployments.

## 🚀 Quick Start

### Development with Docker

```bash
# Clone the repository
git clone <repository-url>
cd identity-reconciliation

# Start development environment
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f api-dev

# Stop development environment
docker-compose -f docker-compose.dev.yml down
```

### Production with Docker

```bash
# Build and start production environment
docker-compose up -d

# View logs
docker-compose logs -f api

# Stop production environment
docker-compose down
```

## 📦 Container Architecture

### Services Overview

1. **API Container** (`identity-api`)
   - Node.js application with TypeScript
   - Multi-stage build for optimized size
   - Health checks and graceful shutdown
   - Redis integration with fallback to memory cache

2. **Redis Container** (`identity-redis`)
   - Redis 7 Alpine for caching
   - Persistent data storage
   - Memory optimization and LRU eviction
   - Health monitoring

3. **Redis Commander** (`identity-redis-ui`)
   - Web UI for Redis management
   - Available at http://localhost:8081
   - Username: admin, Password: admin123

4. **Nginx Load Balancer** (`identity-nginx`)
   - Reverse proxy and load balancer
   - Rate limiting and security headers
   - SSL/TLS termination ready
   - Multiple API instance support

## 🛠️ Configuration

### Environment Variables

#### Core Application Settings

```env
NODE_ENV=production          # Environment mode
PORT=3000                   # Application port
LOG_LEVEL=info              # Logging level
DATABASE_URL=file:./data/prod.db  # Database connection
```

#### Redis Configuration

```env
USE_REDIS=true              # Enable Redis caching
REDIS_URL=redis://redis:6379  # Redis connection URL
REDIS_KEY_PREFIX=identity-api:  # Key prefix for namespacing
CACHE_DEFAULT_TTL=300000    # Default cache TTL (5 minutes)
CACHE_MAX_SIZE=1000         # Max cache entries
```

#### Security Settings

```env
CORS_ORIGIN=*               # CORS allowed origins
RATE_LIMIT_WINDOW_MS=900000 # Rate limit window (15 minutes)
RATE_LIMIT_MAX_REQUESTS=1000 # Max requests per window
```

### Docker Compose Profiles

#### Default Profile

- API container
- Redis container

#### Tools Profile

```bash
docker-compose --profile tools up -d
```

- Includes Redis Commander UI

#### Production Profile

```bash
docker-compose --profile production up -d
```

- Includes Nginx load balancer
- SSL/TLS ready configuration

## 🔧 Development Setup

### Development Environment

```bash
# Start development with hot reload
docker-compose -f docker-compose.dev.yml up -d

# Access services
# API: http://localhost:3000
# Redis UI: http://localhost:8081
# Redis: localhost:6379
```

### Development Features

- **Hot Reload**: Code changes trigger automatic restart
- **Debug Port**: Port 9229 exposed for debugging
- **Volume Mounting**: Source code mounted for live editing
- **Development Database**: Separate dev.db file

### Debugging in Container

```bash
# Attach debugger (VS Code)
# Add to launch.json:
{
  "type": "node",
  "request": "attach",
  "name": "Docker Debug",
  "address": "localhost",
  "port": 9229,
  "localRoot": "${workspaceFolder}",
  "remoteRoot": "/app"
}
```

## 🚀 Production Deployment

### Single Instance Deployment

```bash
# Build and start
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### Multi-Instance Deployment

```bash
# Scale API instances
docker-compose up -d --scale api=3

# With Nginx load balancer
docker-compose --profile production up -d --scale api=3
```

### Production Checklist

- [ ] Set strong Redis password
- [ ] Configure SSL certificates
- [ ] Set up log rotation
- [ ] Configure monitoring
- [ ] Set resource limits
- [ ] Configure backup strategy

## 📊 Monitoring and Health Checks

### Health Check Endpoints

```bash
# Application health
curl http://localhost:3000/api/v1/health

# Cache statistics
curl http://localhost:3000/api/v1/cache/stats

# Redis health (through Redis Commander)
# Visit http://localhost:8081
```

### Container Health Checks

All containers include health checks:

```yaml
healthcheck:
  test: ['CMD', 'redis-cli', 'ping']
  interval: 30s
  timeout: 3s
  retries: 3
```

### Monitoring Commands

```bash
# Container status
docker-compose ps

# Resource usage
docker stats

# Logs
docker-compose logs -f api
docker-compose logs -f redis

# Redis monitoring
docker exec -it identity-redis redis-cli monitor
```

## 🔒 Security Configuration

### Redis Security

```bash
# Set Redis password (production)
docker-compose exec redis redis-cli CONFIG SET requirepass "your-strong-password"

# Update environment variable
REDIS_URL=redis://:your-strong-password@redis:6379
```

### Network Security

```yaml
# Custom network configuration
networks:
  identity-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
```

### SSL/TLS Configuration

```bash
# Generate SSL certificates
mkdir ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ssl/key.pem -out ssl/cert.pem

# Update nginx.conf to enable HTTPS
# Uncomment HTTPS server block
```

## 📁 Data Persistence

### Volume Management

```bash
# List volumes
docker volume ls

# Inspect Redis data volume
docker volume inspect identity-reconciliation_redis-data

# Backup Redis data
docker run --rm -v identity-reconciliation_redis-data:/data \
  -v $(pwd):/backup alpine tar czf /backup/redis-backup.tar.gz /data

# Restore Redis data
docker run --rm -v identity-reconciliation_redis-data:/data \
  -v $(pwd):/backup alpine tar xzf /backup/redis-backup.tar.gz -C /
```

### Database Persistence

```bash
# Database files are stored in ./data directory
# Backup database
cp data/prod.db backups/prod-$(date +%Y%m%d).db

# Restore database
cp backups/prod-20231003.db data/prod.db
```

## 🔧 Troubleshooting

### Common Issues

#### Redis Connection Issues

```bash
# Check Redis container
docker-compose logs redis

# Test Redis connectivity
docker-compose exec api sh -c "redis-cli -h redis ping"

# Check Redis configuration
docker-compose exec redis redis-cli CONFIG GET "*"
```

#### API Container Issues

```bash
# Check API logs
docker-compose logs api

# Access API container
docker-compose exec api sh

# Check environment variables
docker-compose exec api env | grep REDIS
```

#### Performance Issues

```bash
# Monitor resource usage
docker stats

# Check Redis memory usage
docker-compose exec redis redis-cli INFO memory

# Monitor API performance
curl http://localhost:3000/api/v1/cache/stats
```

### Debug Commands

```bash
# Rebuild containers
docker-compose build --no-cache

# Reset everything
docker-compose down -v
docker system prune -a

# Check network connectivity
docker-compose exec api ping redis
docker-compose exec api nslookup redis
```

## 🚀 Scaling and Load Balancing

### Horizontal Scaling

```bash
# Scale API instances
docker-compose up -d --scale api=5

# With Nginx load balancer
docker-compose --profile production up -d --scale api=5
```

### Load Balancer Configuration

```nginx
upstream identity_api {
    least_conn;
    server api_1:3000 max_fails=3 fail_timeout=30s;
    server api_2:3000 max_fails=3 fail_timeout=30s;
    server api_3:3000 max_fails=3 fail_timeout=30s;
}
```

### Redis Clustering (Advanced)

For high availability, consider Redis Cluster:

```yaml
redis-cluster:
  image: redis:7-alpine
  command: redis-cli --cluster create redis1:6379 redis2:6379 redis3:6379 --cluster-replicas 1
```

## 📈 Performance Optimization

### Container Optimization

```dockerfile
# Multi-stage build reduces image size
FROM node:18-alpine AS builder
# ... build stage

FROM node:18-alpine AS production
# ... production stage with minimal dependencies
```

### Redis Optimization

```conf
# redis.conf optimizations
maxmemory 256mb
maxmemory-policy allkeys-lru
save 900 1
appendonly yes
```

### Nginx Optimization

```nginx
# Enable gzip compression
gzip on;
gzip_comp_level 6;

# Connection pooling
upstream identity_api {
    keepalive 32;
}
```

## 🔄 CI/CD Integration

### GitHub Actions Example

```yaml
name: Docker Build and Deploy

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build Docker image
        run: docker build -t identity-api .

      - name: Run tests
        run: docker-compose -f docker-compose.test.yml up --abort-on-container-exit

      - name: Deploy to production
        run: docker-compose up -d
```

## 📚 Additional Resources

### Useful Commands

```bash
# Complete cleanup
docker-compose down -v --remove-orphans
docker system prune -a --volumes

# Export/Import images
docker save identity-api > identity-api.tar
docker load < identity-api.tar

# Database migration in container
docker-compose exec api yarn db:migrate

# Generate Prisma client
docker-compose exec api yarn db:generate
```

### Monitoring Stack (Optional)

Add monitoring with Prometheus and Grafana:

```yaml
prometheus:
  image: prom/prometheus
  ports:
    - '9090:9090'

grafana:
  image: grafana/grafana
  ports:
    - '3001:3000'
```

---

## 🎯 Production Deployment Checklist

- [ ] Environment variables configured
- [ ] SSL certificates installed
- [ ] Redis password set
- [ ] Log rotation configured
- [ ] Monitoring setup
- [ ] Backup strategy implemented
- [ ] Resource limits set
- [ ] Health checks verified
- [ ] Load balancer configured
- [ ] Security headers enabled

**Docker deployment is now ready for both development and production environments with Redis caching, load balancing, and comprehensive monitoring capabilities.**
