# API Versioning Guide

## Overview

The Identity Reconciliation API supports versioning to ensure backward compatibility and smooth API evolution.

## Current Versions

- **v1** (Current/Latest): `/api/v1/*`

## Accessing Versioned Endpoints

### Method 1: URL Path (Recommended)

```bash
# Version 1 endpoints
curl http://localhost:3000/api/v1/health
curl -X POST http://localhost:3000/api/v1/identify -H "Content-Type: application/json" -d '{"email":"test@example.com"}'
```

### Method 2: Unversioned (Uses Current Version)

```bash
# These automatically use the current version (v1)
curl http://localhost:3000/api/health
curl -X POST http://localhost:3000/api/identify -H "Content-Type: application/json" -d '{"email":"test@example.com"}'
```

### Method 3: Custom Header

```bash
curl -H "X-API-Version: v1" http://localhost:3000/api/health
```

### Method 4: Accept Header

```bash
curl -H "Accept: application/vnd.api+json;version=1" http://localhost:3000/api/health
```

### Method 5: Query Parameter

```bash
curl http://localhost:3000/api/health?version=v1
```

## API Endpoints

### Root Information

- `GET /` - API information and available versions
- `GET /api/v1/` - Version 1 specific information

### Version 1 Endpoints

- `GET /api/v1/health` - Health check
- `POST /api/v1/identify` - Identity reconciliation

## Response Headers

All API responses include version information:

- `X-API-Version: v1` - The version used for this request
- `X-Supported-Versions: v1` - All supported versions

## Sample Requests

### Test Root Endpoint

```bash
curl http://localhost:3000/
```

### Test Version 1 Health

```bash
curl http://localhost:3000/api/v1/health
```

### Test Version 1 Identify

```bash
curl -X POST http://localhost:3000/api/v1/identify \
  -H "Content-Type: application/json" \
  -d '{"email": "john@example.com", "phoneNumber": "+1234567890"}'
```

### Test Unversioned (Current Version)

```bash
curl -X POST http://localhost:3000/api/identify \
  -H "Content-Type: application/json" \
  -d '{"email": "jane@example.com"}'
```

## Error Handling

If an unsupported version is requested:

```json
{
  "error": {
    "message": "Unsupported API version: v2",
    "code": "UNSUPPORTED_API_VERSION",
    "supportedVersions": ["v1"]
  },
  "timestamp": "2025-10-03T15:30:00.000Z",
  "path": "/api/v2/identify"
}
```

## Future Versions

When new versions are added:

1. Create new route files in `src/routes/v2/`
2. Update `SUPPORTED_VERSIONS` in `src/middleware/versioning.ts`
3. Mount new routes in `src/routes/index.ts`
4. Update documentation
