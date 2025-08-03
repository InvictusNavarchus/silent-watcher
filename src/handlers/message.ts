import type { WAMessage } from '@whiskeysockets/baileys';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const baileys = require('@whiskeysockets/baileys');
const { proto } = baileys;
import { DatabaseService } from '@/services/database.js';
import { MediaService } from '@/services/media.js';
import { logger, logError, debugLogger } from '@/utils/logger.js';
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
  private recentlyProcessedEdits = new Set<string>();
  private recentlyProcessedDeletes = new Set<string>();

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
    debugLogger.debug('Starting message processing', { waMessage });
    try {
      if (!waMessage.key.id || !waMessage.key.remoteJid) {
        logger.warn('Invalid message received, skipping', { waMessage });
        debugLogger.warn('Invalid message received, skipping', { waMessage });
        return;
      }

      // Handle message edits delivered via protocolMessage
      if (waMessage.message?.protocolMessage) {
        const protocolMsg = waMessage.message.protocolMessage;
        switch (protocolMsg.type) {
          case proto.Message.ProtocolMessage.Type.MESSAGE_EDIT:
            {
              if (protocolMsg.editedMessage) {
                const originalMessageId = protocolMsg.key?.id;
                if (originalMessageId) {
                  const existingMessage = await this.databaseService.getMessageById(originalMessageId);
                  if (existingMessage) {
                    await this.handleMessageEdit(originalMessageId, protocolMsg.editedMessage, existingMessage);
                  } else {
                    logger.warn('Message edit received for unknown message', { originalMessageId });
                    debugLogger.warn('Message edit for unknown message', { originalMessageId, waMessage });
                  }
                }
              }
            }
            break;

          case proto.Message.ProtocolMessage.Type.REVOKE:
            {
              const originalMessageId = protocolMsg.key?.id;
              if (originalMessageId) {
                const existingMessage = await this.databaseService.getMessageById(originalMessageId);
                if (existingMessage) {
                  await this.handleMessageDeletion(originalMessageId, existingMessage);
                } else {
                  logger.warn('Message deletion received for unknown message', { originalMessageId });
                  debugLogger.warn('Message deletion for unknown message', { originalMessageId, waMessage });
                }
              }
            }
            break;

          case proto.Message.ProtocolMessage.Type.PEER_DATA_OPERATION_REQUEST_RESPONSE_MESSAGE:
            debugLogger.debug('Received peer data operation response, ignoring.', { waMessage });
            break;

          default:
            logger.warn('Unhandled protocol message type received, skipping', { type: protocolMsg.type, waMessage });
            debugLogger.warn('Unhandled protocol message type received, skipping', { type: protocolMsg.type, waMessage });
        }
        return; // Stop further processing for this event
      }

      // Skip processing very old messages (older than 1 hour) during initial sync
      const messageTime = waMessage.messageTimestamp ? Number(waMessage.messageTimestamp) : getCurrentTimestamp();
      const oneHourAgo = getCurrentTimestamp() - (60 * 60);
      
      if (messageTime < oneHourAgo) {
        debugLogger.debug('Skipping old message from initial sync', {
          messageId: waMessage.key.id,
          messageTime,
          age: getCurrentTimestamp() - messageTime
        });
        return;
      }

      // Process message in a transaction to ensure atomicity
      const message = await this.convertWAMessageToMessage(waMessage);
      debugLogger.debug('Converted WAMessage to internal message format', message);
      
      // Handle contact creation with proper name and phone extraction
      let contactName: string | undefined;
      let phoneNumber: string | undefined;
      
      if (message.senderId === 'me@bot.local') {
        contactName = 'Silent Watcher Bot';
      } else if (message.senderId.includes('@s.whatsapp.net')) {
        phoneNumber = message.senderId.split('@')[0];
      }
      
      // Create message with dependencies in a single transaction
      await this.databaseService.createMessageWithDependencies(
        message,
        undefined, // chatName
        contactName,
        phoneNumber
      );
      debugLogger.debug('Message and dependencies created in database', { messageId: message.id });
      
      // Download and process media if enabled
      if (message.mediaPath && this.config.media.downloadEnabled) {
        debugLogger.debug('Processing message media', { messageId: message.id });
        await this.mediaService.processMessageMedia(waMessage, message as Message);
        debugLogger.debug('Message media processed', { messageId: message.id });
      }

      debugLogger.debug('Message processed successfully', {
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
    debugLogger.debug('Processing message update', { update });
    try {
      const messageId = update.key.id;
      if (!messageId) return;

      const existingMessage = await this.databaseService.getMessageById(messageId);
      if (!existingMessage) {
        logger.warn('Message update received for unknown message', { messageId });
        debugLogger.warn('Message update for unknown message', { messageId, update });
        return;
      }

      // Handle message deletion
      // Check if proto is available before using it
      if (proto?.WebMessageInfo?.StubType) {
        // Use the proper enum if available
        if (update.update?.messageStubType === proto.WebMessageInfo.StubType.REVOKE || (update.update?.message === null && update.update?.messageStubType === 1)) {
          if (!this.recentlyProcessedDeletes.has(messageId)) {
            await this.handleMessageDeletion(messageId, existingMessage);
          } else {
            debugLogger.debug('Skipping duplicate message deletion from messages.update', { messageId });
          }
          return;
        }
      } else {
        logger.warn('proto.WebMessageInfo.StubType is not available, falling back to numeric stubType comparison', { messageId });
        // Fallback to direct comparison if proto.WebMessageInfo is not available
        // REVOKE stub type is 7
        if (update.update?.messageStubType === 7 || (update.update?.message === null && update.update?.messageStubType === 1)) {
          if (!this.recentlyProcessedDeletes.has(messageId)) {
            await this.handleMessageDeletion(messageId, existingMessage);
          } else {
            debugLogger.debug('Skipping duplicate message deletion from messages.update', { messageId });
          }
          return;
        }
      }

      // Handle message edit
      if (update.update?.message?.editedMessage) {
        const newContent = this.extractMessageContent({ message: update.update.message } as WAMessage);
        const cacheKey = `${messageId}:${newContent}`;
        if (!this.recentlyProcessedEdits.has(cacheKey)) {
          await this.handleMessageEdit(messageId, update.update.message, existingMessage);
        } else {
          debugLogger.debug('Skipping duplicate message edit from messages.update', { messageId });
        }
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
    debugLogger.debug('Processing message reaction', { reaction });
    try {
      const messageId = reaction.key.id;
      if (!messageId) return;

      const existingMessage = await this.databaseService.getMessageById(messageId);
      if (!existingMessage) {
        logger.warn('Reaction received for unknown message', { messageId });
        debugLogger.warn('Reaction for unknown message', { messageId, reaction });
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
    
    // Fix sender ID handling - use a proper JID format for 'me' messages
    let senderId: string;
    if (waMessage.key.fromMe) {
      // For messages from the bot, use a consistent sender ID
      senderId = chatId.includes('@g.us')
        ? (waMessage.key.participant ? normalizeJid(waMessage.key.participant) : 'me@bot.local')
        : 'me@bot.local';
    } else {
      senderId = normalizeJid(waMessage.key.participant || waMessage.key.remoteJid!);
    }

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
    const contextInfo = waMessage.message?.extendedTextMessage?.contextInfo;
    if (contextInfo?.quotedMessage) {
      await this.handleQuotedMessage(contextInfo, chatId);
    }
    const quotedMessageId = contextInfo?.stanzaId;

    // Handle forwarded message
    const isForwarded = Boolean(contextInfo?.isForwarded);
    const forwardedFrom = contextInfo?.forwardedNewsletterMessageInfo?.newsletterName;

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
      reactions: '[]',
      isEdited: false,
      isDeleted: false
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
    const message = waMessage.message?.editedMessage?.message || waMessage.message;
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
  private async handleMessageDeletion(originalMessageId: string, existingMessage: Message): Promise<void> {
    // Deduplication logic
    if (this.recentlyProcessedDeletes.has(originalMessageId)) {
      debugLogger.debug('Skipping duplicate message deletion processing', { originalMessageId });
      return;
    }
    this.recentlyProcessedDeletes.add(originalMessageId);
    setTimeout(() => this.recentlyProcessedDeletes.delete(originalMessageId), 5000); // 5-second window

    const deletionMessage: Omit<Message, 'createdAt' | 'updatedAt'> = {
      id: generateId(),
      chatId: existingMessage.chatId,
      senderId: existingMessage.senderId,
      content: '[Message deleted]',
      messageType: existingMessage.messageType,
      timestamp: getCurrentTimestamp(),
      isFromMe: existingMessage.isFromMe,
      quotedMessageId: existingMessage.quotedMessageId,
      originalMessageId: originalMessageId,
      mediaPath: existingMessage.mediaPath,
      mediaType: existingMessage.mediaType,
      mediaMimeType: existingMessage.mediaMimeType,
      mediaSize: existingMessage.mediaSize,
      isForwarded: existingMessage.isForwarded,
      forwardedFrom: existingMessage.forwardedFrom,
      isEphemeral: existingMessage.isEphemeral,
      ephemeralDuration: existingMessage.ephemeralDuration,
      isViewOnce: existingMessage.isViewOnce,
      reactions: '[]',
      isDeleted: true,
      isEdited: false,
    };

    await this.databaseService.createMessageWithDependencies(deletionMessage);
    logger.info('Message deletion recorded as new entry', { originalMessageId, newId: deletionMessage.id });
  }

  /**
   * Handle message edit
   */
  private async handleMessageEdit(originalMessageId: string, newMessage: any, existingMessage: Message): Promise<void> {
    const newContent = this.extractMessageContent({ message: newMessage } as WAMessage);

    // Deduplication logic
    const cacheKey = `${originalMessageId}:${newContent}`;
    if (this.recentlyProcessedEdits.has(cacheKey)) {
      debugLogger.debug('Skipping duplicate message edit processing', { originalMessageId, newContent });
      return;
    }
    this.recentlyProcessedEdits.add(cacheKey);
    setTimeout(() => this.recentlyProcessedEdits.delete(cacheKey), 5000); // 5-second window

    if (newContent !== existingMessage.content) {
      const editedMessage: Omit<Message, 'createdAt' | 'updatedAt'> = {
        id: generateId(),
        chatId: existingMessage.chatId,
        senderId: existingMessage.senderId,
        content: newContent,
        messageType: existingMessage.messageType,
        timestamp: getCurrentTimestamp(),
        isFromMe: existingMessage.isFromMe,
        quotedMessageId: existingMessage.quotedMessageId,
        originalMessageId: originalMessageId,
        mediaPath: existingMessage.mediaPath,
        mediaType: existingMessage.mediaType,
        mediaMimeType: existingMessage.mediaMimeType,
        mediaSize: existingMessage.mediaSize,
        isForwarded: existingMessage.isForwarded,
        forwardedFrom: existingMessage.forwardedFrom,
        isEphemeral: existingMessage.isEphemeral,
        ephemeralDuration: existingMessage.ephemeralDuration,
        isViewOnce: existingMessage.isViewOnce,
        reactions: existingMessage.reactions,
        isEdited: true,
        isDeleted: false,
      };

      await this.databaseService.createMessageWithDependencies(editedMessage);
      logger.info('Message edit recorded as new entry', { originalMessageId, newId: editedMessage.id });
    }
  }

  /**
   * Get system message text
   */
  private async handleQuotedMessage(contextInfo: any, chatId: string): Promise<void> {
    const quotedMessage = contextInfo.quotedMessage;
    const originalMessageId = contextInfo.stanzaId;
  
    const isViewOnce = quotedMessage.imageMessage?.viewOnce || quotedMessage.videoMessage?.viewOnce || quotedMessage.audioMessage?.viewOnce;
    if (!isViewOnce) return;
  
    const existingMessage = await this.databaseService.getMessageById(originalMessageId);
    if (!existingMessage || existingMessage.isViewOnce) {
      // If it doesn't exist or is already a view-once, we don't need to update
      return;
    }
  
    // Construct a temporary WAMessage to extract details
    const senderId = normalizeJid(contextInfo.participant);
    const tempWAMessage: WAMessage = {
      key: {
        id: originalMessageId,
        remoteJid: chatId,
        fromMe: senderId === 'me@bot.local',
        participant: senderId,
      },
      message: quotedMessage,
      messageTimestamp: existingMessage.timestamp,
    };
  
    const messageType = this.getMessageType(tempWAMessage);
    const content = this.extractMessageContent(tempWAMessage);
    const mediaInfo = this.hasMedia(tempWAMessage) ? this.extractMediaInfo(tempWAMessage) : null;
  
    // Update the existing stub message with the full details
    const updatedMessage = await this.databaseService.updateMessageDetails(originalMessageId, {
      content,
      messageType,
      mediaPath: mediaInfo?.path,
      mediaType: mediaInfo?.type,
      mediaMimeType: mediaInfo?.mimeType,
      mediaSize: mediaInfo?.size,
      isViewOnce: true,
    });
  
    if (updatedMessage && mediaInfo && this.config.media.downloadEnabled) {
      debugLogger.debug('Processing media for revealed view-once message', { messageId: originalMessageId });
      // We need to use the original `quotedMessage` as the source for download
      const downloadMessage: WAMessage = { ...tempWAMessage, message: quotedMessage };
      await this.mediaService.processMessageMedia(downloadMessage, updatedMessage);
    }
  }
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
