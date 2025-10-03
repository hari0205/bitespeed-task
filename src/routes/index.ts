/**
 * Route configuration for the Identity Reconciliation API
 */

import { Router } from 'express';
import { IdentifyController, HealthController } from '../controllers';
import { ContactService } from '../services';
import { PrismaContactRepository } from '../repositories';
import { ContactLinkingEngine } from '../services';
import { validateIdentifyRequest, asyncHandler } from '../middleware';
import { prisma } from '../config/database';

/**
 * Creates and configures all application routes
 */
export function createRoutes(): Router {
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

  return router;
}
