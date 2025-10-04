/**
 * Enhanced logging middleware for request/response tracking
 * Collects IP addresses, user agents, and other request metadata
 */

import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger';

/**
 * Extended Request interface with correlation ID and enhanced metadata
 */
export interface RequestWithCorrelation extends Request {
  correlationId: string;
  requestMetadata?: RequestMetadata;
}

/**
 * Enhanced request metadata interface
 */
export interface RequestMetadata {
  ip: string;
  realIp?: string;
  forwardedFor?: string;
  userAgent?: string;
  referer?: string;
  origin?: string;
  contentType?: string;
  contentLength?: number;
  acceptLanguage?: string;
  acceptEncoding?: string;
  host?: string;
  protocol: string;
  secure: boolean;
  timestamp: string;
  sessionId?: string;
}

/**
 * Extract comprehensive client information from request
 */
function extractClientInfo(req: Request): RequestMetadata {
  // Get real IP address (considering proxies and load balancers)
  const getRealIp = (request: Request): string => {
    return (
      (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (request.headers['x-real-ip'] as string) ||
      (request.headers['x-client-ip'] as string) ||
      (request.headers['cf-connecting-ip'] as string) || // Cloudflare
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress ||
      request.ip ||
      'unknown'
    );
  };

  const contentLength = req.headers['content-length']
    ? parseInt(req.headers['content-length'], 10)
    : undefined;

  const result: RequestMetadata = {
    ip: req.ip || 'unknown',
    realIp: getRealIp(req),
    protocol: req.protocol,
    secure: req.secure,
    timestamp: new Date().toISOString(),
  };

  // Only add optional properties if they exist
  const forwardedFor = req.headers['x-forwarded-for'] as string;
  if (forwardedFor) result.forwardedFor = forwardedFor;

  const userAgent = req.headers['user-agent'];
  if (userAgent) result.userAgent = userAgent;

  const referer = req.headers['referer'] || (req.headers['referrer'] as string);
  if (referer) result.referer = referer;

  const origin = req.headers['origin'] as string;
  if (origin) result.origin = origin;

  const contentType = req.headers['content-type'] as string;
  if (contentType) result.contentType = contentType;

  if (contentLength !== undefined) result.contentLength = contentLength;

  const acceptLanguage = req.headers['accept-language'] as string;
  if (acceptLanguage) result.acceptLanguage = acceptLanguage;

  const acceptEncoding = req.headers['accept-encoding'] as string;
  if (acceptEncoding) result.acceptEncoding = acceptEncoding;

  const host = req.headers['host'] as string;
  if (host) result.host = host;

  const sessionId = req.headers['x-session-id'] as string;
  if (sessionId) result.sessionId = sessionId;

  return result;
}

/**
 * Parse User Agent for additional insights
 */
function parseUserAgent(userAgent?: string): {
  browser?: string;
  os?: string;
  device?: string;
  isBot?: boolean;
} {
  if (!userAgent) return {};

  const ua = userAgent.toLowerCase();

  // Detect bots
  const botPatterns = [
    'bot',
    'crawler',
    'spider',
    'scraper',
    'curl',
    'wget',
    'postman',
  ];
  const isBot = botPatterns.some(pattern => ua.includes(pattern));

  // Basic browser detection
  let browser: string | undefined;
  if (ua.includes('chrome')) browser = 'Chrome';
  else if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('safari')) browser = 'Safari';
  else if (ua.includes('edge')) browser = 'Edge';
  else if (ua.includes('opera')) browser = 'Opera';

  // Basic OS detection
  let os: string | undefined;
  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('mac')) os = 'macOS';
  else if (ua.includes('linux')) os = 'Linux';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('ios')) os = 'iOS';

  // Basic device detection
  let device: string | undefined;
  if (ua.includes('mobile')) device = 'Mobile';
  else if (ua.includes('tablet')) device = 'Tablet';
  else device = 'Desktop';

  const result: {
    browser?: string;
    os?: string;
    device?: string;
    isBot?: boolean;
  } = {};

  if (browser !== undefined) result.browser = browser;
  if (os !== undefined) result.os = os;
  if (device !== undefined) result.device = device;
  if (isBot !== undefined) result.isBot = isBot;

  return result;
}

/**
 * Enhanced request logging middleware
 * Adds correlation ID and logs comprehensive request information
 */
export function requestLogger(
  req: RequestWithCorrelation,
  res: Response,
  next: NextFunction
): void {
  // Generate or use existing correlation ID
  const correlationId =
    (req.headers['x-correlation-id'] as string) || randomUUID();
  req.correlationId = correlationId;

  // Extract comprehensive client information
  const clientInfo = extractClientInfo(req);
  req.requestMetadata = clientInfo;

  // Parse user agent for additional insights
  const userAgentInfo = parseUserAgent(clientInfo.userAgent);

  // Add correlation ID to response headers
  res.setHeader('x-correlation-id', correlationId);

  // Enhanced request logging
  logger.info('Incoming request', {
    correlationId,
    request: {
      method: req.method,
      url: req.url,
      path: req.path,
      query: Object.keys(req.query).length > 0 ? req.query : undefined,
      timestamp: clientInfo.timestamp,
    },
    client: {
      ip: clientInfo.realIp,
      originalIp:
        clientInfo.ip !== clientInfo.realIp ? clientInfo.ip : undefined,
      forwardedFor: clientInfo.forwardedFor,
      userAgent: clientInfo.userAgent,
      ...userAgentInfo,
      referer: clientInfo.referer,
      origin: clientInfo.origin,
      host: clientInfo.host,
      protocol: clientInfo.protocol,
      secure: clientInfo.secure,
      sessionId: clientInfo.sessionId,
    },
    headers: {
      contentType: clientInfo.contentType,
      contentLength: clientInfo.contentLength,
      acceptLanguage: clientInfo.acceptLanguage,
      acceptEncoding: clientInfo.acceptEncoding,
    },
  });

  // Track response time and performance metrics
  const startTime = Date.now();
  const startMemory = process.memoryUsage();

  // Override res.json to log responses
  const originalJson = res.json;
  res.json = function (body: any) {
    const responseTime = Date.now() - startTime;
    const endMemory = process.memoryUsage();
    const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;

    // Determine response size (approximate)
    const responseSize = Buffer.byteLength(JSON.stringify(body), 'utf8');

    // Log response with performance metrics
    logger.info('Outgoing response', {
      correlationId,
      response: {
        statusCode: res.statusCode,
        responseTime: `${responseTime}ms`,
        responseSize: `${responseSize} bytes`,
        memoryDelta: `${Math.round(memoryDelta / 1024)} KB`,
        timestamp: new Date().toISOString(),
      },
      performance: {
        responseTimeMs: responseTime,
        responseSizeBytes: responseSize,
        memoryDeltaBytes: memoryDelta,
        slow: responseTime > 1000, // Flag slow responses
      },
    });

    return originalJson.call(this, body);
  };

  // Log request completion with comprehensive metrics
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    const endMemory = process.memoryUsage();
    const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;

    // Determine response category
    const getResponseCategory = (statusCode: number): string => {
      if (statusCode >= 200 && statusCode < 300) return 'success';
      if (statusCode >= 300 && statusCode < 400) return 'redirect';
      if (statusCode >= 400 && statusCode < 500) return 'client_error';
      if (statusCode >= 500) return 'server_error';
      return 'unknown';
    };

    logger.info('Request completed', {
      correlationId,
      summary: {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        category: getResponseCategory(res.statusCode),
        responseTime: `${responseTime}ms`,
        clientIp: clientInfo.realIp,
        userAgent: userAgentInfo.browser || 'Unknown',
        isBot: userAgentInfo.isBot,
        timestamp: new Date().toISOString(),
      },
      metrics: {
        responseTimeMs: responseTime,
        memoryDeltaBytes: memoryDelta,
        slow: responseTime > 1000,
        error: res.statusCode >= 400,
      },
    });

    // Log security-relevant events
    if (res.statusCode === 401 || res.statusCode === 403) {
      logger.warn('Security event: Unauthorized access attempt', {
        correlationId,
        security: {
          event: 'unauthorized_access',
          statusCode: res.statusCode,
          ip: clientInfo.realIp,
          userAgent: clientInfo.userAgent,
          path: req.path,
          method: req.method,
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Log suspicious activity
    if (userAgentInfo.isBot && req.method === 'POST') {
      logger.warn('Suspicious activity: Bot making POST request', {
        correlationId,
        security: {
          event: 'bot_post_request',
          ip: clientInfo.realIp,
          userAgent: clientInfo.userAgent,
          path: req.path,
          timestamp: new Date().toISOString(),
        },
      });
    }
  });

  next();
}

/**
 * Security headers middleware
 * Removes sensitive headers from logs
 */
export function sanitizeHeaders(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  // Remove sensitive headers from logging
  const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];

  sensitiveHeaders.forEach(header => {
    if (req.headers[header]) {
      req.headers[header] = '[REDACTED]';
    }
  });

  next();
}
