/**
 * Version 1 API Routes
 * Route configuration for API version 1
 */

import { Router } from 'express';
import {
  IdentifyController,
  HealthController,
  CacheController,
} from '../../controllers';
import { ContactService } from '../../services';
import { PrismaContactRepository } from '../../repositories';
import { ContactLinkingEngine } from '../../services';
import { validateIdentifyRequest, asyncHandler } from '../../middleware';
import { prisma } from '../../config/database';

/**
 * Creates and configures all v1 API routes
 */
export function createV1Routes(): Router {
  const router = Router();

  // Initialize dependencies
  const contactRepository = new PrismaContactRepository(prisma);
  const contactLinkingEngine = new ContactLinkingEngine(contactRepository);
  const contactService = new ContactService(
    contactRepository,
    contactLinkingEngine
  );

  // Initialize controllers
  const identifyController = new IdentifyController(contactService);
  const healthController = new HealthController();
  const cacheController = new CacheController();

  // Version 1 API root endpoint
  router.get('/', (_req, res) => {
    res.status(200).json({
      message: 'Identity Reconciliation API - Version 1',
      version: '1.0.0',
      apiVersion: 'v1',
      endpoints: {
        health: 'GET /api/v1/health',
        identify: 'POST /api/v1/identify',
      },
    });
  });

  // Health check endpoint
  router.get(
    '/health',
    asyncHandler(healthController.health.bind(healthController))
  );

  // Identity endpoints
  router.post(
    '/identify',
    validateIdentifyRequest,
    asyncHandler(identifyController.identify.bind(identifyController))
  );

  // Cache management endpoints (for monitoring/admin)
  router.get(
    '/cache/stats',
    asyncHandler(cacheController.getStats.bind(cacheController))
  );

  router.delete(
    '/cache/clear',
    asyncHandler(cacheController.clearCache.bind(cacheController))
  );

  router.post(
    '/cache/warm',
    asyncHandler(cacheController.warmCache.bind(cacheController))
  );

  return router;
}
