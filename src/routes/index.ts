/**
 * Main route configuration for the Identity Reconciliation API
 * Handles API versioning and route delegation
 */

import { Router } from 'express';
import { createV1Routes } from './v1';

/**
 * Creates and configures all application routes with versioning
 */
export function createRoutes(): Router {
  const router = Router();

  // Mount version 1 routes
  router.use('/v1', createV1Routes());

  // Default version redirect (optional - redirects /api/identify to /api/v1/identify)
  router.use('/', createV1Routes());

  return router;
}
