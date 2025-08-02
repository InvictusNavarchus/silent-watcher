import type { WAMessage } from '@whiskeysockets/baileys';
import { proto } from '@whiskeysockets/baileys';
import { DatabaseService } from '@/services/database.js';
import { MediaService } from '@/services/media.js';
import { logger, logError } from '@/utils/logger.js';
import {
  generateId,
  getCurrentTimestamp,
  normalizeJid
} from '@/utils/helpers.js';
import type { Message, Config } from '@/types/index.js';
import {
  MessageType,
  MediaType,
  MessageEventType
} from '@/types/index.js';

export class MessageHandler {
  private databaseService: DatabaseService;
  private mediaService: MediaService;
  private config: Config;

  constructor(
    databaseService: DatabaseService, 
    mediaService: MediaService,
    config: Config
  ) {
    this.databaseService = databaseService;
    this.mediaService = mediaService;
    this.config = config;
  }

  /**
   * Process incoming WhatsApp message
   */
  public async processMessage(waMessage: WAMessage): Promise<void> {
    try {
      if (!waMessage.key.id || !waMessage.key.remoteJid) {
        logger.warn('Invalid message received - missing key data');
        return;
      }

      const message = await this.convertWAMessageToMessage(waMessage);
      
      // Save message to database
      await this.databaseService.createMessage(message);
      
      // Download and process media if enabled
      if (message.mediaPath && this.config.media.downloadEnabled) {
        await this.mediaService.processMessageMedia(waMessage, message as Message);
      }

      logger.debug('Message processed successfully', { 
        messageId: message.id, 
        chatId: message.chatId,
        type: message.messageType
      });

    } catch (error) {
      logError(error as Error, { 
        context: 'Message processing', 
        messageId: waMessage.key.id,
        chatId: waMessage.key.remoteJid
      });
    }
  }

  /**
   * Process message update (edit/delete)
   */
  public async processMessageUpdate(update: any): Promise<void> {
    try {
      const messageId = update.key.id;
      if (!messageId) return;

      const existingMessage = await this.databaseService.getMessageById(messageId);
      if (!existingMessage) {
        logger.warn('Message update received for unknown message', { messageId });
        return;
      }

      // Handle message deletion
      if (update.update?.messageStubType === proto.WebMessageInfo.StubType.REVOKE) {
        await this.handleMessageDeletion(messageId, existingMessage);
        return;
      }

      // Handle message edit
      if (update.update?.message) {
        await this.handleMessageEdit(messageId, update.update.message, existingMessage);
        return;
      }

      logger.debug('Message update processed', { messageId, updateType: Object.keys(update.update || {}) });

    } catch (error) {
      logError(error as Error, { 
        context: 'Message update processing', 
        messageId: update.key.id 
      });
    }
  }

  /**
   * Process message reaction
   */
  public async processMessageReaction(reaction: any): Promise<void> {
    try {
      const messageId = reaction.key.id;
      if (!messageId) return;

      const existingMessage = await this.databaseService.getMessageById(messageId);
      if (!existingMessage) {
        logger.warn('Reaction received for unknown message', { messageId });
        return;
      }

      // Parse existing reactions
      let reactions: Array<{ emoji: string; sender: string; timestamp: number }> = [];
      try {
        reactions = JSON.parse(existingMessage.reactions);
      } catch {
        reactions = [];
      }

      const senderJid = reaction.key.participant || reaction.key.remoteJid;
      const emoji = reaction.reaction?.text;

      if (emoji) {
        // Add or update reaction
        const existingIndex = reactions.findIndex(r => r.sender === senderJid);
        const reactionData = {
          emoji,
          sender: senderJid,
          timestamp: getCurrentTimestamp()
        };

        if (existingIndex >= 0) {
          reactions[existingIndex] = reactionData;
        } else {
          reactions.push(reactionData);
        }

        // Create reaction event
        await this.databaseService.createMessageEvent({
          id: generateId(),
          messageId,
          eventType: MessageEventType.REACTION_ADDED,
          newContent: emoji,
          timestamp: getCurrentTimestamp(),
          metadata: JSON.stringify({ sender: senderJid })
        });
      } else {
        // Remove reaction
        reactions = reactions.filter(r => r.sender !== senderJid);

        // Create reaction removal event
        await this.databaseService.createMessageEvent({
          id: generateId(),
          messageId,
          eventType: MessageEventType.REACTION_REMOVED,
          timestamp: getCurrentTimestamp(),
          metadata: JSON.stringify({ sender: senderJid })
        });
      }

      // Update message with new reactions
      await this.databaseService.updateMessage(messageId, {
        reactions: JSON.stringify(reactions)
      });

      logger.debug('Message reaction processed', { messageId, emoji, sender: senderJid });

    } catch (error) {
      logError(error as Error, { 
        context: 'Message reaction processing', 
        messageId: reaction.key.id 
      });
    }
  }

  /**
   * Convert WhatsApp message to internal message format
   */
  private async convertWAMessageToMessage(waMessage: WAMessage): Promise<Omit<Message, 'createdAt' | 'updatedAt'>> {
    const messageId = waMessage.key.id!;
    const chatId = normalizeJid(waMessage.key.remoteJid!);
    const senderId = waMessage.key.fromMe 
      ? 'me' 
      : normalizeJid(waMessage.key.participant || waMessage.key.remoteJid!);

    const messageType = this.getMessageType(waMessage);
    const content = this.extractMessageContent(waMessage);
    const timestamp = waMessage.messageTimestamp 
      ? Number(waMessage.messageTimestamp) 
      : getCurrentTimestamp();

    // Handle media
    let mediaPath: string | undefined;
    let mediaType: MediaType | undefined;
    let mediaMimeType: string | undefined;
    let mediaSize: number | undefined;

    if (this.hasMedia(waMessage)) {
      const mediaInfo = this.extractMediaInfo(waMessage);
      mediaPath = mediaInfo.path;
      mediaType = mediaInfo.type;
      mediaMimeType = mediaInfo.mimeType;
      mediaSize = mediaInfo.size;
    }

    // Handle quoted message
    const quotedMessageId = waMessage.message?.extendedTextMessage?.contextInfo?.stanzaId;

    // Handle forwarded message
    const isForwarded = Boolean(waMessage.message?.extendedTextMessage?.contextInfo?.isForwarded);
    const forwardedFrom = waMessage.message?.extendedTextMessage?.contextInfo?.forwardedNewsletterMessageInfo?.newsletterName;

    // Handle ephemeral message
    const isEphemeral = Boolean(waMessage.message?.ephemeralMessage);
    const ephemeralDuration = waMessage.message?.ephemeralMessage?.message?.extendedTextMessage?.contextInfo?.expiration;

    // Handle view once message
    const isViewOnce = Boolean(waMessage.message?.viewOnceMessage);

    return {
      id: messageId,
      chatId,
      senderId,
      content,
      messageType,
      timestamp,
      isFromMe: Boolean(waMessage.key.fromMe),
      quotedMessageId: quotedMessageId ?? undefined,
      mediaPath,
      mediaType,
      mediaMimeType,
      mediaSize,
      isForwarded,
      forwardedFrom: forwardedFrom ?? undefined,
      isEphemeral,
      ephemeralDuration: ephemeralDuration ?? undefined,
      isViewOnce,
      reactions: '[]'
    };
  }

  /**
   * Determine message type from WhatsApp message
   */
  private getMessageType(waMessage: WAMessage): MessageType {
    const message = waMessage.message;
    if (!message) return MessageType.SYSTEM;

    if (message.conversation || message.extendedTextMessage) return MessageType.TEXT;
    if (message.imageMessage) return MessageType.IMAGE;
    if (message.videoMessage) return MessageType.VIDEO;
    if (message.audioMessage) return MessageType.AUDIO;
    if (message.documentMessage) return MessageType.DOCUMENT;
    if (message.stickerMessage) return MessageType.STICKER;
    if (message.locationMessage || message.liveLocationMessage) return MessageType.LOCATION;
    if (message.contactMessage || message.contactsArrayMessage) return MessageType.CONTACT;
    if (message.pollCreationMessage || message.pollUpdateMessage) return MessageType.POLL;
    if (message.reactionMessage) return MessageType.REACTION;

    return MessageType.SYSTEM;
  }

  /**
   * Extract text content from WhatsApp message
   */
  private extractMessageContent(waMessage: WAMessage): string {
    const message = waMessage.message;
    if (!message) return '';

    if (message.conversation) return message.conversation;
    if (message.extendedTextMessage?.text) return message.extendedTextMessage.text;
    if (message.imageMessage?.caption) return message.imageMessage.caption;
    if (message.videoMessage?.caption) return message.videoMessage.caption;
    if (message.documentMessage?.caption) return message.documentMessage.caption;
    if (message.locationMessage) return `Location: ${message.locationMessage.degreesLatitude}, ${message.locationMessage.degreesLongitude}`;
    if (message.contactMessage) return `Contact: ${message.contactMessage.displayName}`;
    if (message.pollCreationMessage) return `Poll: ${message.pollCreationMessage.name}`;
    if (message.reactionMessage) return `Reaction: ${message.reactionMessage.text}`;

    // Handle system messages
    if (waMessage.messageStubType) {
      return this.getSystemMessageText(waMessage.messageStubType, waMessage.messageStubParameters ?? undefined);
    }

    return '[Media or unsupported message]';
  }

  /**
   * Check if message has media
   */
  private hasMedia(waMessage: WAMessage): boolean {
    const message = waMessage.message;
    if (!message) return false;

    return Boolean(
      message.imageMessage ||
      message.videoMessage ||
      message.audioMessage ||
      message.documentMessage ||
      message.stickerMessage
    );
  }

  /**
   * Extract media information
   */
  private extractMediaInfo(waMessage: WAMessage): {
    path: string;
    type: MediaType;
    mimeType: string;
    size: number;
  } {
    const message = waMessage.message!;
    const messageId = waMessage.key.id!;

    if (message.imageMessage) {
      return {
        path: `images/${messageId}.jpg`,
        type: MediaType.IMAGE,
        mimeType: message.imageMessage.mimetype || 'image/jpeg',
        size: Number(message.imageMessage.fileLength) || 0
      };
    }

    if (message.videoMessage) {
      return {
        path: `videos/${messageId}.mp4`,
        type: MediaType.VIDEO,
        mimeType: message.videoMessage.mimetype || 'video/mp4',
        size: Number(message.videoMessage.fileLength) || 0
      };
    }

    if (message.audioMessage) {
      const audioMsg = message.audioMessage;
      return {
        path: `audio/${messageId}.ogg`,
        type: MediaType.AUDIO,
        mimeType: audioMsg.mimetype || 'audio/ogg',
        size: Number(audioMsg.fileLength) || 0
      };
    }

    if (message.documentMessage) {
      const ext = message.documentMessage.fileName?.split('.').pop() || 'bin';
      return {
        path: `documents/${messageId}.${ext}`,
        type: MediaType.DOCUMENT,
        mimeType: message.documentMessage.mimetype || 'application/octet-stream',
        size: Number(message.documentMessage.fileLength) || 0
      };
    }

    if (message.stickerMessage) {
      return {
        path: `stickers/${messageId}.webp`,
        type: MediaType.STICKER,
        mimeType: message.stickerMessage.mimetype || 'image/webp',
        size: Number(message.stickerMessage.fileLength) || 0
      };
    }

    throw new Error('No media found in message');
  }

  /**
   * Handle message deletion
   */
  private async handleMessageDeletion(messageId: string, existingMessage: Message): Promise<void> {
    // Create deletion event
    await this.databaseService.createMessageEvent({
      id: generateId(),
      messageId,
      eventType: MessageEventType.DELETED,
      oldContent: existingMessage.content,
      timestamp: getCurrentTimestamp(),
      metadata: JSON.stringify({ chatId: existingMessage.chatId })
    });

    // Note: We keep the message in database for audit purposes
    // but mark it as deleted in the event log
    logger.info('Message deletion recorded', { messageId });
  }

  /**
   * Handle message edit
   */
  private async handleMessageEdit(messageId: string, newMessage: any, existingMessage: Message): Promise<void> {
    const newContent = this.extractMessageContent({ message: newMessage } as WAMessage);
    
    if (newContent !== existingMessage.content) {
      // Update message content
      await this.databaseService.updateMessage(messageId, {
        content: newContent
      });

      logger.info('Message edit recorded', { messageId, oldLength: existingMessage.content.length, newLength: newContent.length });
    }
  }

  /**
   * Get system message text
   */
  private getSystemMessageText(stubType: number, parameters?: string[]): string {
    // Map common system message types
    const systemMessages: Record<number, string> = {
      1: 'You were added',
      2: 'You added {0}',
      3: 'You removed {0}',
      4: 'You left',
      5: 'You changed the subject to "{0}"',
      6: 'You changed this group\'s icon',
      7: 'You changed the group description',
      8: 'Group settings changed',
      9: 'You created group "{0}"',
      10: 'Group created',
      // Add more as needed
    };

    let text = systemMessages[stubType] || `System message (${stubType})`;
    
    // Replace parameters
    if (parameters) {
      parameters.forEach((param, index) => {
        text = text.replace(`{${index}}`, param);
      });
    }

    return text;
  }
}
