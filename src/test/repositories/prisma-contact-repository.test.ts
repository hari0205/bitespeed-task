/**
 * Unit tests for PrismaContactRepository
 * Tests all repository methods with mocked Prisma client
 */

import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';
import { PrismaContactRepository } from '../../repositories/prisma-contact-repository';
import {
  LinkPrecedence,
  CreateContactData,
  UpdateContactData,
} from '../../types';

// Mock Prisma client
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockDeep<PrismaClient>()),
}));

describe('PrismaContactRepository', () => {
  let repository: PrismaContactRepository;
  let prismaMock: DeepMockProxy<PrismaClient>;

  beforeEach(() => {
    prismaMock = mockDeep<PrismaClient>();
    repository = new PrismaContactRepository(prismaMock);
    mockReset(prismaMock);
  });

  describe('findByEmail', () => {
    it('should find contacts by email address', async () => {
      const email = 'test@example.com';
      const mockContacts = [
        {
          id: 1,
          email,
          phoneNumber: null,
          linkedId: null,
          linkPrecedence: LinkPrecedence.PRIMARY,
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date('2023-01-01'),
          deletedAt: null,
        },
      ];

      prismaMock.contact.findMany.mockResolvedValue(mockContacts);

      const result = await repository.findByEmail(email);

      expect(prismaMock.contact.findMany).toHaveBeenCalledWith({
        where: {
          email,
          deletedAt: null,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });
      expect(result).toHaveLength(1);
      expect(result[0]?.email).toBe(email);
      expect(result[0]?.linkPrecedence).toBe(LinkPrecedence.PRIMARY);
    });

    it('should return empty array when no contacts found', async () => {
      prismaMock.contact.findMany.mockResolvedValue([]);

      const result = await repository.findByEmail('nonexistent@example.com');

      expect(result).toHaveLength(0);
    });
  });

  describe('findByPhoneNumber', () => {
    it('should find contacts by phone number', async () => {
      const phoneNumber = '+1234567890';
      const mockContacts = [
        {
          id: 1,
          email: null,
          phoneNumber,
          linkedId: null,
          linkPrecedence: LinkPrecedence.PRIMARY,
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date('2023-01-01'),
          deletedAt: null,
        },
      ];

      prismaMock.contact.findMany.mockResolvedValue(mockContacts);

      const result = await repository.findByPhoneNumber(phoneNumber);

      expect(prismaMock.contact.findMany).toHaveBeenCalledWith({
        where: {
          phoneNumber,
          deletedAt: null,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });
      expect(result).toHaveLength(1);
      expect(result[0]?.phoneNumber).toBe(phoneNumber);
    });
  });

  describe('findByEmailOrPhoneNumber', () => {
    it('should find contacts by email OR phone number', async () => {
      const email = 'test@example.com';
      const phoneNumber = '+1234567890';
      const mockContacts = [
        {
          id: 1,
          email,
          phoneNumber: null,
          linkedId: null,
          linkPrecedence: LinkPrecedence.PRIMARY,
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date('2023-01-01'),
          deletedAt: null,
        },
        {
          id: 2,
          email: null,
          phoneNumber,
          linkedId: 1,
          linkPrecedence: LinkPrecedence.SECONDARY,
          createdAt: new Date('2023-01-02'),
          updatedAt: new Date('2023-01-02'),
          deletedAt: null,
        },
      ];

      prismaMock.contact.findMany.mockResolvedValue(mockContacts);

      const result = await repository.findByEmailOrPhoneNumber(
        email,
        phoneNumber
      );

      expect(prismaMock.contact.findMany).toHaveBeenCalledWith({
        where: {
          OR: [{ email }, { phoneNumber }],
          deletedAt: null,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });
      expect(result).toHaveLength(2);
    });

    it('should return empty array when neither email nor phone provided', async () => {
      const result = await repository.findByEmailOrPhoneNumber();

      expect(result).toHaveLength(0);
      expect(prismaMock.contact.findMany).not.toHaveBeenCalled();
    });

    it('should find contacts by email only when phone not provided', async () => {
      const email = 'test@example.com';
      prismaMock.contact.findMany.mockResolvedValue([]);

      await repository.findByEmailOrPhoneNumber(email);

      expect(prismaMock.contact.findMany).toHaveBeenCalledWith({
        where: {
          OR: [{ email }],
          deletedAt: null,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });
    });
  });

  describe('findLinkedContacts', () => {
    it('should find all contacts linked to a primary contact', async () => {
      const primaryId = 1;
      const mockContacts = [
        {
          id: 1,
          email: 'primary@example.com',
          phoneNumber: null,
          linkedId: null,
          linkPrecedence: LinkPrecedence.PRIMARY,
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date('2023-01-01'),
          deletedAt: null,
        },
        {
          id: 2,
          email: null,
          phoneNumber: '+1234567890',
          linkedId: 1,
          linkPrecedence: LinkPrecedence.SECONDARY,
          createdAt: new Date('2023-01-02'),
          updatedAt: new Date('2023-01-02'),
          deletedAt: null,
        },
      ];

      prismaMock.contact.findMany.mockResolvedValue(mockContacts);

      const result = await repository.findLinkedContacts(primaryId);

      expect(prismaMock.contact.findMany).toHaveBeenCalledWith({
        where: {
          OR: [{ id: primaryId }, { linkedId: primaryId }],
          deletedAt: null,
        },
        orderBy: [{ linkPrecedence: 'asc' }, { createdAt: 'asc' }],
      });
      expect(result).toHaveLength(2);
    });
  });

  describe('create', () => {
    it('should create a new primary contact', async () => {
      const createData: CreateContactData = {
        email: 'new@example.com',
        phoneNumber: '+1234567890',
        linkPrecedence: LinkPrecedence.PRIMARY,
      };

      const mockCreatedContact = {
        id: 1,
        email: createData.email || null,
        phoneNumber: createData.phoneNumber || null,
        linkedId: null,
        linkPrecedence: LinkPrecedence.PRIMARY,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
        deletedAt: null,
      };

      prismaMock.contact.create.mockResolvedValue(mockCreatedContact);

      const result = await repository.create(createData);

      expect(prismaMock.contact.create).toHaveBeenCalledWith({
        data: {
          email: createData.email,
          phoneNumber: createData.phoneNumber,
          linkedId: null,
          linkPrecedence: createData.linkPrecedence,
        },
      });
      expect(result.id).toBe(1);
      expect(result.email).toBe(createData.email);
      expect(result.linkPrecedence).toBe(LinkPrecedence.PRIMARY);
    });

    it('should create a new secondary contact with linkedId', async () => {
      const createData: CreateContactData = {
        email: 'secondary@example.com',
        linkedId: 1,
        linkPrecedence: LinkPrecedence.SECONDARY,
      };

      const mockCreatedContact = {
        id: 2,
        email: createData.email || null,
        phoneNumber: null,
        linkedId: 1,
        linkPrecedence: LinkPrecedence.SECONDARY,
        createdAt: new Date('2023-01-02'),
        updatedAt: new Date('2023-01-02'),
        deletedAt: null,
      };

      prismaMock.contact.create.mockResolvedValue(mockCreatedContact);

      const result = await repository.create(createData);

      expect(prismaMock.contact.create).toHaveBeenCalledWith({
        data: {
          email: createData.email,
          phoneNumber: null,
          linkedId: createData.linkedId,
          linkPrecedence: createData.linkPrecedence,
        },
      });
      expect(result.linkedId).toBe(1);
      expect(result.linkPrecedence).toBe(LinkPrecedence.SECONDARY);
    });
  });

  describe('update', () => {
    it('should update contact with new data', async () => {
      const contactId = 2;
      const updateData: UpdateContactData = {
        linkedId: 1,
        linkPrecedence: LinkPrecedence.SECONDARY,
        updatedAt: new Date('2023-01-03'),
      };

      const mockUpdatedContact = {
        id: contactId,
        email: 'test@example.com',
        phoneNumber: null,
        linkedId: 1,
        linkPrecedence: LinkPrecedence.SECONDARY,
        createdAt: new Date('2023-01-01'),
        updatedAt: updateData.updatedAt,
        deletedAt: null,
      };

      prismaMock.contact.update.mockResolvedValue(mockUpdatedContact);

      const result = await repository.update(contactId, updateData);

      expect(prismaMock.contact.update).toHaveBeenCalledWith({
        where: { id: contactId },
        data: {
          linkedId: updateData.linkedId,
          linkPrecedence: updateData.linkPrecedence,
          updatedAt: updateData.updatedAt,
        },
      });
      expect(result.linkedId).toBe(1);
      expect(result.linkPrecedence).toBe(LinkPrecedence.SECONDARY);
    });
  });

  describe('findPrimaryContact', () => {
    it('should return the contact itself if it is primary', async () => {
      const contactId = 1;
      const mockPrimaryContact = {
        id: contactId,
        email: 'primary@example.com',
        phoneNumber: null,
        linkedId: null,
        linkPrecedence: LinkPrecedence.PRIMARY,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
        deletedAt: null,
      };

      prismaMock.contact.findUnique.mockResolvedValue(mockPrimaryContact);

      const result = await repository.findPrimaryContact(contactId);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(contactId);
      expect(result!.linkPrecedence).toBe(LinkPrecedence.PRIMARY);
    });

    it('should return the linked primary contact if contact is secondary', async () => {
      const contactId = 2;
      const primaryId = 1;

      const mockSecondaryContact = {
        id: contactId,
        email: 'secondary@example.com',
        phoneNumber: null,
        linkedId: primaryId,
        linkPrecedence: LinkPrecedence.SECONDARY,
        createdAt: new Date('2023-01-02'),
        updatedAt: new Date('2023-01-02'),
        deletedAt: null,
      };

      const mockPrimaryContact = {
        id: primaryId,
        email: 'primary@example.com',
        phoneNumber: null,
        linkedId: null,
        linkPrecedence: LinkPrecedence.PRIMARY,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
        deletedAt: null,
      };

      prismaMock.contact.findUnique
        .mockResolvedValueOnce(mockSecondaryContact)
        .mockResolvedValueOnce(mockPrimaryContact);

      const result = await repository.findPrimaryContact(contactId);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(primaryId);
      expect(result!.linkPrecedence).toBe(LinkPrecedence.PRIMARY);
    });

    it('should return null if contact does not exist', async () => {
      prismaMock.contact.findUnique.mockResolvedValue(null);

      const result = await repository.findPrimaryContact(999);

      expect(result).toBeNull();
    });

    it('should return null if contact is deleted', async () => {
      const mockDeletedContact = {
        id: 1,
        email: 'deleted@example.com',
        phoneNumber: null,
        linkedId: null,
        linkPrecedence: LinkPrecedence.PRIMARY,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
        deletedAt: new Date('2023-01-02'),
      };

      prismaMock.contact.findUnique.mockResolvedValue(mockDeletedContact);

      const result = await repository.findPrimaryContact(1);

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should find contact by ID', async () => {
      const contactId = 1;
      const mockContact = {
        id: contactId,
        email: 'test@example.com',
        phoneNumber: null,
        linkedId: null,
        linkPrecedence: LinkPrecedence.PRIMARY,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
        deletedAt: null,
      };

      prismaMock.contact.findUnique.mockResolvedValue(mockContact);

      const result = await repository.findById(contactId);

      expect(prismaMock.contact.findUnique).toHaveBeenCalledWith({
        where: { id: contactId },
      });
      expect(result).not.toBeNull();
      expect(result!.id).toBe(contactId);
    });

    it('should return null if contact does not exist', async () => {
      prismaMock.contact.findUnique.mockResolvedValue(null);

      const result = await repository.findById(999);

      expect(result).toBeNull();
    });

    it('should return null if contact is deleted', async () => {
      const mockDeletedContact = {
        id: 1,
        email: 'deleted@example.com',
        phoneNumber: null,
        linkedId: null,
        linkPrecedence: LinkPrecedence.PRIMARY,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
        deletedAt: new Date('2023-01-02'),
      };

      prismaMock.contact.findUnique.mockResolvedValue(mockDeletedContact);

      const result = await repository.findById(1);

      expect(result).toBeNull();
    });
  });

  describe('error scenarios', () => {
    it('should handle database errors during create operation', async () => {
      const createData: CreateContactData = {
        email: 'test@example.com',
        linkPrecedence: LinkPrecedence.PRIMARY,
      };

      const dbError = new Error('Database connection failed');
      prismaMock.contact.create.mockRejectedValue(dbError);

      await expect(repository.create(createData)).rejects.toThrow(
        'Database connection failed'
      );
    });

    it('should handle database errors during update operation', async () => {
      const updateData: UpdateContactData = {
        linkPrecedence: LinkPrecedence.SECONDARY,
        updatedAt: new Date(),
      };

      const dbError = new Error('Contact not found');
      prismaMock.contact.update.mockRejectedValue(dbError);

      await expect(repository.update(999, updateData)).rejects.toThrow(
        'Contact not found'
      );
    });

    it('should handle database errors during find operations', async () => {
      const dbError = new Error('Database timeout');
      prismaMock.contact.findMany.mockRejectedValue(dbError);

      await expect(repository.findByEmail('test@example.com')).rejects.toThrow(
        'Database timeout'
      );
    });
  });
});
