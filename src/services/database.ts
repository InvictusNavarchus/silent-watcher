import type { Database } from 'better-sqlite3';
import { DatabaseConnection } from '@/database/connection.js';
import { logger } from '@/utils/logger.js';
import { generateId, getCurrentTimestamp } from '@/utils/helpers.js';
import type {
  Message,
  MessageEvent,
  MessageQuery,
  PaginatedResponse,
  Config,
  Media
} from '@/types/index.js';
import { MessageEventType } from '@/types/index.js';

export class DatabaseService {
  private connection: DatabaseConnection;
  private db: Database | null = null;

  constructor(config: Config['database']) {
    this.connection = new DatabaseConnection(config);
  }

  /**
   * Initialize database service
   */
  public async initialize(): Promise<void> {
    await this.connection.initialize();
    this.db = this.connection.getDatabase();
    
    // Verify foreign key constraints are enabled
    const foreignKeysEnabled = this.db.pragma('foreign_keys', { simple: true });
    logger.info('Database service initialized', { foreignKeysEnabled });
  }

  /**
   * Close database connection
   */
  public close(): void {
    this.connection.close();
    this.db = null;
  }

  /**
   * Check if database is connected
   */
  public isConnected(): boolean {
    return this.connection.isConnected();
  }

  /**
   * Process message creation in a transaction
   */
  public async createMessageWithDependencies(
    message: Omit<Message, 'createdAt' | 'updatedAt'>,
    chatName?: string,
    contactName?: string,
    phoneNumber?: string
  ): Promise<Message> {
    if (!this.db) throw new Error('Database not initialized');
    
    return this.connection.transaction((db: Database) => {
      // Ensure chat exists
      const chatExistsStmt = db.prepare('SELECT id FROM chats WHERE id = ?');
      const chatExists = chatExistsStmt.get(message.chatId);
      
      if (!chatExists) {
        const now = getCurrentTimestamp();
        const createChatStmt = db.prepare(`
          INSERT INTO chats (id, name, is_group, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
        `);
        createChatStmt.run(
          message.chatId, 
          chatName || message.chatId, 
          message.chatId.includes('@g.us') ? 1 : 0, 
          now, 
          now
        );
        logger.debug('Chat created in transaction', { chatId: message.chatId });
      }
      
      // Ensure contact exists
      const contactExistsStmt = db.prepare('SELECT id FROM contacts WHERE id = ?');
      const contactExists = contactExistsStmt.get(message.senderId);
      
      if (!contactExists) {
        const now = getCurrentTimestamp();
        const createContactStmt = db.prepare(`
          INSERT INTO contacts (id, name, phone_number, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
        `);
        createContactStmt.run(message.senderId, contactName || null, phoneNumber || null, now, now);
        logger.debug('Contact created in transaction', { contactId: message.senderId });
      }
      
      // Create message
      const now = getCurrentTimestamp();
      const fullMessage: Message = {
        ...message,
        createdAt: now,
        updatedAt: now
      };

      const createMessageStmt = db.prepare(`
        INSERT INTO messages (
          id, chat_id, sender_id, content, message_type, timestamp, is_from_me,
          quoted_message_id, original_message_id, media_path, media_type, media_mime_type, media_size,
          is_forwarded, forwarded_from, is_ephemeral, ephemeral_duration,
          is_view_once, is_edited, is_deleted, reactions, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      createMessageStmt.run(
        fullMessage.id,
        fullMessage.chatId,
        fullMessage.senderId,
        fullMessage.content,
        fullMessage.messageType,
        fullMessage.timestamp,
        fullMessage.isFromMe ? 1 : 0,
        fullMessage.quotedMessageId,
        fullMessage.originalMessageId,
        fullMessage.mediaPath,
        fullMessage.mediaType,
        fullMessage.mediaMimeType,
        fullMessage.mediaSize,
        fullMessage.isForwarded ? 1 : 0,
        fullMessage.forwardedFrom,
        fullMessage.isEphemeral ? 1 : 0,
        fullMessage.ephemeralDuration,
        fullMessage.isViewOnce ? 1 : 0,
        fullMessage.isEdited ? 1 : 0,
        fullMessage.isDeleted ? 1 : 0,
        fullMessage.reactions,
        fullMessage.createdAt,
        fullMessage.updatedAt
      );

      // Create message event
      const createEventStmt = db.prepare(`
        INSERT INTO message_events (
          id, message_id, event_type, old_content, new_content, timestamp, metadata, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      createEventStmt.run(
        generateId(),
        fullMessage.id,
        MessageEventType.CREATED,
        null,
        null,
        fullMessage.timestamp,
        JSON.stringify({ chatId: fullMessage.chatId }),
        now
      );

      logger.debug('Message created in transaction', { messageId: fullMessage.id, chatId: fullMessage.chatId });
      return fullMessage;
    });
  }

  // Message operations
  public async createMessage(message: Omit<Message, 'createdAt' | 'updatedAt'>): Promise<Message> {
    if (!this.db) throw new Error('Database not initialized');

    const now = getCurrentTimestamp();
    const fullMessage: Message = {
      ...message,
      createdAt: now,
      updatedAt: now
    };

    try {
      const stmt = this.db.prepare(`
        INSERT INTO messages (
          id, chat_id, sender_id, content, message_type, timestamp, is_from_me,
          quoted_message_id, original_message_id, media_path, media_type, media_mime_type, media_size,
          is_forwarded, forwarded_from, is_ephemeral, ephemeral_duration,
          is_view_once, is_edited, is_deleted, reactions, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        fullMessage.id,
        fullMessage.chatId,
        fullMessage.senderId,
        fullMessage.content,
        fullMessage.messageType,
        fullMessage.timestamp,
        fullMessage.isFromMe ? 1 : 0,
        fullMessage.quotedMessageId,
        fullMessage.originalMessageId,
        fullMessage.mediaPath,
        fullMessage.mediaType,
        fullMessage.mediaMimeType,
        fullMessage.mediaSize,
        fullMessage.isForwarded ? 1 : 0,
        fullMessage.forwardedFrom,
        fullMessage.isEphemeral ? 1 : 0,
        fullMessage.ephemeralDuration,
        fullMessage.isViewOnce ? 1 : 0,
        fullMessage.isEdited ? 1 : 0,
        fullMessage.isDeleted ? 1 : 0,
        fullMessage.reactions,
        fullMessage.createdAt,
        fullMessage.updatedAt
      );

      // Create message event
      await this.createMessageEvent({
        id: generateId(),
        messageId: fullMessage.id,
        eventType: MessageEventType.CREATED,
        timestamp: fullMessage.timestamp,
        metadata: JSON.stringify({ chatId: fullMessage.chatId })
      });

      logger.debug('Message created', { messageId: fullMessage.id, chatId: fullMessage.chatId });
      return fullMessage;
    } catch (error) {
      logger.error('Failed to create message', { error, messageId: message.id });
      throw error;
    }
  }

  public async updateMessage(id: string, updates: Partial<Message>): Promise<Message | null> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const existing = await this.getMessageById(id);
      if (!existing) return null;

      const updatedMessage = { ...existing, ...updates, updatedAt: getCurrentTimestamp() };
      
      const stmt = this.db.prepare(`
        UPDATE messages SET 
          content = ?, reactions = ?, updated_at = ?
        WHERE id = ?
      `);

      stmt.run(
        updatedMessage.content,
        updatedMessage.reactions,
        updatedMessage.updatedAt,
        id
      );

      // Create message event for edit
      if (updates.content && updates.content !== existing.content) {
        await this.createMessageEvent({
          id: generateId(),
          messageId: id,
          eventType: MessageEventType.EDITED,
          oldContent: existing.content,
          newContent: updates.content,
          timestamp: getCurrentTimestamp(),
          metadata: JSON.stringify({ chatId: existing.chatId })
        });
      }

      logger.debug('Message updated', { messageId: id });
      return updatedMessage;
    } catch (error) {
      logger.error('Failed to update message', { error, messageId: id });
      throw error;
    }
  }

  public async deleteMessage(id: string): Promise<boolean> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const existing = await this.getMessageById(id);
      if (!existing) return false;

      // Create message event for deletion
      await this.createMessageEvent({
        id: generateId(),
        messageId: id,
        eventType: MessageEventType.DELETED,
        oldContent: existing.content,
        timestamp: getCurrentTimestamp(),
        metadata: JSON.stringify({ chatId: existing.chatId })
      });

      const stmt = this.db.prepare('DELETE FROM messages WHERE id = ?');
      const result = stmt.run(id);

      logger.debug('Message deleted', { messageId: id });
      return result.changes > 0;
    } catch (error) {
      logger.error('Failed to delete message', { error, messageId: id });
      throw error;
    }
  }

  public async getMessageById(id: string): Promise<Message | null> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const stmt = this.db.prepare('SELECT * FROM messages WHERE id = ?');
      const row = stmt.get(id) as any;
      
      if (!row) return null;
      
      return this.mapRowToMessage(row);
    } catch (error) {
      logger.error('Failed to get message by ID', { error, messageId: id });
      throw error;
    }
  }

  public async getMessages(query: MessageQuery): Promise<PaginatedResponse<Message>> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const { chatId, days = 7, type, search, limit = 50, offset = 0 } = query;
      
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      if (chatId) {
        whereClause += ' AND chat_id = ?';
        params.push(chatId);
      }

      if (days) {
        const cutoffTime = getCurrentTimestamp() - (days * 24 * 60 * 60);
        whereClause += ' AND timestamp >= ?';
        params.push(cutoffTime);
      }

      if (type) {
        whereClause += ' AND message_type = ?';
        params.push(type);
      }

      if (search) {
        whereClause += ' AND id IN (SELECT id FROM messages_fts WHERE content MATCH ?)';
        params.push(search);
      }

      // Count total records
      const countStmt = this.db.prepare(`SELECT COUNT(*) as count FROM messages ${whereClause}`);
      const { count } = countStmt.get(...params) as { count: number };

      // Get paginated results
      const stmt = this.db.prepare(`
        SELECT * FROM messages ${whereClause}
        ORDER BY timestamp DESC
        LIMIT ? OFFSET ?
      `);
      
      const rows = stmt.all(...params, limit, offset) as any[];
      const messages = rows.map(row => this.mapRowToMessage(row));

      return {
        success: true,
        data: messages,
        pagination: {
          page: Math.floor(offset / limit) + 1,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit)
        }
      };
    } catch (error) {
      logger.error('Failed to get messages', { error, query });
      throw error;
    }
  }

  // Contact operations
  public async ensureContact(contactId: string, name?: string, phoneNumber?: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      // Check if contact exists
      const existsStmt = this.db.prepare('SELECT id FROM contacts WHERE id = ?');
      const exists = existsStmt.get(contactId);

      if (!exists) {
        // Create new contact
        const now = getCurrentTimestamp();
        const insertStmt = this.db.prepare(`
          INSERT INTO contacts (id, name, phone_number, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
        `);

        insertStmt.run(contactId, name || null, phoneNumber || null, now, now);
        logger.debug('Contact created', { contactId, name, phoneNumber });
      } else {
        logger.debug('Contact already exists', { contactId });
      }
    } catch (error) {
      logger.error('Failed to ensure contact', { error, contactId, name, phoneNumber });
      throw error;
    }
  }

  // Chat operations
  public async ensureChat(chatId: string, name?: string, isGroup: boolean = false, participantCount?: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      // Check if chat exists
      const existsStmt = this.db.prepare('SELECT id FROM chats WHERE id = ?');
      const exists = existsStmt.get(chatId);

      if (!exists) {
        // Create new chat
        const now = getCurrentTimestamp();
        const insertStmt = this.db.prepare(`
          INSERT INTO chats (id, name, is_group, participant_count, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `);

        insertStmt.run(chatId, name || chatId, isGroup ? 1 : 0, participantCount || null, now, now);
        logger.debug('Chat created', { chatId, name, isGroup, participantCount });
      } else {
        logger.debug('Chat already exists', { chatId });
      }
    } catch (error) {
      logger.error('Failed to ensure chat', { error, chatId, name, isGroup });
      throw error;
    }
  }

  // Message Event operations
  public async createMessageEvent(event: Omit<MessageEvent, 'createdAt'>): Promise<MessageEvent> {
    if (!this.db) throw new Error('Database not initialized');

    const fullEvent: MessageEvent = {
      ...event,
      createdAt: getCurrentTimestamp()
    };

    try {
      const stmt = this.db.prepare(`
        INSERT INTO message_events (
          id, message_id, event_type, old_content, new_content, timestamp, metadata, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        fullEvent.id,
        fullEvent.messageId,
        fullEvent.eventType,
        fullEvent.oldContent,
        fullEvent.newContent,
        fullEvent.timestamp,
        fullEvent.metadata || '{}',
        fullEvent.createdAt
      );

      return fullEvent;
    } catch (error) {
      logger.error('Failed to create message event', { error, eventId: event.id });
      throw error;
    }
  }

  public async getMessageEvents(messageId: string): Promise<MessageEvent[]> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const stmt = this.db.prepare(`
        SELECT * FROM message_events 
        WHERE message_id = ? 
        ORDER BY timestamp ASC
      `);
      
      const rows = stmt.all(messageId) as any[];
      return rows.map(row => this.mapRowToMessageEvent(row));
    } catch (error) {
      logger.error('Failed to get message events', { error, messageId });
      throw error;
    }
  }

  public async createMedia(media: Omit<Media, 'createdAt'>): Promise<Media> {
    if (!this.db) throw new Error('Database not initialized');

    const fullMedia: Media = {
      ...media,
      createdAt: getCurrentTimestamp()
    };

    try {
      const stmt = this.db.prepare(`
        INSERT INTO media (
          id, message_id, file_name, file_path, mime_type, size,
          width, height, duration, thumbnail_path, is_compressed, original_size, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        fullMedia.id,
        fullMedia.messageId,
        fullMedia.fileName,
        fullMedia.filePath,
        fullMedia.mimeType,
        fullMedia.size,
        fullMedia.width,
        fullMedia.height,
        fullMedia.duration,
        fullMedia.thumbnailPath,
        fullMedia.isCompressed ? 1 : 0,
        fullMedia.originalSize,
        fullMedia.createdAt
      );

      logger.debug('Media record created', { mediaId: fullMedia.id, messageId: fullMedia.messageId });
      return fullMedia;
    } catch (error) {
      logger.error('Failed to create media record', { error, mediaId: media.id });
      throw error;
    }
  }

  // Helper methods
  private mapRowToMessage(row: any): Message {
    return {
      id: row.id,
      chatId: row.chat_id,
      senderId: row.sender_id,
      content: row.content,
      messageType: row.message_type,
      timestamp: row.timestamp,
      isFromMe: Boolean(row.is_from_me),
      quotedMessageId: row.quoted_message_id,
      originalMessageId: row.original_message_id,
      mediaPath: row.media_path,
      mediaType: row.media_type,
      mediaMimeType: row.media_mime_type,
      mediaSize: row.media_size,
      isForwarded: Boolean(row.is_forwarded),
      forwardedFrom: row.forwarded_from,
      isEphemeral: Boolean(row.is_ephemeral),
      ephemeralDuration: row.ephemeral_duration,
      isViewOnce: Boolean(row.is_view_once),
      isEdited: Boolean(row.is_edited),
      isDeleted: Boolean(row.is_deleted),
      reactions: row.reactions || '[]',
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapRowToMessageEvent(row: any): MessageEvent {
    return {
      id: row.id,
      messageId: row.message_id,
      eventType: row.event_type,
      oldContent: row.old_content,
      newContent: row.new_content,
      timestamp: row.timestamp,
      metadata: row.metadata || '{}',
      createdAt: row.created_at
    };
  }
}
