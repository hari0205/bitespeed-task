/**
 * Contact Service
 * Main business logic service for contact identification and management
 */

import { Contact, LinkPrecedence, CreateContactData } from '../types';
import { IdentifyRequest, IdentifyResponse } from '../types/api.types';
import { ContactRepository } from '../repositories';
import {
  ContactLinkingEngine,
  StrategyExecutionResult,
} from './contact-linking-engine';
import {
  ValidationError,
  ContactNotFoundError,
  ContactLinkingError,
} from '../types/errors.types';
import {
  handleServiceOperation,
  handleDatabaseOperation,
  createErrorContext,
} from '../utils/error-utils';
import { cacheService } from './cache-service';
import { logger } from '../utils/logger';

/**
 * Contact Service class responsible for orchestrating contact identification,
 * creation, and linking operations
 */
export class ContactService {
  constructor(
    private readonly contactRepository: ContactRepository,
    private readonly contactLinkingEngine: ContactLinkingEngine
  ) {}

  /**
   * Main method for identifying and linking contacts based on email/phone
   * Implements the core business logic for the /identify endpoint
   */
  async identifyContact(
    request: IdentifyRequest,
    correlationId?: string
  ): Promise<IdentifyResponse> {
    return handleServiceOperation(
      async () => {
        // Validate that at least one contact method is provided
        if (!request.email && !request.phoneNumber) {
          throw new ValidationError(
            'Either email or phoneNumber must be provided',
            createErrorContext('identifyContact', correlationId, { request })
          );
        }

        // Generate cache key for this request
        const cacheKey = this.generateCacheKey(request);

        // Try to get cached result first
        const cachedResult = cacheService.getCachedContact(cacheKey);
        if (cachedResult) {
          logger.debug('Contact identification cache hit', {
            correlationId,
            cacheKey,
            email: request.email,
            phoneNumber: request.phoneNumber,
          });
          return cachedResult;
        }

        // Find existing contacts that match the provided email or phone number
        const existingContacts = await handleDatabaseOperation(
          () =>
            this.contactRepository.findByEmailOrPhoneNumber(
              request.email,
              request.phoneNumber
            ),
          'findByEmailOrPhoneNumber',
          correlationId
        );

        // Determine the appropriate linking strategy
        const strategy = this.contactLinkingEngine.determineContactStrategy(
          existingContacts,
          request
        );

        // Execute the strategy to get the primary contact and all linked contacts
        const result = await this.contactLinkingEngine.executeStrategy(
          strategy,
          existingContacts,
          request,
          correlationId
        );

        // Format and return the response
        const response = this.formatIdentifyResponse(result);

        // Cache the result for future requests (5 minutes TTL)
        cacheService.cacheContact(cacheKey, response, 300000);

        logger.debug('Contact identification result cached', {
          correlationId,
          cacheKey,
          primaryContactId: response.contact.primaryContactId,
        });

        return response;
      },
      'identifyContact',
      correlationId
    );
  }

  /**
   * Helper method to create a new primary contact
   */
  async createPrimaryContact(
    email?: string,
    phoneNumber?: string,
    correlationId?: string
  ): Promise<Contact> {
    return handleServiceOperation(
      async () => {
        if (!email && !phoneNumber) {
          throw new ValidationError(
            'Either email or phoneNumber must be provided',
            createErrorContext('createPrimaryContact', correlationId, {
              email,
              phoneNumber,
            })
          );
        }

        const contactData: CreateContactData = {
          linkPrecedence: LinkPrecedence.PRIMARY,
        };

        if (email) {
          contactData.email = email;
        }

        if (phoneNumber) {
          contactData.phoneNumber = phoneNumber;
        }

        return handleDatabaseOperation(
          () => this.contactRepository.create(contactData),
          'createPrimaryContact',
          correlationId
        );
      },
      'createPrimaryContact',
      correlationId
    );
  }

  /**
   * Helper method to link two contacts by making the secondary contact
   * point to the primary contact
   */
  async linkContacts(
    primaryId: number,
    secondaryId: number,
    correlationId?: string
  ): Promise<void> {
    return handleServiceOperation(
      async () => {
        // Verify that the primary contact exists and is actually primary
        const primaryContact = await handleDatabaseOperation(
          () => this.contactRepository.findById(primaryId),
          'findById',
          correlationId
        );

        if (!primaryContact) {
          throw new ContactNotFoundError(
            `Primary contact with ID ${primaryId} not found`,
            createErrorContext('linkContacts', correlationId, {
              primaryId,
              secondaryId,
            })
          );
        }

        if (primaryContact.linkPrecedence !== LinkPrecedence.PRIMARY) {
          throw new ContactLinkingError(
            `Contact with ID ${primaryId} is not a primary contact`,
            createErrorContext('linkContacts', correlationId, {
              primaryId,
              secondaryId,
              actualPrecedence: primaryContact.linkPrecedence,
            })
          );
        }

        // Update the secondary contact to link to the primary
        await handleDatabaseOperation(
          () =>
            this.contactRepository.update(secondaryId, {
              linkedId: primaryId,
              linkPrecedence: LinkPrecedence.SECONDARY,
              updatedAt: new Date(),
            }),
          'updateContactLinking',
          correlationId
        );
      },
      'linkContacts',
      correlationId
    );
  }

  /**
   * Helper method to find contacts by email or phone number
   */
  async findContactsByEmailOrPhone(
    email?: string,
    phoneNumber?: string,
    correlationId?: string
  ): Promise<Contact[]> {
    if (!email && !phoneNumber) {
      return [];
    }

    return handleDatabaseOperation(
      () => this.contactRepository.findByEmailOrPhoneNumber(email, phoneNumber),
      'findContactsByEmailOrPhone',
      correlationId
    );
  }

  /**
   * Formats the strategy execution result into the API response format
   */
  private formatIdentifyResponse(
    result: StrategyExecutionResult
  ): IdentifyResponse {
    const { primaryContact, allLinkedContacts } = result;

    // Extract unique emails and phone numbers from all linked contacts
    const emails = this.extractUniqueEmails(allLinkedContacts, primaryContact);
    const phoneNumbers = this.extractUniquePhoneNumbers(
      allLinkedContacts,
      primaryContact
    );

    // Get secondary contact IDs (excluding the primary contact)
    const secondaryContactIds = allLinkedContacts
      .filter(
        contact =>
          contact.id !== primaryContact.id &&
          contact.linkPrecedence === LinkPrecedence.SECONDARY
      )
      .map(contact => contact.id);

    return {
      contact: {
        primaryContactId: primaryContact.id,
        emails,
        phoneNumbers,
        secondaryContactIds,
      },
    };
  }

  /**
   * Extracts unique emails with primary contact's email first
   */
  private extractUniqueEmails(
    allContacts: Contact[],
    primaryContact: Contact
  ): string[] {
    const emailSet = new Set<string>();
    const emails: string[] = [];

    // Add primary contact's email first if it exists
    if (primaryContact.email) {
      emails.push(primaryContact.email);
      emailSet.add(primaryContact.email);
    }

    // Add other unique emails
    for (const contact of allContacts) {
      if (contact.email && !emailSet.has(contact.email)) {
        emails.push(contact.email);
        emailSet.add(contact.email);
      }
    }

    return emails;
  }

  /**
   * Extracts unique phone numbers with primary contact's phone number first
   */
  private extractUniquePhoneNumbers(
    allContacts: Contact[],
    primaryContact: Contact
  ): string[] {
    const phoneSet = new Set<string>();
    const phoneNumbers: string[] = [];

    // Add primary contact's phone number first if it exists
    if (primaryContact.phoneNumber) {
      phoneNumbers.push(primaryContact.phoneNumber);
      phoneSet.add(primaryContact.phoneNumber);
    }

    // Add other unique phone numbers
    for (const contact of allContacts) {
      if (contact.phoneNumber && !phoneSet.has(contact.phoneNumber)) {
        phoneNumbers.push(contact.phoneNumber);
        phoneSet.add(contact.phoneNumber);
      }
    }

    return phoneNumbers;
  }

  /**
   * Generate cache key for contact identification request
   */
  private generateCacheKey(request: IdentifyRequest): string {
    const email = request.email?.toLowerCase().trim() || '';
    const phone = request.phoneNumber?.replace(/\s+/g, '') || '';
    return `contact:identify:${email}:${phone}`;
  }
}
