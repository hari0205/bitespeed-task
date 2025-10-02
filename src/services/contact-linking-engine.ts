/**
 * Contact Linking Engine
 * Handles the complex logic for determining and executing contact linking strategies
 */

import {
  Contact,
  ContactLinkingStrategy,
  LinkPrecedence,
  CreateContactData,
} from '../types';
import { ContactRepository } from '../repositories';

/**
 * Request data for contact identification
 */
export interface IdentifyRequest {
  email?: string;
  phoneNumber?: string;
}

/**
 * Strategy execution result
 */
export interface StrategyExecutionResult {
  primaryContact: Contact;
  allLinkedContacts: Contact[];
}

/**
 * Contact Linking Engine class responsible for determining and executing
 * contact linking strategies based on existing contacts and new requests
 */
export class ContactLinkingEngine {
  constructor(private readonly contactRepository: ContactRepository) {}

  /**
   * Determines the appropriate linking strategy based on existing contacts and request
   */
  determineContactStrategy(
    existingContacts: Contact[],
    request: IdentifyRequest
  ): ContactLinkingStrategy {
    // No existing contacts - create new primary
    if (existingContacts.length === 0) {
      return ContactLinkingStrategy.CREATE_NEW_PRIMARY;
    }

    // Check if we have an exact match (same email AND phone combination)
    const exactMatch = this.findExactMatch(existingContacts, request);
    if (exactMatch) {
      return ContactLinkingStrategy.RETURN_EXISTING;
    }

    // Analyze existing contacts to determine strategy
    const primaryContacts = existingContacts.filter(
      contact => contact.linkPrecedence === LinkPrecedence.PRIMARY
    );

    // Multiple primary contacts need to be linked
    if (primaryContacts.length > 1) {
      return ContactLinkingStrategy.LINK_EXISTING_PRIMARIES;
    }

    // Single primary contact or mixed contacts - create secondary
    return ContactLinkingStrategy.CREATE_SECONDARY;
  }

  /**
   * Executes the determined strategy and returns the result
   */
  async executeStrategy(
    strategy: ContactLinkingStrategy,
    existingContacts: Contact[],
    request: IdentifyRequest
  ): Promise<StrategyExecutionResult> {
    switch (strategy) {
      case ContactLinkingStrategy.CREATE_NEW_PRIMARY:
        return this.createNewPrimary(request);

      case ContactLinkingStrategy.RETURN_EXISTING:
        return this.returnExisting(existingContacts, request);

      case ContactLinkingStrategy.CREATE_SECONDARY:
        return this.createSecondary(existingContacts, request);

      case ContactLinkingStrategy.LINK_EXISTING_PRIMARIES:
        return this.linkExistingPrimaries(existingContacts, request);

      default:
        throw new Error(`Unknown strategy: ${strategy}`);
    }
  }

  /**
   * Creates a new primary contact when no existing contacts are found
   */
  private async createNewPrimary(
    request: IdentifyRequest
  ): Promise<StrategyExecutionResult> {
    const contactData: CreateContactData = {
      linkPrecedence: LinkPrecedence.PRIMARY,
    };

    if (request.email) {
      contactData.email = request.email;
    }

    if (request.phoneNumber) {
      contactData.phoneNumber = request.phoneNumber;
    }

    const primaryContact = await this.contactRepository.create(contactData);

    return {
      primaryContact,
      allLinkedContacts: [primaryContact],
    };
  }

  /**
   * Returns existing contact tree when exact match is found
   */
  private async returnExisting(
    existingContacts: Contact[],
    request: IdentifyRequest
  ): Promise<StrategyExecutionResult> {
    const exactMatch = this.findExactMatch(existingContacts, request);
    if (!exactMatch) {
      throw new Error('Exact match not found in existing contacts');
    }

    // Find the primary contact
    const primaryContact = await this.findPrimaryFromContacts(existingContacts);

    // Get all linked contacts
    const allLinkedContacts = await this.contactRepository.findLinkedContacts(
      primaryContact.id
    );

    return {
      primaryContact,
      allLinkedContacts,
    };
  }

  /**
   * Creates a secondary contact linked to existing primary
   */
  private async createSecondary(
    existingContacts: Contact[],
    request: IdentifyRequest
  ): Promise<StrategyExecutionResult> {
    const primaryContact = await this.findPrimaryFromContacts(existingContacts);

    const contactData: CreateContactData = {
      linkedId: primaryContact.id,
      linkPrecedence: LinkPrecedence.SECONDARY,
    };

    if (request.email) {
      contactData.email = request.email;
    }

    if (request.phoneNumber) {
      contactData.phoneNumber = request.phoneNumber;
    }

    await this.contactRepository.create(contactData);

    // Get all linked contacts after creation
    const allLinkedContacts = await this.contactRepository.findLinkedContacts(
      primaryContact.id
    );

    return {
      primaryContact,
      allLinkedContacts,
    };
  }

  /**
   * Links existing primary contacts by converting newer primary to secondary
   */
  private async linkExistingPrimaries(
    existingContacts: Contact[],
    request: IdentifyRequest
  ): Promise<StrategyExecutionResult> {
    const primaryContacts = existingContacts.filter(
      contact => contact.linkPrecedence === LinkPrecedence.PRIMARY
    );

    if (primaryContacts.length < 2) {
      throw new Error('Expected at least 2 primary contacts for linking');
    }

    // Sort by creation date to find the oldest (will remain primary)
    primaryContacts.sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );

    const oldestPrimary = primaryContacts[0];
    if (!oldestPrimary) {
      throw new Error('No primary contact found after sorting');
    }

    const newerPrimaries = primaryContacts.slice(1);

    // Convert newer primaries to secondaries
    for (const newerPrimary of newerPrimaries) {
      await this.convertPrimaryToSecondary(newerPrimary, oldestPrimary.id);
    }

    // Create new secondary contact with the request data
    const contactData: CreateContactData = {
      linkedId: oldestPrimary.id,
      linkPrecedence: LinkPrecedence.SECONDARY,
    };

    if (request.email) {
      contactData.email = request.email;
    }

    if (request.phoneNumber) {
      contactData.phoneNumber = request.phoneNumber;
    }

    await this.contactRepository.create(contactData);

    // Get all linked contacts after linking
    const allLinkedContacts = await this.contactRepository.findLinkedContacts(
      oldestPrimary.id
    );

    return {
      primaryContact: oldestPrimary,
      allLinkedContacts,
    };
  }

  /**
   * Converts a primary contact to secondary and updates all its linked contacts
   */
  private async convertPrimaryToSecondary(
    primaryToConvert: Contact,
    newPrimaryId: number
  ): Promise<void> {
    // Update the primary contact to become secondary
    await this.contactRepository.update(primaryToConvert.id, {
      linkedId: newPrimaryId,
      linkPrecedence: LinkPrecedence.SECONDARY,
      updatedAt: new Date(),
    });

    // Find all contacts that were linked to this primary
    const linkedContacts = await this.contactRepository.findLinkedContacts(
      primaryToConvert.id
    );

    // Update all secondary contacts to point to the new primary
    const secondaryContacts = linkedContacts.filter(
      contact =>
        contact.linkPrecedence === LinkPrecedence.SECONDARY &&
        contact.id !== primaryToConvert.id
    );

    for (const secondaryContact of secondaryContacts) {
      await this.contactRepository.update(secondaryContact.id, {
        linkedId: newPrimaryId,
        linkPrecedence: LinkPrecedence.SECONDARY,
        updatedAt: new Date(),
      });
    }
  }

  /**
   * Finds exact match in existing contacts (same email AND phone combination)
   */
  private findExactMatch(
    existingContacts: Contact[],
    request: IdentifyRequest
  ): Contact | null {
    return (
      existingContacts.find(contact => {
        const emailMatch = request.email
          ? contact.email === request.email
          : !contact.email;
        const phoneMatch = request.phoneNumber
          ? contact.phoneNumber === request.phoneNumber
          : !contact.phoneNumber;

        // For exact match, both fields must match (including null values)
        return emailMatch && phoneMatch;
      }) || null
    );
  }

  /**
   * Finds the primary contact from a list of contacts
   */
  private async findPrimaryFromContacts(contacts: Contact[]): Promise<Contact> {
    // First try to find a primary contact in the list
    const primaryInList = contacts.find(
      contact => contact.linkPrecedence === LinkPrecedence.PRIMARY
    );

    if (primaryInList) {
      return primaryInList;
    }

    // If no primary in list, find primary through repository
    // This handles cases where we have secondary contacts but not their primary
    for (const contact of contacts) {
      if (
        contact.linkPrecedence === LinkPrecedence.SECONDARY &&
        contact.linkedId
      ) {
        const primary = await this.contactRepository.findPrimaryContact(
          contact.id
        );
        if (primary) {
          return primary;
        }
      }
    }

    throw new Error('No primary contact found in the contact chain');
  }
}
