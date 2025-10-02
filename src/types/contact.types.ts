/**
 * Core contact-related type definitions for the Identity Reconciliation system
 */

/**
 * Enum defining the precedence level of a contact in the linking hierarchy
 */
export enum LinkPrecedence {
  PRIMARY = 'primary',
  SECONDARY = 'secondary',
}

/**
 * Enum defining different strategies for linking contacts
 */
export enum ContactLinkingStrategy {
  CREATE_NEW_PRIMARY = 'CREATE_NEW_PRIMARY',
  CREATE_SECONDARY = 'CREATE_SECONDARY',
  LINK_EXISTING_PRIMARIES = 'LINK_EXISTING_PRIMARIES',
  RETURN_EXISTING = 'RETURN_EXISTING',
}

/**
 * Core Contact interface representing a contact record
 */
export interface Contact {
  id: number;
  phoneNumber: string | null;
  email: string | null;
  linkedId: number | null;
  linkPrecedence: LinkPrecedence;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * Data required to create a new contact
 */
export interface CreateContactData {
  email?: string;
  phoneNumber?: string;
  linkedId?: number;
  linkPrecedence: LinkPrecedence;
}

/**
 * Data that can be updated on an existing contact
 */
export interface UpdateContactData {
  linkedId?: number;
  linkPrecedence?: LinkPrecedence;
  updatedAt: Date;
}
