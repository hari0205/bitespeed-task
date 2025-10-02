/**
 * Prisma implementation of ContactRepository
 * Handles all database operations for contacts using Prisma ORM
 */

import { PrismaClient } from '@prisma/client';
import {
  Contact,
  CreateContactData,
  UpdateContactData,
  LinkPrecedence,
} from '../types';
import { ContactRepository } from './contact-repository.interface';

export class PrismaContactRepository implements ContactRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Find contacts by email address
   */
  async findByEmail(email: string): Promise<Contact[]> {
    const contacts = await this.prisma.contact.findMany({
      where: {
        email,
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return contacts.map(this.mapPrismaContactToContact);
  }

  /**
   * Find contacts by phone number
   */
  async findByPhoneNumber(phoneNumber: string): Promise<Contact[]> {
    const contacts = await this.prisma.contact.findMany({
      where: {
        phoneNumber,
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return contacts.map(this.mapPrismaContactToContact);
  }

  /**
   * Find contacts by email OR phone number
   */
  async findByEmailOrPhoneNumber(
    email?: string,
    phoneNumber?: string
  ): Promise<Contact[]> {
    if (!email && !phoneNumber) {
      return [];
    }

    const whereConditions = [];

    if (email) {
      whereConditions.push({ email });
    }

    if (phoneNumber) {
      whereConditions.push({ phoneNumber });
    }

    const contacts = await this.prisma.contact.findMany({
      where: {
        OR: whereConditions,
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return contacts.map(this.mapPrismaContactToContact);
  }

  /**
   * Find all contacts linked to a primary contact
   */
  async findLinkedContacts(primaryId: number): Promise<Contact[]> {
    const contacts = await this.prisma.contact.findMany({
      where: {
        OR: [{ id: primaryId }, { linkedId: primaryId }],
        deletedAt: null,
      },
      orderBy: [
        { linkPrecedence: 'asc' }, // Primary first, then secondary
        { createdAt: 'asc' },
      ],
    });

    return contacts.map(this.mapPrismaContactToContact);
  }

  /**
   * Create a new contact record
   */
  async create(data: CreateContactData): Promise<Contact> {
    const contact = await this.prisma.contact.create({
      data: {
        email: data.email || null,
        phoneNumber: data.phoneNumber || null,
        linkedId: data.linkedId || null,
        linkPrecedence: data.linkPrecedence,
      },
    });

    return this.mapPrismaContactToContact(contact);
  }

  /**
   * Update an existing contact record
   */
  async update(id: number, data: UpdateContactData): Promise<Contact> {
    const updateData: any = {
      updatedAt: data.updatedAt,
    };

    if (data.linkedId !== undefined) {
      updateData.linkedId = data.linkedId;
    }

    if (data.linkPrecedence !== undefined) {
      updateData.linkPrecedence = data.linkPrecedence;
    }

    const contact = await this.prisma.contact.update({
      where: { id },
      data: updateData,
    });

    return this.mapPrismaContactToContact(contact);
  }

  /**
   * Find the primary contact for a given contact ID
   */
  async findPrimaryContact(contactId: number): Promise<Contact | null> {
    const contact = await this.prisma.contact.findUnique({
      where: { id: contactId },
    });

    if (!contact || contact.deletedAt) {
      return null;
    }

    // If this contact is already primary, return it
    if (contact.linkPrecedence === LinkPrecedence.PRIMARY) {
      return this.mapPrismaContactToContact(contact);
    }

    // If this contact is secondary, find its primary contact
    if (contact.linkedId) {
      const primaryContact = await this.prisma.contact.findUnique({
        where: { id: contact.linkedId },
      });

      if (primaryContact && !primaryContact.deletedAt) {
        return this.mapPrismaContactToContact(primaryContact);
      }
    }

    return null;
  }

  /**
   * Find a contact by its ID
   */
  async findById(id: number): Promise<Contact | null> {
    const contact = await this.prisma.contact.findUnique({
      where: { id },
    });

    if (!contact || contact.deletedAt) {
      return null;
    }

    return this.mapPrismaContactToContact(contact);
  }

  /**
   * Map Prisma contact object to our Contact interface
   */
  private mapPrismaContactToContact(prismaContact: any): Contact {
    return {
      id: prismaContact.id,
      phoneNumber: prismaContact.phoneNumber,
      email: prismaContact.email,
      linkedId: prismaContact.linkedId,
      linkPrecedence: prismaContact.linkPrecedence as LinkPrecedence,
      createdAt: prismaContact.createdAt,
      updatedAt: prismaContact.updatedAt,
      deletedAt: prismaContact.deletedAt,
    };
  }
}
