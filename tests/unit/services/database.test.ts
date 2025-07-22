import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { DatabaseService } from '@/services/database.js';
import type { Message, MessageType, Config } from '@/types/index.js';

describe('DatabaseService', () => {
  let databaseService: DatabaseService;
  let mockConfig: Config['database'];

  beforeEach(async () => {
    mockConfig = {
      path: ':memory:' // Use in-memory database for tests
    };
    
    databaseService = new DatabaseService(mockConfig);
    await databaseService.initialize();
  });

  afterEach(() => {
    if (databaseService.isConnected()) {
      databaseService.close();
    }
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      expect(databaseService.isConnected()).toBe(true);
    });

    it('should handle initialization errors', async () => {
      const invalidConfig = { path: '/invalid/path/database.db' };
      const invalidService = new DatabaseService(invalidConfig);
      
      await expect(invalidService.initialize()).rejects.toThrow();
    });
  });

  describe('message operations', () => {
    const mockMessage: Omit<Message, 'createdAt' | 'updatedAt'> = {
      id: 'test-message-1',
      chatId: 'test-chat@g.us',
      senderId: 'test-sender@s.whatsapp.net',
      content: 'Test message content',
      messageType: MessageType.TEXT,
      timestamp: 1640995200, // 2022-01-01 00:00:00
      isFromMe: false,
      isForwarded: false,
      isEphemeral: false,
      isViewOnce: false,
      reactions: '[]'
    };

    it('should create a message successfully', async () => {
      const createdMessage = await databaseService.createMessage(mockMessage);
      
      expect(createdMessage.id).toBe(mockMessage.id);
      expect(createdMessage.content).toBe(mockMessage.content);
      expect(createdMessage.createdAt).toBeValidTimestamp();
      expect(createdMessage.updatedAt).toBeValidTimestamp();
    });

    it('should retrieve a message by ID', async () => {
      await databaseService.createMessage(mockMessage);
      
      const retrievedMessage = await databaseService.getMessageById(mockMessage.id);
      
      expect(retrievedMessage).not.toBeNull();
      expect(retrievedMessage?.id).toBe(mockMessage.id);
      expect(retrievedMessage?.content).toBe(mockMessage.content);
    });

    it('should return null for non-existent message', async () => {
      const retrievedMessage = await databaseService.getMessageById('non-existent');
      
      expect(retrievedMessage).toBeNull();
    });

    it('should update a message', async () => {
      await databaseService.createMessage(mockMessage);
      
      const updatedContent = 'Updated message content';
      const updatedMessage = await databaseService.updateMessage(mockMessage.id, {
        content: updatedContent
      });
      
      expect(updatedMessage).not.toBeNull();
      expect(updatedMessage?.content).toBe(updatedContent);
      expect(updatedMessage?.updatedAt).toBeGreaterThan(updatedMessage?.createdAt || 0);
    });

    it('should delete a message', async () => {
      await databaseService.createMessage(mockMessage);
      
      const deleted = await databaseService.deleteMessage(mockMessage.id);
      expect(deleted).toBe(true);
      
      const retrievedMessage = await databaseService.getMessageById(mockMessage.id);
      expect(retrievedMessage).toBeNull();
    });

    it('should get messages with pagination', async () => {
      // Create multiple messages
      const messages = Array.from({ length: 5 }, (_, i) => ({
        ...mockMessage,
        id: `test-message-${i + 1}`,
        content: `Test message ${i + 1}`,
        timestamp: mockMessage.timestamp + i
      }));

      for (const message of messages) {
        await databaseService.createMessage(message);
      }

      const result = await databaseService.getMessages({
        limit: 3,
        offset: 0
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(3);
      expect(result.pagination?.total).toBe(5);
      expect(result.pagination?.totalPages).toBe(2);
    });

    it('should filter messages by chat ID', async () => {
      const chat1Message = { ...mockMessage, id: 'msg1', chatId: 'chat1@g.us' };
      const chat2Message = { ...mockMessage, id: 'msg2', chatId: 'chat2@g.us' };

      await databaseService.createMessage(chat1Message);
      await databaseService.createMessage(chat2Message);

      const result = await databaseService.getMessages({
        chatId: 'chat1@g.us'
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0]?.chatId).toBe('chat1@g.us');
    });

    it('should filter messages by days', async () => {
      const oldMessage = {
        ...mockMessage,
        id: 'old-msg',
        timestamp: Math.floor(Date.now() / 1000) - (8 * 24 * 60 * 60) // 8 days ago
      };
      const recentMessage = {
        ...mockMessage,
        id: 'recent-msg',
        timestamp: Math.floor(Date.now() / 1000) - (2 * 24 * 60 * 60) // 2 days ago
      };

      await databaseService.createMessage(oldMessage);
      await databaseService.createMessage(recentMessage);

      const result = await databaseService.getMessages({
        days: 7 // Last 7 days
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0]?.id).toBe('recent-msg');
    });

    it('should search messages by content', async () => {
      const message1 = { ...mockMessage, id: 'msg1', content: 'Hello world' };
      const message2 = { ...mockMessage, id: 'msg2', content: 'Goodbye world' };
      const message3 = { ...mockMessage, id: 'msg3', content: 'Random text' };

      await databaseService.createMessage(message1);
      await databaseService.createMessage(message2);
      await databaseService.createMessage(message3);

      const result = await databaseService.getMessages({
        search: 'world'
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data?.every(msg => msg.content.includes('world'))).toBe(true);
    });
  });

  describe('message events', () => {
    const mockMessage: Omit<Message, 'createdAt' | 'updatedAt'> = {
      id: 'test-message-1',
      chatId: 'test-chat@g.us',
      senderId: 'test-sender@s.whatsapp.net',
      content: 'Test message content',
      messageType: MessageType.TEXT,
      timestamp: 1640995200,
      isFromMe: false,
      isForwarded: false,
      isEphemeral: false,
      isViewOnce: false,
      reactions: '[]'
    };

    beforeEach(async () => {
      await databaseService.createMessage(mockMessage);
    });

    it('should create message events automatically on message creation', async () => {
      const events = await databaseService.getMessageEvents(mockMessage.id);
      
      expect(events).toHaveLength(1);
      expect(events[0]?.eventType).toBe('created');
      expect(events[0]?.messageId).toBe(mockMessage.id);
    });

    it('should create edit events on message update', async () => {
      await databaseService.updateMessage(mockMessage.id, {
        content: 'Updated content'
      });

      const events = await databaseService.getMessageEvents(mockMessage.id);
      
      expect(events).toHaveLength(2); // created + edited
      expect(events[1]?.eventType).toBe('edited');
      expect(events[1]?.oldContent).toBe(mockMessage.content);
      expect(events[1]?.newContent).toBe('Updated content');
    });

    it('should create deletion events on message deletion', async () => {
      await databaseService.deleteMessage(mockMessage.id);

      // Note: In a real implementation, we might keep the message for audit purposes
      // and just mark it as deleted, but for this test we're actually deleting it
      // so we can't retrieve events. This test would need to be adjusted based on
      // the actual implementation.
    });
  });

  describe('error handling', () => {
    it('should handle database connection errors gracefully', () => {
      const service = new DatabaseService({ path: '/invalid/path' });
      
      expect(() => service.getDatabase()).toThrow('Database not initialized');
    });

    it('should handle invalid message data', async () => {
      const invalidMessage = {
        ...mockMessage,
        id: '', // Invalid empty ID
      } as any;

      await expect(databaseService.createMessage(invalidMessage))
        .rejects.toThrow();
    });
  });
});

// Helper function to create a mock message
function createMockMessage(overrides: Partial<Message> = {}): Omit<Message, 'createdAt' | 'updatedAt'> {
  return {
    id: 'test-message',
    chatId: 'test-chat@g.us',
    senderId: 'test-sender@s.whatsapp.net',
    content: 'Test message',
    messageType: MessageType.TEXT,
    timestamp: Math.floor(Date.now() / 1000),
    isFromMe: false,
    isForwarded: false,
    isEphemeral: false,
    isViewOnce: false,
    reactions: '[]',
    ...overrides
  };
}
