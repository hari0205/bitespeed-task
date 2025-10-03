/**
 * API Versioning Middleware
 * Handles API version detection and routing
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Supported API versions
 */
export const SUPPORTED_VERSIONS = ['v1'] as const;
export type ApiVersion = (typeof SUPPORTED_VERSIONS)[number];

/**
 * Default API version
 */
export const DEFAULT_VERSION: ApiVersion = 'v1';

/**
 * Extended request interface with API version information
 */
export interface VersionedRequest extends Request {
  apiVersion: ApiVersion;
}

/**
 * Middleware to detect and set API version
 * Checks for version in:
 * 1. URL path (/api/v1/...)
 * 2. Accept header (application/vnd.api+json;version=1)
 * 3. Custom header (X-API-Version)
 * 4. Query parameter (?version=v1)
 */
export function apiVersioning(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const versionedReq = req as VersionedRequest;
  let detectedVersion: ApiVersion = DEFAULT_VERSION;

  // 1. Check URL path for version
  const pathMatch = req.path.match(/^\/api\/v(\d+)/);
  if (pathMatch) {
    const versionFromPath = `v${pathMatch[1]}` as ApiVersion;
    if (SUPPORTED_VERSIONS.includes(versionFromPath)) {
      detectedVersion = versionFromPath;
    }
  }

  // 2. Check Accept header
  const acceptHeader = req.headers.accept;
  if (acceptHeader) {
    const versionMatch = acceptHeader.match(/version=(\d+)/);
    if (versionMatch) {
      const versionFromHeader = `v${versionMatch[1]}` as ApiVersion;
      if (SUPPORTED_VERSIONS.includes(versionFromHeader)) {
        detectedVersion = versionFromHeader;
      }
    }
  }

  // 3. Check custom header
  const versionHeader = req.headers['x-api-version'] as string;
  if (
    versionHeader &&
    SUPPORTED_VERSIONS.includes(versionHeader as ApiVersion)
  ) {
    detectedVersion = versionHeader as ApiVersion;
  }

  // 4. Check query parameter
  const versionQuery = req.query.version as string;
  if (versionQuery && SUPPORTED_VERSIONS.includes(versionQuery as ApiVersion)) {
    detectedVersion = versionQuery as ApiVersion;
  }

  // Set the detected version
  versionedReq.apiVersion = detectedVersion;

  // Add version info to response headers
  res.setHeader('X-API-Version', detectedVersion);
  res.setHeader('X-Supported-Versions', SUPPORTED_VERSIONS.join(', '));

  logger.debug('API version detected', {
    path: req.path,
    method: req.method,
    detectedVersion,
    userAgent: req.headers['user-agent'],
  });

  next();
}

/**
 * Middleware to validate API version compatibility
 */
export function validateApiVersion(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const versionedReq = req as VersionedRequest;

  if (
    !versionedReq.apiVersion ||
    !SUPPORTED_VERSIONS.includes(versionedReq.apiVersion)
  ) {
    return res.status(400).json({
      error: {
        message: `Unsupported API version: ${versionedReq.apiVersion}`,
        code: 'UNSUPPORTED_API_VERSION',
        supportedVersions: SUPPORTED_VERSIONS,
      },
      timestamp: new Date().toISOString(),
      path: req.path,
    });
  }

  next();
}

/**
 * Get API version from request
 */
export function getApiVersion(req: Request): ApiVersion {
  return (req as VersionedRequest).apiVersion || DEFAULT_VERSION;
}
