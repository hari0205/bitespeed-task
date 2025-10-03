/**
 * Identity Controller
 * Handles HTTP requests for the /identify endpoint
 */

import { Request, Response } from 'express';
import { ContactService } from '../services';
import { IdentifyRequest, IdentifyResponse } from '../types/api.types';
import { ValidatedIdentifyRequest } from '../middleware';
import { logger } from '../utils/logger';

/**
 * Controller class for identity-related endpoints
 */
export class IdentifyController {
  constructor(private readonly contactService: ContactService) {}

  /**
   * POST /identify endpoint handler
   * Processes contact identification and linking requests
   */
  async identify(
    req: Request<{}, IdentifyResponse, ValidatedIdentifyRequest>,
    res: Response<IdentifyResponse>
  ): Promise<void> {
    const correlationId = req.headers['x-correlation-id'] || 'unknown';
    const identifyRequest: IdentifyRequest = {};

    if (req.body.email) {
      identifyRequest.email = req.body.email;
    }
    if (req.body.phoneNumber) {
      identifyRequest.phoneNumber = req.body.phoneNumber;
    }

    logger.info('Processing identify request', {
      correlationId,
      request: {
        hasEmail: !!identifyRequest.email,
        hasPhoneNumber: !!identifyRequest.phoneNumber,
      },
    });

    try {
      // Process the identification request through the service layer
      const result = await this.contactService.identifyContact(identifyRequest);

      logger.info('Identify request processed successfully', {
        correlationId,
        response: {
          primaryContactId: result.contact.primaryContactId,
          emailCount: result.contact.emails.length,
          phoneNumberCount: result.contact.phoneNumbers.length,
          secondaryContactCount: result.contact.secondaryContactIds.length,
        },
      });

      res.status(200).json(result);
    } catch (error) {
      logger.error('Error processing identify request', {
        correlationId,
        error: {
          name: error instanceof Error ? error.name : 'Unknown',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      // Re-throw the error to be handled by the global error handler
      throw error;
    }
  }
}
