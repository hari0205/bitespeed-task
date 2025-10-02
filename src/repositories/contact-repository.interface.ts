/**
 * Contact Repository Interface
 * Defines the contract for contact data access operations
 */

import { Contact, CreateContactData, UpdateContactData } from '../types';

export interface ContactRepository {
  /**
   * Find contacts by email address
   */
  findByEmail(email: string): Promise<Contact[]>;

  /**
   * Find contacts by phone number
   */
  findByPhoneNumber(phoneNumber: string): Promise<Contact[]>;

  /**
   * Find contacts by email OR phone number
   */
  findByEmailOrPhoneNumber(
    email?: string,
    phoneNumber?: string
  ): Promise<Contact[]>;

  /**
   * Find all contacts linked to a primary contact
   */
  findLinkedContacts(primaryId: number): Promise<Contact[]>;

  /**
   * Create a new contact record
   */
  create(data: CreateContactData): Promise<Contact>;

  /**
   * Update an existing contact record
   */
  update(id: number, data: UpdateContactData): Promise<Contact>;

  /**
   * Find the primary contact for a given contact ID
   * If the contact is already primary, returns itself
   * If the contact is secondary, returns its linked primary contact
   */
  findPrimaryContact(contactId: number): Promise<Contact | null>;

  /**
   * Find a contact by its ID
   */
  findById(id: number): Promise<Contact | null>;
}
