/**
 * Unit tests for ContactLinkingEngine
 * Tests strategy determination, execution logic, and edge cases
 */

import {
  ContactLinkingEngine,
  IdentifyRequest,
} from '../../services/contact-linking-engine';
import { ContactRepository } from '../../repositories';
import { Contact, ContactLinkingStrategy, LinkPrecedence } from '../../types';

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

describe('ContactLinkingEngine', () => {
  let linkingEngine: ContactLinkingEngine;

  beforeEach(() => {
    jest.clearAllMocks();
    linkingEngine = new ContactLinkingEngine(mockContactRepository);
  });

  describe('determineContactStrategy', () => {
    it('should return CREATE_NEW_PRIMARY when no existing contacts', () => {
      const request: IdentifyRequest = {
        email: 'test@example.com',
        phoneNumber: '+1234567890',
      };

      const strategy = linkingEngine.determineContactStrategy([], request);

      expect(strategy).toBe(ContactLinkingStrategy.CREATE_NEW_PRIMARY);
    });

    it('should return RETURN_EXISTING for exact match', () => {
      const existingContact: Contact = {
        id: 1,
        email: 'test@example.com',
        phoneNumber: '+1234567890',
        linkedId: null,
        linkPrecedence: LinkPrecedence.PRIMARY,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
        deletedAt: null,
      };

      const request: IdentifyRequest = {
        email: 'test@example.com',
        phoneNumber: '+1234567890',
      };

      const strategy = linkingEngine.determineContactStrategy(
        [existingContact],
        request
      );

      expect(strategy).toBe(ContactLinkingStrategy.RETURN_EXISTING);
    });

    it('should return LINK_EXISTING_PRIMARIES when multiple primaries exist', () => {
      const primary1: Contact = {
        id: 1,
        email: 'test1@example.com',
        phoneNumber: null,
        linkedId: null,
        linkPrecedence: LinkPrecedence.PRIMARY,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
        deletedAt: null,
      };

      const primary2: Contact = {
        id: 2,
        email: null,
        phoneNumber: '+1234567890',
        linkedId: null,
        linkPrecedence: LinkPrecedence.PRIMARY,
        createdAt: new Date('2023-01-02'),
        updatedAt: new Date('2023-01-02'),
        deletedAt: null,
      };

      const request: IdentifyRequest = {
        email: 'test1@example.com',
        phoneNumber: '+1234567890',
      };

      const strategy = linkingEngine.determineContactStrategy(
        [primary1, primary2],
        request
      );

      expect(strategy).toBe(ContactLinkingStrategy.LINK_EXISTING_PRIMARIES);
    });

    it('should return CREATE_SECONDARY for single primary contact', () => {
      const existingContact: Contact = {
        id: 1,
        email: 'existing@example.com',
        phoneNumber: null,
        linkedId: null,
        linkPrecedence: LinkPrecedence.PRIMARY,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
        deletedAt: null,
      };

      const request: IdentifyRequest = {
        email: 'existing@example.com',
        phoneNumber: '+1234567890',
      };

      const strategy = linkingEngine.determineContactStrategy(
        [existingContact],
        request
      );

      expect(strategy).toBe(ContactLinkingStrategy.CREATE_SECONDARY);
    });

    it('should return CREATE_SECONDARY for mixed primary and secondary contacts', () => {
      const primary: Contact = {
        id: 1,
        email: 'primary@example.com',
        phoneNumber: null,
        linkedId: null,
        linkPrecedence: LinkPrecedence.PRIMARY,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
        deletedAt: null,
      };

      const secondary: Contact = {
        id: 2,
        email: null,
        phoneNumber: '+1234567890',
        linkedId: 1,
        linkPrecedence: LinkPrecedence.SECONDARY,
        createdAt: new Date('2023-01-02'),
        updatedAt: new Date('2023-01-02'),
        deletedAt: null,
      };

      const request: IdentifyRequest = {
        email: 'primary@example.com',
        phoneNumber: '+9876543210',
      };

      const strategy = linkingEngine.determineContactStrategy(
        [primary, secondary],
        request
      );

      expect(strategy).toBe(ContactLinkingStrategy.CREATE_SECONDARY);
    });
  });

  describe('executeStrategy', () => {
    describe('CREATE_NEW_PRIMARY', () => {
      it('should create new primary contact', async () => {
        const request: IdentifyRequest = {
          email: 'new@example.com',
          phoneNumber: '+1234567890',
        };

        const createdContact: Contact = {
          id: 1,
          email: 'new@example.com',
          phoneNumber: '+1234567890',
          linkedId: null,
          linkPrecedence: LinkPrecedence.PRIMARY,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        };

        mockContactRepository.create.mockResolvedValue(createdContact);

        const result = await linkingEngine.executeStrategy(
          ContactLinkingStrategy.CREATE_NEW_PRIMARY,
          [],
          request
        );

        expect(mockContactRepository.create).toHaveBeenCalledWith({
          email: 'new@example.com',
          phoneNumber: '+1234567890',
          linkPrecedence: LinkPrecedence.PRIMARY,
        });

        expect(result).toEqual({
          primaryContact: createdContact,
          allLinkedContacts: [createdContact],
        });
      });
    });

    describe('RETURN_EXISTING', () => {
      it('should return existing contact tree', async () => {
        const existingContact: Contact = {
          id: 1,
          email: 'test@example.com',
          phoneNumber: '+1234567890',
          linkedId: null,
          linkPrecedence: LinkPrecedence.PRIMARY,
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date('2023-01-01'),
          deletedAt: null,
        };

        const linkedContact: Contact = {
          id: 2,
          email: null,
          phoneNumber: '+9876543210',
          linkedId: 1,
          linkPrecedence: LinkPrecedence.SECONDARY,
          createdAt: new Date('2023-01-02'),
          updatedAt: new Date('2023-01-02'),
          deletedAt: null,
        };

        const request: IdentifyRequest = {
          email: 'test@example.com',
          phoneNumber: '+1234567890',
        };

        mockContactRepository.findLinkedContacts.mockResolvedValue([
          existingContact,
          linkedContact,
        ]);

        const result = await linkingEngine.executeStrategy(
          ContactLinkingStrategy.RETURN_EXISTING,
          [existingContact],
          request
        );

        expect(result).toEqual({
          primaryContact: existingContact,
          allLinkedContacts: [existingContact, linkedContact],
        });
      });
    });

    describe('CREATE_SECONDARY', () => {
      it('should create secondary contact linked to existing primary', async () => {
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

        const newSecondary: Contact = {
          id: 2,
          email: 'primary@example.com',
          phoneNumber: '+1234567890',
          linkedId: 1,
          linkPrecedence: LinkPrecedence.SECONDARY,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        };

        const request: IdentifyRequest = {
          email: 'primary@example.com',
          phoneNumber: '+1234567890',
        };

        mockContactRepository.create.mockResolvedValue(newSecondary);
        mockContactRepository.findLinkedContacts.mockResolvedValue([
          primaryContact,
          newSecondary,
        ]);

        const result = await linkingEngine.executeStrategy(
          ContactLinkingStrategy.CREATE_SECONDARY,
          [primaryContact],
          request
        );

        expect(mockContactRepository.create).toHaveBeenCalledWith({
          email: 'primary@example.com',
          phoneNumber: '+1234567890',
          linkedId: 1,
          linkPrecedence: LinkPrecedence.SECONDARY,
        });

        expect(result).toEqual({
          primaryContact: primaryContact,
          allLinkedContacts: [primaryContact, newSecondary],
        });
      });
    });

    describe('LINK_EXISTING_PRIMARIES', () => {
      it('should link existing primaries by converting newer to secondary', async () => {
        const olderPrimary: Contact = {
          id: 1,
          email: 'older@example.com',
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
          linkedId: null,
          linkPrecedence: LinkPrecedence.PRIMARY,
          createdAt: new Date('2023-01-02'),
          updatedAt: new Date('2023-01-02'),
          deletedAt: null,
        };

        const newSecondary: Contact = {
          id: 3,
          email: 'older@example.com',
          phoneNumber: '+1234567890',
          linkedId: 1,
          linkPrecedence: LinkPrecedence.SECONDARY,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        };

        const request: IdentifyRequest = {
          email: 'older@example.com',
          phoneNumber: '+1234567890',
        };

        mockContactRepository.create.mockResolvedValue(newSecondary);
        mockContactRepository.update.mockResolvedValue(newerPrimary);
        mockContactRepository.findLinkedContacts
          .mockResolvedValueOnce([]) // No existing linked contacts for newer primary
          .mockResolvedValueOnce([olderPrimary, newerPrimary, newSecondary]); // Final result

        const result = await linkingEngine.executeStrategy(
          ContactLinkingStrategy.LINK_EXISTING_PRIMARIES,
          [olderPrimary, newerPrimary],
          request
        );

        // Verify newer primary was converted to secondary
        expect(mockContactRepository.update).toHaveBeenCalledWith(2, {
          linkedId: 1,
          linkPrecedence: LinkPrecedence.SECONDARY,
          updatedAt: expect.any(Date),
        });

        // Verify new secondary was created
        expect(mockContactRepository.create).toHaveBeenCalledWith({
          email: 'older@example.com',
          phoneNumber: '+1234567890',
          linkedId: 1,
          linkPrecedence: LinkPrecedence.SECONDARY,
        });

        expect(result.primaryContact).toEqual(olderPrimary);
      });

      it('should handle multiple primaries with existing secondaries', async () => {
        const olderPrimary: Contact = {
          id: 1,
          email: 'older@example.com',
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
          linkedId: null,
          linkPrecedence: LinkPrecedence.PRIMARY,
          createdAt: new Date('2023-01-02'),
          updatedAt: new Date('2023-01-02'),
          deletedAt: null,
        };

        const existingSecondary: Contact = {
          id: 3,
          email: null,
          phoneNumber: '+9876543210',
          linkedId: 2,
          linkPrecedence: LinkPrecedence.SECONDARY,
          createdAt: new Date('2023-01-03'),
          updatedAt: new Date('2023-01-03'),
          deletedAt: null,
        };

        const request: IdentifyRequest = {
          email: 'older@example.com',
          phoneNumber: '+1234567890',
        };

        mockContactRepository.findLinkedContacts
          .mockResolvedValueOnce([newerPrimary, existingSecondary]) // Linked to newer primary
          .mockResolvedValueOnce([
            olderPrimary,
            newerPrimary,
            existingSecondary,
          ]); // Final result

        await linkingEngine.executeStrategy(
          ContactLinkingStrategy.LINK_EXISTING_PRIMARIES,
          [olderPrimary, newerPrimary],
          request
        );

        // Verify existing secondary was updated to point to older primary
        expect(mockContactRepository.update).toHaveBeenCalledWith(3, {
          linkedId: 1,
          linkPrecedence: LinkPrecedence.SECONDARY,
          updatedAt: expect.any(Date),
        });
      });

      it('should throw error when less than 2 primaries provided', async () => {
        const singlePrimary: Contact = {
          id: 1,
          email: 'test@example.com',
          phoneNumber: null,
          linkedId: null,
          linkPrecedence: LinkPrecedence.PRIMARY,
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date('2023-01-01'),
          deletedAt: null,
        };

        const request: IdentifyRequest = {
          email: 'test@example.com',
          phoneNumber: '+1234567890',
        };

        await expect(
          linkingEngine.executeStrategy(
            ContactLinkingStrategy.LINK_EXISTING_PRIMARIES,
            [singlePrimary],
            request
          )
        ).rejects.toThrow('Expected at least 2 primary contacts for linking');
      });
    });

    it('should throw error for unknown strategy', async () => {
      const request: IdentifyRequest = {
        email: 'test@example.com',
      };

      await expect(
        linkingEngine.executeStrategy(
          'UNKNOWN_STRATEGY' as ContactLinkingStrategy,
          [],
          request
        )
      ).rejects.toThrow('Unknown strategy: UNKNOWN_STRATEGY');
    });
  });

  describe('Edge Cases', () => {
    it('should handle exact match with null values', () => {
      const existingContact: Contact = {
        id: 1,
        email: 'test@example.com',
        phoneNumber: null,
        linkedId: null,
        linkPrecedence: LinkPrecedence.PRIMARY,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
        deletedAt: null,
      };

      const request: IdentifyRequest = {
        email: 'test@example.com',
        // phoneNumber is undefined, should match null
      };

      const strategy = linkingEngine.determineContactStrategy(
        [existingContact],
        request
      );

      expect(strategy).toBe(ContactLinkingStrategy.RETURN_EXISTING);
    });

    it('should handle request with only email', () => {
      const request: IdentifyRequest = {
        email: 'test@example.com',
      };

      const strategy = linkingEngine.determineContactStrategy([], request);

      expect(strategy).toBe(ContactLinkingStrategy.CREATE_NEW_PRIMARY);
    });

    it('should handle request with only phone number', () => {
      const request: IdentifyRequest = {
        phoneNumber: '+1234567890',
      };

      const strategy = linkingEngine.determineContactStrategy([], request);

      expect(strategy).toBe(ContactLinkingStrategy.CREATE_NEW_PRIMARY);
    });

    it('should throw error when no primary contact found in contact chain', async () => {
      const secondaryContact: Contact = {
        id: 2,
        email: 'test@example.com',
        phoneNumber: null,
        linkedId: 1,
        linkPrecedence: LinkPrecedence.SECONDARY,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
        deletedAt: null,
      };

      const request: IdentifyRequest = {
        email: 'test@example.com',
        phoneNumber: '+1234567890',
      };

      mockContactRepository.findPrimaryContact.mockResolvedValue(null);

      await expect(
        linkingEngine.executeStrategy(
          ContactLinkingStrategy.CREATE_SECONDARY,
          [secondaryContact],
          request
        )
      ).rejects.toThrow('No primary contact found in the contact chain');
    });

    it('should handle RETURN_EXISTING when exact match not found', async () => {
      const existingContact: Contact = {
        id: 1,
        email: 'different@example.com',
        phoneNumber: '+1234567890',
        linkedId: null,
        linkPrecedence: LinkPrecedence.PRIMARY,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
        deletedAt: null,
      };

      const request: IdentifyRequest = {
        email: 'test@example.com',
        phoneNumber: '+1234567890',
      };

      await expect(
        linkingEngine.executeStrategy(
          ContactLinkingStrategy.RETURN_EXISTING,
          [existingContact],
          request
        )
      ).rejects.toThrow('Exact match not found in existing contacts');
    });
  });
});
