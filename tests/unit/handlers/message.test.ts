// Jest globals are available globally, no need to import
import { MessageHandler } from '@/handlers/message.js';
import { DatabaseService } from '@/services/database.js';
import { MediaService } from '@/services/media.js';
import type { WAMessage } from '@whiskeysockets/baileys';
import type { Config } from '@/types/index.js';
import { MessageType } from '@/types/index.js';

// Mock services
const mockDatabaseService = {
  createMessage: jest.fn(),
  updateMessage: jest.fn(),
  deleteMessage: jest.fn(),
  getMessageById: jest.fn(),
  createMessageEvent: jest.fn(),
} as unknown as DatabaseService;

const mockMediaService = {
  processMessageMedia: jest.fn(),
} as unknown as MediaService;

const mockConfig: Config = {
  bot: { name: 'test', usePairingCode: false, autoReconnect: true },
  database: { path: ':memory:' },
  web: { enabled: true, host: '127.0.0.1', port: 3000, authEnabled: true, defaultDays: 7 },
  jwt: { secret: 'test-secret-key-that-is-long-enough', expiresIn: '24h' },
  media: { downloadEnabled: true, maxSizeMB: 100, compressionEnabled: true },
  logging: { level: 'info', maxFiles: 10, maxSize: '10m' },
  dataRetention: { days: 90, autoCleanupEnabled: true },
  security: { rateLimitWindowMs: 900000, rateLimitMaxRequests: 100, corsOrigin: 'http://localhost:5173' }
};

describe('MessageHandler', () => {
  let messageHandler: MessageHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    messageHandler = new MessageHandler(mockDatabaseService, mockMediaService, mockConfig);
  });

  describe('processMessage', () => {
    const mockWAMessage: WAMessage = {
      key: {
        id: 'test-message-id',
        remoteJid: 'test-chat@g.us',
        fromMe: false,
      },
      message: {
        conversation: 'Hello, world!'
      },
      messageTimestamp: 1640995200,
    };

    it('should process a text message successfully', async () => {
      (mockDatabaseService.createMessage as jest.Mock).mockResolvedValue({
        id: 'test-message-id',
        content: 'Hello, world!',
        messageType: MessageType.TEXT,
      });

      await messageHandler.processMessage(mockWAMessage);

      expect(mockDatabaseService.createMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-message-id',
          content: 'Hello, world!',
          messageType: MessageType.TEXT,
          isFromMe: false,
        })
      );
    });

    it('should handle image messages', async () => {
      const imageMessage: WAMessage = {
        ...mockWAMessage,
        message: {
          imageMessage: {
            caption: 'Test image',
            mimetype: 'image/jpeg',
            fileLength: 1024,
          }
        }
      };

      (mockDatabaseService.createMessage as jest.Mock).mockResolvedValue({
        id: 'test-message-id',
        messageType: MessageType.IMAGE,
      });

      await messageHandler.processMessage(imageMessage);

      expect(mockDatabaseService.createMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          messageType: MessageType.IMAGE,
          content: 'Test image',
          mediaType: 'image',
          mediaMimeType: 'image/jpeg',
          mediaSize: 1024,
        })
      );
    });

    it('should process media when enabled', async () => {
      const imageMessage: WAMessage = {
        ...mockWAMessage,
        message: {
          imageMessage: {
            mimetype: 'image/jpeg',
            fileLength: 1024,
          }
        }
      };

      const mockMessage = {
        id: 'test-message-id',
        messageType: MessageType.IMAGE,
        mediaPath: 'images/test.jpg',
        mediaType: 'image',
      };

      (mockDatabaseService.createMessage as jest.Mock).mockResolvedValue(mockMessage);

      await messageHandler.processMessage(imageMessage);

      expect(mockMediaService.processMessageMedia).toHaveBeenCalledWith(
        imageMessage,
        mockMessage
      );
    });

    it('should handle messages without key data gracefully', async () => {
      const invalidMessage: WAMessage = {
        key: {},
      } as WAMessage;

      // Should not throw an error
      await expect(messageHandler.processMessage(invalidMessage)).resolves.not.toThrow();
      
      // Should not call database methods
      expect(mockDatabaseService.createMessage).not.toHaveBeenCalled();
    });

    it('should extract phone number from JID correctly', async () => {
      const messageWithPhone: WAMessage = {
        ...mockWAMessage,
        key: {
          ...mockWAMessage.key,
          remoteJid: '1234567890@s.whatsapp.net',
        }
      };

      (mockDatabaseService.createMessage as jest.Mock).mockResolvedValue({});

      await messageHandler.processMessage(messageWithPhone);

      expect(mockDatabaseService.createMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          chatId: '1234567890@s.whatsapp.net',
        })
      );
    });

    it('should handle forwarded messages', async () => {
      const forwardedMessage: WAMessage = {
        ...mockWAMessage,
        message: {
          extendedTextMessage: {
            text: 'Forwarded message',
            contextInfo: {
              isForwarded: true,
              forwardedNewsletterMessageInfo: {
                newsletterName: 'Test Newsletter'
              }
            }
          }
        }
      };

      (mockDatabaseService.createMessage as jest.Mock).mockResolvedValue({});

      await messageHandler.processMessage(forwardedMessage);

      expect(mockDatabaseService.createMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Forwarded message',
          isForwarded: true,
          forwardedFrom: 'Test Newsletter',
        })
      );
    });

    it('should handle quoted messages', async () => {
      const quotedMessage: WAMessage = {
        ...mockWAMessage,
        message: {
          extendedTextMessage: {
            text: 'Reply to message',
            contextInfo: {
              stanzaId: 'quoted-message-id'
            }
          }
        }
      };

      (mockDatabaseService.createMessage as jest.Mock).mockResolvedValue({});

      await messageHandler.processMessage(quotedMessage);

      expect(mockDatabaseService.createMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Reply to message',
          quotedMessageId: 'quoted-message-id',
        })
      );
    });
  });

  describe('processMessageUpdate', () => {
    const mockUpdate = {
      key: {
        id: 'test-message-id',
        remoteJid: 'test-chat@g.us',
      },
      update: {
        message: {
          conversation: 'Updated message content'
        }
      }
    };

    it('should handle message edits', async () => {
      const existingMessage = {
        id: 'test-message-id',
        content: 'Original content',
        chatId: 'test-chat@g.us',
      };

      (mockDatabaseService.getMessageById as jest.Mock).mockResolvedValue(existingMessage);
      (mockDatabaseService.updateMessage as jest.Mock).mockResolvedValue({});
      (mockDatabaseService.createMessageEvent as jest.Mock).mockResolvedValue({});

      await messageHandler.processMessageUpdate(mockUpdate);

      expect(mockDatabaseService.updateMessage).toHaveBeenCalledWith(
        'test-message-id',
        expect.objectContaining({
          content: 'Updated message content'
        })
      );

      expect(mockDatabaseService.createMessageEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: 'test-message-id',
          eventType: 'edited',
          oldContent: 'Original content',
          newContent: 'Updated message content',
        })
      );
    });

    it('should handle message deletions', async () => {
      const deleteUpdate = {
        key: {
          id: 'test-message-id',
        },
        update: {
          messageStubType: 5, // REVOKE stub type
        }
      };

      const existingMessage = {
        id: 'test-message-id',
        content: 'Message to delete',
        chatId: 'test-chat@g.us',
      };

      (mockDatabaseService.getMessageById as jest.Mock).mockResolvedValue(existingMessage);
      (mockDatabaseService.createMessageEvent as jest.Mock).mockResolvedValue({});

      await messageHandler.processMessageUpdate(deleteUpdate);

      expect(mockDatabaseService.createMessageEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: 'test-message-id',
          eventType: 'deleted',
          oldContent: 'Message to delete',
        })
      );
    });

    it('should ignore updates for non-existent messages', async () => {
      (mockDatabaseService.getMessageById as jest.Mock).mockResolvedValue(null);

      await messageHandler.processMessageUpdate(mockUpdate);

      expect(mockDatabaseService.updateMessage).not.toHaveBeenCalled();
      expect(mockDatabaseService.createMessageEvent).not.toHaveBeenCalled();
    });
  });

  describe('processMessageReaction', () => {
    const mockReaction = {
      key: {
        id: 'test-message-id',
        remoteJid: 'test-chat@g.us',
        participant: 'reactor@s.whatsapp.net',
      },
      reaction: {
        text: '👍'
      }
    };

    it('should add reactions to messages', async () => {
      const existingMessage = {
        id: 'test-message-id',
        reactions: '[]',
      };

      (mockDatabaseService.getMessageById as jest.Mock).mockResolvedValue(existingMessage);
      (mockDatabaseService.updateMessage as jest.Mock).mockResolvedValue({});
      (mockDatabaseService.createMessageEvent as jest.Mock).mockResolvedValue({});

      await messageHandler.processMessageReaction(mockReaction);

      expect(mockDatabaseService.updateMessage).toHaveBeenCalledWith(
        'test-message-id',
        expect.objectContaining({
          reactions: expect.stringContaining('👍')
        })
      );

      expect(mockDatabaseService.createMessageEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'reaction_added',
          newContent: '👍',
        })
      );
    });

    it('should remove reactions when reaction is null', async () => {
      const removeReaction = {
        ...mockReaction,
        reaction: null
      };

      const existingMessage = {
        id: 'test-message-id',
        reactions: JSON.stringify([{
          emoji: '👍',
          sender: 'reactor@s.whatsapp.net',
          timestamp: 1640995200
        }]),
      };

      (mockDatabaseService.getMessageById as jest.Mock).mockResolvedValue(existingMessage);
      (mockDatabaseService.updateMessage as jest.Mock).mockResolvedValue({});
      (mockDatabaseService.createMessageEvent as jest.Mock).mockResolvedValue({});

      await messageHandler.processMessageReaction(removeReaction);

      expect(mockDatabaseService.updateMessage).toHaveBeenCalledWith(
        'test-message-id',
        expect.objectContaining({
          reactions: '[]'
        })
      );

      expect(mockDatabaseService.createMessageEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'reaction_removed',
        })
      );
    });

    it('should ignore reactions for non-existent messages', async () => {
      (mockDatabaseService.getMessageById as jest.Mock).mockResolvedValue(null);

      await messageHandler.processMessageReaction(mockReaction);

      expect(mockDatabaseService.updateMessage).not.toHaveBeenCalled();
      expect(mockDatabaseService.createMessageEvent).not.toHaveBeenCalled();
    });
  });
});
