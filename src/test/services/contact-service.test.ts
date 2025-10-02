/**
 * Unit tests for ContactService
 * Tests the main business logic for contact identification and management
 */

import { ContactService } from '../../services/contact-service';
import {
  ContactLinkingEngine,
  StrategyExecutionResult,
} from '../../services/contact-linking-engine';
import { ContactRepository } from '../../repositories';
import { Contact, ContactLinkingStrategy, LinkPrecedence } from '../../types';
import { IdentifyRequest, IdentifyResponse } from '../../types/api.types';

// Mock ContactRepository
const mockContactRepository: jest.Mocked<ContactRepository> = {
  findByEmail: jest.fn(),
  findByPhoneNumber: jest.fn(),
  findByEmailOrPhoneNumber: jest.fn(),
  findLinkedContacts: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  findPrimaryContact: jest.fn(),
  findById: jest.fn(),
};

// Mock ContactLinkingEngine
const mockContactLinkingEngine: jest.Mocked<ContactLinkingEngine> = {
  determineContactStrategy: jest.fn(),
  executeStrategy: jest.fn(),
} as any;

describe('ContactService', () => {
  let contactService: ContactService;

  beforeEach(() => {
    jest.clearAllMocks();
    contactService = new ContactService(
      mockContactRepository,
      mockContactLinkingEngine
    );
  });

  describe('identifyContact', () => {
    it('should successfully identify and return contact for new email', async () => {
      const request: IdentifyRequest = {
        email: 'new@example.com',
        phoneNumber: '+1234567890',
      };

      const primaryContact: Contact = {
        id: 1,
        email: 'new@example.com',
        phoneNumber: '+1234567890',
        linkedId: null,
        linkPrecedence: LinkPrecedence.PRIMARY,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
        deletedAt: null,
      };

      const strategyResult: StrategyExecutionResult = {
        primaryContact,
        allLinkedContacts: [primaryContact],
      };

      mockContactRepository.findByEmailOrPhoneNumber.mockResolvedValue([]);
      mockContactLinkingEngine.determineContactStrategy.mockReturnValue(
        ContactLinkingStrategy.CREATE_NEW_PRIMARY
      );
      mockContactLinkingEngine.executeStrategy.mockResolvedValue(
        strategyResult
      );

      const result = await contactService.identifyContact(request);

      expect(
        mockContactRepository.findByEmailOrPhoneNumber
      ).toHaveBeenCalledWith('new@example.com', '+1234567890');
      expect(
        mockContactLinkingEngine.determineContactStrategy
      ).toHaveBeenCalledWith([], request);
      expect(mockContactLinkingEngine.executeStrategy).toHaveBeenCalledWith(
        ContactLinkingStrategy.CREATE_NEW_PRIMARY,
        [],
        request
      );

      const expected: IdentifyResponse = {
        contact: {
          primaryContactId: 1,
          emails: ['new@example.com'],
          phoneNumbers: ['+1234567890'],
          secondaryContactIds: [],
        },
      };

      expect(result).toEqual(expected);
    });

    it('should successfully identify and return existing contact with linked contacts', async () => {
      const request: IdentifyRequest = {
        email: 'existing@example.com',
      };

      const primaryContact: Contact = {
        id: 1,
        email: 'existing@example.com',
        phoneNumber: '+1111111111',
        linkedId: null,
        linkPrecedence: LinkPrecedence.PRIMARY,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
        deletedAt: null,
      };

      const secondaryContact1: Contact = {
        id: 2,
        email: 'existing@example.com',
        phoneNumber: '+2222222222',
        linkedId: 1,
        linkPrecedence: LinkPrecedence.SECONDARY,
        createdAt: new Date('2023-01-02'),
        updatedAt: new Date('2023-01-02'),
        deletedAt: null,
      };

      const secondaryContact2: Contact = {
        id: 3,
        email: 'another@example.com',
        phoneNumber: '+1111111111',
        linkedId: 1,
        linkPrecedence: LinkPrecedence.SECONDARY,
        createdAt: new Date('2023-01-03'),
        updatedAt: new Date('2023-01-03'),
        deletedAt: null,
      };

      const strategyResult: StrategyExecutionResult = {
        primaryContact,
        allLinkedContacts: [
          primaryContact,
          secondaryContact1,
          secondaryContact2,
        ],
      };

      mockContactRepository.findByEmailOrPhoneNumber.mockResolvedValue([
        primaryContact,
      ]);
      mockContactLinkingEngine.determineContactStrategy.mockReturnValue(
        ContactLinkingStrategy.RETURN_EXISTING
      );
      mockContactLinkingEngine.executeStrategy.mockResolvedValue(
        strategyResult
      );

      const result = await contactService.identifyContact(request);

      const expected: IdentifyResponse = {
        contact: {
          primaryContactId: 1,
          emails: ['existing@example.com', 'another@example.com'],
          phoneNumbers: ['+1111111111', '+2222222222'],
          secondaryContactIds: [2, 3],
        },
      };

      expect(result).toEqual(expected);
    });

    it('should handle contact linking when multiple primaries exist', async () => {
      const request: IdentifyRequest = {
        email: 'user@example.com',
        phoneNumber: '+1234567890',
      };

      const olderPrimary: Contact = {
        id: 1,
        email: 'user@example.com',
        phoneNumber: null,
        linkedId: null,
        linkPrecedence: LinkPrecedence.PRIMARY,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
        deletedAt: null,
      };

      const newerPrimary: Contact = {
        id: 2,
        email: null,
        phoneNumber: '+1234567890',
        linkedId: 1, // Now linked to the older primary
        linkPrecedence: LinkPrecedence.SECONDARY, // Converted to secondary
        createdAt: new Date('2023-01-02'),
        updatedAt: new Date('2023-01-02'),
        deletedAt: null,
      };

      const newSecondary: Contact = {
        id: 3,
        email: 'user@example.com',
        phoneNumber: '+1234567890',
        linkedId: 1,
        linkPrecedence: LinkPrecedence.SECONDARY,
        createdAt: new Date('2023-01-03'),
        updatedAt: new Date('2023-01-03'),
        deletedAt: null,
      };

      const strategyResult: StrategyExecutionResult = {
        primaryContact: olderPrimary,
        allLinkedContacts: [olderPrimary, newerPrimary, newSecondary],
      };

      mockContactRepository.findByEmailOrPhoneNumber.mockResolvedValue([
        olderPrimary,
        newerPrimary,
      ]);
      mockContactLinkingEngine.determineContactStrategy.mockReturnValue(
        ContactLinkingStrategy.LINK_EXISTING_PRIMARIES
      );
      mockContactLinkingEngine.executeStrategy.mockResolvedValue(
        strategyResult
      );

      const result = await contactService.identifyContact(request);

      const expected: IdentifyResponse = {
        contact: {
          primaryContactId: 1,
          emails: ['user@example.com'],
          phoneNumbers: ['+1234567890'],
          secondaryContactIds: [2, 3],
        },
      };

      expect(result).toEqual(expected);
    });

    it('should handle request with only email', async () => {
      const request: IdentifyRequest = {
        email: 'only-email@example.com',
      };

      const primaryContact: Contact = {
        id: 1,
        email: 'only-email@example.com',
        phoneNumber: null,
        linkedId: null,
        linkPrecedence: LinkPrecedence.PRIMARY,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
        deletedAt: null,
      };

      const strategyResult: StrategyExecutionResult = {
        primaryContact,
        allLinkedContacts: [primaryContact],
      };

      mockContactRepository.findByEmailOrPhoneNumber.mockResolvedValue([]);
      mockContactLinkingEngine.determineContactStrategy.mockReturnValue(
        ContactLinkingStrategy.CREATE_NEW_PRIMARY
      );
      mockContactLinkingEngine.executeStrategy.mockResolvedValue(
        strategyResult
      );

      const result = await contactService.identifyContact(request);

      expect(
        mockContactRepository.findByEmailOrPhoneNumber
      ).toHaveBeenCalledWith('only-email@example.com', undefined);

      const expected: IdentifyResponse = {
        contact: {
          primaryContactId: 1,
          emails: ['only-email@example.com'],
          phoneNumbers: [],
          secondaryContactIds: [],
        },
      };

      expect(result).toEqual(expected);
    });

    it('should handle request with only phone number', async () => {
      const request: IdentifyRequest = {
        phoneNumber: '+1234567890',
      };

      const primaryContact: Contact = {
        id: 1,
        email: null,
        phoneNumber: '+1234567890',
        linkedId: null,
        linkPrecedence: LinkPrecedence.PRIMARY,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
        deletedAt: null,
      };

      const strategyResult: StrategyExecutionResult = {
        primaryContact,
        allLinkedContacts: [primaryContact],
      };

      mockContactRepository.findByEmailOrPhoneNumber.mockResolvedValue([]);
      mockContactLinkingEngine.determineContactStrategy.mockReturnValue(
        ContactLinkingStrategy.CREATE_NEW_PRIMARY
      );
      mockContactLinkingEngine.executeStrategy.mockResolvedValue(
        strategyResult
      );

      const result = await contactService.identifyContact(request);

      expect(
        mockContactRepository.findByEmailOrPhoneNumber
      ).toHaveBeenCalledWith(undefined, '+1234567890');

      const expected: IdentifyResponse = {
        contact: {
          primaryContactId: 1,
          emails: [],
          phoneNumbers: ['+1234567890'],
          secondaryContactIds: [],
        },
      };

      expect(result).toEqual(expected);
    });

    it('should throw error when neither email nor phoneNumber is provided', async () => {
      const request: IdentifyRequest = {};

      await expect(contactService.identifyContact(request)).rejects.toThrow(
        'Either email or phoneNumber must be provided'
      );

      expect(
        mockContactRepository.findByEmailOrPhoneNumber
      ).not.toHaveBeenCalled();
    });

    it('should handle duplicate emails and phone numbers correctly', async () => {
      const request: IdentifyRequest = {
        email: 'duplicate@example.com',
      };

      const primaryContact: Contact = {
        id: 1,
        email: 'duplicate@example.com',
        phoneNumber: '+1111111111',
        linkedId: null,
        linkPrecedence: LinkPrecedence.PRIMARY,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
        deletedAt: null,
      };

      // Secondary contact with duplicate email (should not appear twice in response)
      const secondaryContact: Contact = {
        id: 2,
        email: 'duplicate@example.com',
        phoneNumber: '+2222222222',
        linkedId: 1,
        linkPrecedence: LinkPrecedence.SECONDARY,
        createdAt: new Date('2023-01-02'),
        updatedAt: new Date('2023-01-02'),
        deletedAt: null,
      };

      const strategyResult: StrategyExecutionResult = {
        primaryContact,
        allLinkedContacts: [primaryContact, secondaryContact],
      };

      mockContactRepository.findByEmailOrPhoneNumber.mockResolvedValue([
        primaryContact,
      ]);
      mockContactLinkingEngine.determineContactStrategy.mockReturnValue(
        ContactLinkingStrategy.RETURN_EXISTING
      );
      mockContactLinkingEngine.executeStrategy.mockResolvedValue(
        strategyResult
      );

      const result = await contactService.identifyContact(request);

      const expected: IdentifyResponse = {
        contact: {
          primaryContactId: 1,
          emails: ['duplicate@example.com'], // Should appear only once
          phoneNumbers: ['+1111111111', '+2222222222'],
          secondaryContactIds: [2],
        },
      };

      expect(result).toEqual(expected);
    });
  });

  describe('createPrimaryContact', () => {
    it('should create primary contact with email and phone', async () => {
      const email = 'test@example.com';
      const phoneNumber = '+1234567890';

      const createdContact: Contact = {
        id: 1,
        email,
        phoneNumber,
        linkedId: null,
        linkPrecedence: LinkPrecedence.PRIMARY,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      mockContactRepository.create.mockResolvedValue(createdContact);

      const result = await contactService.createPrimaryContact(
        email,
        phoneNumber
      );

      expect(mockContactRepository.create).toHaveBeenCalledWith({
        email,
        phoneNumber,
        linkPrecedence: LinkPrecedence.PRIMARY,
      });

      expect(result).toEqual(createdContact);
    });

    it('should create primary contact with only email', async () => {
      const email = 'test@example.com';

      const createdContact: Contact = {
        id: 1,
        email,
        phoneNumber: null,
        linkedId: null,
        linkPrecedence: LinkPrecedence.PRIMARY,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      mockContactRepository.create.mockResolvedValue(createdContact);

      const result = await contactService.createPrimaryContact(email);

      expect(mockContactRepository.create).toHaveBeenCalledWith({
        email,
        phoneNumber: undefined,
        linkPrecedence: LinkPrecedence.PRIMARY,
      });

      expect(result).toEqual(createdContact);
    });

    it('should create primary contact with only phone number', async () => {
      const phoneNumber = '+1234567890';

      const createdContact: Contact = {
        id: 1,
        email: null,
        phoneNumber,
        linkedId: null,
        linkPrecedence: LinkPrecedence.PRIMARY,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      mockContactRepository.create.mockResolvedValue(createdContact);

      const result = await contactService.createPrimaryContact(
        undefined,
        phoneNumber
      );

      expect(mockContactRepository.create).toHaveBeenCalledWith({
        email: undefined,
        phoneNumber,
        linkPrecedence: LinkPrecedence.PRIMARY,
      });

      expect(result).toEqual(createdContact);
    });

    it('should throw error when neither email nor phoneNumber is provided', async () => {
      await expect(contactService.createPrimaryContact()).rejects.toThrow(
        'Either email or phoneNumber must be provided'
      );

      expect(mockContactRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('linkContacts', () => {
    it('should successfully link secondary contact to primary', async () => {
      const primaryId = 1;
      const secondaryId = 2;

      const primaryContact: Contact = {
        id: primaryId,
        email: 'primary@example.com',
        phoneNumber: '+1111111111',
        linkedId: null,
        linkPrecedence: LinkPrecedence.PRIMARY,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
        deletedAt: null,
      };

      const updatedSecondary: Contact = {
        id: secondaryId,
        email: 'secondary@example.com',
        phoneNumber: '+2222222222',
        linkedId: primaryId,
        linkPrecedence: LinkPrecedence.SECONDARY,
        createdAt: new Date('2023-01-02'),
        updatedAt: new Date(),
        deletedAt: null,
      };

      mockContactRepository.findById.mockResolvedValue(primaryContact);
      mockContactRepository.update.mockResolvedValue(updatedSecondary);

      await contactService.linkContacts(primaryId, secondaryId);

      expect(mockContactRepository.findById).toHaveBeenCalledWith(primaryId);
      expect(mockContactRepository.update).toHaveBeenCalledWith(secondaryId, {
        linkedId: primaryId,
        linkPrecedence: LinkPrecedence.SECONDARY,
        updatedAt: expect.any(Date),
      });
    });

    it('should throw error when primary contact not found', async () => {
      const primaryId = 1;
      const secondaryId = 2;

      mockContactRepository.findById.mockResolvedValue(null);

      await expect(
        contactService.linkContacts(primaryId, secondaryId)
      ).rejects.toThrow(`Primary contact with ID ${primaryId} not found`);

      expect(mockContactRepository.update).not.toHaveBeenCalled();
    });

    it('should throw error when contact is not primary', async () => {
      const primaryId = 1;
      const secondaryId = 2;

      const nonPrimaryContact: Contact = {
        id: primaryId,
        email: 'test@example.com',
        phoneNumber: '+1111111111',
        linkedId: 3,
        linkPrecedence: LinkPrecedence.SECONDARY,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
        deletedAt: null,
      };

      mockContactRepository.findById.mockResolvedValue(nonPrimaryContact);

      await expect(
        contactService.linkContacts(primaryId, secondaryId)
      ).rejects.toThrow(
        `Contact with ID ${primaryId} is not a primary contact`
      );

      expect(mockContactRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('findContactsByEmailOrPhone', () => {
    it('should find contacts by email', async () => {
      const email = 'test@example.com';
      const contacts: Contact[] = [
        {
          id: 1,
          email,
          phoneNumber: null,
          linkedId: null,
          linkPrecedence: LinkPrecedence.PRIMARY,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
      ];

      mockContactRepository.findByEmailOrPhoneNumber.mockResolvedValue(
        contacts
      );

      const result = await contactService.findContactsByEmailOrPhone(email);

      expect(
        mockContactRepository.findByEmailOrPhoneNumber
      ).toHaveBeenCalledWith(email, undefined);
      expect(result).toEqual(contacts);
    });

    it('should find contacts by phone number', async () => {
      const phoneNumber = '+1234567890';
      const contacts: Contact[] = [
        {
          id: 1,
          email: null,
          phoneNumber,
          linkedId: null,
          linkPrecedence: LinkPrecedence.PRIMARY,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
      ];

      mockContactRepository.findByEmailOrPhoneNumber.mockResolvedValue(
        contacts
      );

      const result = await contactService.findContactsByEmailOrPhone(
        undefined,
        phoneNumber
      );

      expect(
        mockContactRepository.findByEmailOrPhoneNumber
      ).toHaveBeenCalledWith(undefined, phoneNumber);
      expect(result).toEqual(contacts);
    });

    it('should find contacts by both email and phone', async () => {
      const email = 'test@example.com';
      const phoneNumber = '+1234567890';
      const contacts: Contact[] = [
        {
          id: 1,
          email,
          phoneNumber,
          linkedId: null,
          linkPrecedence: LinkPrecedence.PRIMARY,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
      ];

      mockContactRepository.findByEmailOrPhoneNumber.mockResolvedValue(
        contacts
      );

      const result = await contactService.findContactsByEmailOrPhone(
        email,
        phoneNumber
      );

      expect(
        mockContactRepository.findByEmailOrPhoneNumber
      ).toHaveBeenCalledWith(email, phoneNumber);
      expect(result).toEqual(contacts);
    });

    it('should return empty array when neither email nor phone provided', async () => {
      const result = await contactService.findContactsByEmailOrPhone();

      expect(result).toEqual([]);
      expect(
        mockContactRepository.findByEmailOrPhoneNumber
      ).not.toHaveBeenCalled();
    });
  });

  describe('Response Formatting', () => {
    it('should format response with primary contact data first', async () => {
      const primaryContact: Contact = {
        id: 1,
        email: 'primary@example.com',
        phoneNumber: '+1111111111',
        linkedId: null,
        linkPrecedence: LinkPrecedence.PRIMARY,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
        deletedAt: null,
      };

      const secondaryContact: Contact = {
        id: 2,
        email: 'secondary@example.com',
        phoneNumber: '+2222222222',
        linkedId: 1,
        linkPrecedence: LinkPrecedence.SECONDARY,
        createdAt: new Date('2023-01-02'),
        updatedAt: new Date('2023-01-02'),
        deletedAt: null,
      };

      const strategyResult: StrategyExecutionResult = {
        primaryContact,
        allLinkedContacts: [primaryContact, secondaryContact],
      };

      const request: IdentifyRequest = { email: 'primary@example.com' };

      mockContactRepository.findByEmailOrPhoneNumber.mockResolvedValue([
        primaryContact,
      ]);
      mockContactLinkingEngine.determineContactStrategy.mockReturnValue(
        ContactLinkingStrategy.RETURN_EXISTING
      );
      mockContactLinkingEngine.executeStrategy.mockResolvedValue(
        strategyResult
      );

      const result = await contactService.identifyContact(request);

      // Primary contact's email and phone should be first
      expect(result.contact.emails[0]).toBe('primary@example.com');
      expect(result.contact.phoneNumbers[0]).toBe('+1111111111');
      expect(result.contact.primaryContactId).toBe(1);
      expect(result.contact.secondaryContactIds).toEqual([2]);
    });

    it('should handle contacts with null email/phone values', async () => {
      const primaryContact: Contact = {
        id: 1,
        email: 'primary@example.com',
        phoneNumber: null,
        linkedId: null,
        linkPrecedence: LinkPrecedence.PRIMARY,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
        deletedAt: null,
      };

      const secondaryContact: Contact = {
        id: 2,
        email: null,
        phoneNumber: '+2222222222',
        linkedId: 1,
        linkPrecedence: LinkPrecedence.SECONDARY,
        createdAt: new Date('2023-01-02'),
        updatedAt: new Date('2023-01-02'),
        deletedAt: null,
      };

      const strategyResult: StrategyExecutionResult = {
        primaryContact,
        allLinkedContacts: [primaryContact, secondaryContact],
      };

      const request: IdentifyRequest = { email: 'primary@example.com' };

      mockContactRepository.findByEmailOrPhoneNumber.mockResolvedValue([
        primaryContact,
      ]);
      mockContactLinkingEngine.determineContactStrategy.mockReturnValue(
        ContactLinkingStrategy.RETURN_EXISTING
      );
      mockContactLinkingEngine.executeStrategy.mockResolvedValue(
        strategyResult
      );

      const result = await contactService.identifyContact(request);

      expect(result.contact.emails).toEqual(['primary@example.com']);
      expect(result.contact.phoneNumbers).toEqual(['+2222222222']);
      expect(result.contact.secondaryContactIds).toEqual([2]);
    });
  });

  describe('Error Handling', () => {
    it('should propagate repository errors', async () => {
      const request: IdentifyRequest = {
        email: 'test@example.com',
      };

      const repositoryError = new Error('Database connection failed');
      mockContactRepository.findByEmailOrPhoneNumber.mockRejectedValue(
        repositoryError
      );

      await expect(contactService.identifyContact(request)).rejects.toThrow(
        'Database connection failed'
      );
    });

    it('should propagate linking engine errors', async () => {
      const request: IdentifyRequest = {
        email: 'test@example.com',
      };

      mockContactRepository.findByEmailOrPhoneNumber.mockResolvedValue([]);
      mockContactLinkingEngine.determineContactStrategy.mockReturnValue(
        ContactLinkingStrategy.CREATE_NEW_PRIMARY
      );

      const linkingError = new Error('Strategy execution failed');
      mockContactLinkingEngine.executeStrategy.mockRejectedValue(linkingError);

      await expect(contactService.identifyContact(request)).rejects.toThrow(
        'Strategy execution failed'
      );
    });
  });
});
