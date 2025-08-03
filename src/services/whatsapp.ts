import { createRequire } from 'module';
import type { 
  ConnectionState,
  BaileysEventMap,
  WASocket
} from '@whiskeysockets/baileys';

const require = createRequire(import.meta.url);
const baileys = require('@whiskeysockets/baileys');
const makeWASocket = baileys.default || baileys;
const { 
  DisconnectReason,
  useMultiFileAuthState
} = baileys;
import { Boom } from '@hapi/boom';
import { logger, logError } from '@/utils/logger.js';
import { sleep, getCurrentTimestamp, generateId } from '@/utils/helpers.js';
import type { Config, BotState } from '@/types/index.js';
import { SystemEventType, EventSeverity } from '@/types/index.js';
import { EventEmitter } from 'events';

export class WhatsAppService extends EventEmitter {
  private socket: WASocket | null = null;
  private config: Config;
  private state: BotState;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private isShuttingDown = false;
  private isConnecting = false; // Add connection lock

  constructor(config: Config) {
    super();
    this.config = config;
    this.state = {
      isConnected: false,
      connectionState: 'close',
      messagesProcessed: 0,
      uptime: 0
    };
  }

  /**
   * Initialize WhatsApp connection
   */
  public async initialize(): Promise<void> {
    // Prevent multiple simultaneous connection attempts
    if (this.isConnecting) {
      logger.debug('Connection attempt already in progress, skipping');
      return;
    }

    this.isConnecting = true;

    try {
      logger.info('Initializing WhatsApp service');
      
      const { state: authState, saveCreds } = await useMultiFileAuthState('./data/auth/baileys_auth_info');
      
      this.socket = makeWASocket({
        auth: authState,
        logger: {
          level: 'silent',
          trace: () => {},
          debug: () => {},
          info: () => {},
          warn: () => {},
          error: () => {},
          fatal: () => {},
          child: () => ({
            level: 'silent',
            trace: () => {},
            debug: () => {},
            info: () => {},
            warn: () => {},
            error: () => {},
            fatal: () => {}
          })
        } as any,
        browser: ['Silent Watcher', 'Chrome', '1.0.0'],
        generateHighQualityLinkPreview: true,
        markOnlineOnConnect: false,
        syncFullHistory: false,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 30000,
        retryRequestDelayMs: 250
      });

      this.setupEventHandlers(saveCreds);
      
      // Handle pairing code if enabled
      if (this.config.bot.usePairingCode && this.config.bot.phoneNumber && this.socket) {
        const code = await this.socket.requestPairingCode(this.config.bot.phoneNumber);
        logger.info('Pairing code generated', { code });
        this.emit('pairing-code', code);
      }

      logger.info('WhatsApp service initialized');
    } catch (error) {
      logError(error as Error, { context: 'WhatsApp initialization' });
      throw error;
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Setup event handlers for WhatsApp socket
   */
  private setupEventHandlers(saveCreds: () => Promise<void>): void {
    if (!this.socket) return;

    // Connection state updates
    this.socket.ev.on('connection.update', async (update) => {
      try {
        await this.handleConnectionUpdate(update);
      } catch (error) {
        logError(error as Error, { context: 'Connection update handling' });
      }
    });

    // Save credentials when updated
    this.socket.ev.on('creds.update', async () => {
      try {
        await saveCreds();
      } catch (error) {
        logError(error as Error, { context: 'Credentials update handling' });
      }
    });

    // Handle incoming messages
    this.socket.ev.on('messages.upsert', async (messageUpdate) => {
      try {
        await this.handleMessagesUpsert(messageUpdate);
      } catch (error) {
        logError(error as Error, { context: 'Messages upsert handling' });
      }
    });

    // Handle message updates (edits, deletions, reactions)
    this.socket.ev.on('messages.update', async (messageUpdates) => {
      try {
        await this.handleMessagesUpdate(messageUpdates);
      } catch (error) {
        logError(error as Error, { context: 'Messages update handling' });
      }
    });

    // Handle message reactions
    this.socket.ev.on('messages.reaction', async (reactions) => {
      try {
        await this.handleMessageReactions(reactions);
      } catch (error) {
        logError(error as Error, { context: 'Message reactions handling' });
      }
    });

    // Handle chat updates
    this.socket.ev.on('chats.update', async (chatUpdates) => {
      try {
        await this.handleChatsUpdate(chatUpdates);
      } catch (error) {
        logError(error as Error, { context: 'Chats update handling' });
      }
    });

    // Handle contact updates
    this.socket.ev.on('contacts.update', async (contactUpdates) => {
      try {
        await this.handleContactsUpdate(contactUpdates);
      } catch (error) {
        logError(error as Error, { context: 'Contacts update handling' });
      }
    });

    // Handle group updates
    this.socket.ev.on('groups.update', async (groupUpdates) => {
      try {
        await this.handleGroupsUpdate(groupUpdates);
      } catch (error) {
        logError(error as Error, { context: 'Groups update handling' });
      }
    });

    // Handle presence updates
    this.socket.ev.on('presence.update', async (presenceUpdate) => {
      try {
        await this.handlePresenceUpdate(presenceUpdate);
      } catch (error) {
        logError(error as Error, { context: 'Presence update handling' });
      }
    });
  }

  /**
   * Handle connection state updates
   */
  private async handleConnectionUpdate(update: Partial<ConnectionState>): Promise<void> {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      logger.info('QR code generated');
      this.state.qrCode = qr;
      this.emit('qr-code', qr);
      this.emitSystemEvent(SystemEventType.QR_CODE_GENERATED, 'QR code generated for authentication', EventSeverity.LOW);
    }

    if (connection === 'close') {
      this.state.isConnected = false;
      this.state.connectionState = 'close';
      
      const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
      
      logger.debug('Connection closed', { 
        shouldReconnect, 
        autoReconnect: this.config.bot.autoReconnect,
        isShuttingDown: this.isShuttingDown,
        disconnectReason: (lastDisconnect?.error as Boom)?.output?.statusCode
      });
      
      if (shouldReconnect && this.config.bot.autoReconnect && !this.isShuttingDown) {
        await this.handleReconnection(lastDisconnect);
      } else {
        logger.info('Connection closed permanently');
        this.emitSystemEvent(SystemEventType.CONNECTION_CLOSED, 'WhatsApp connection closed', EventSeverity.MEDIUM);
      }
    } else if (connection === 'open') {
      this.state.isConnected = true;
      this.state.connectionState = 'open';
      this.state.lastConnected = getCurrentTimestamp();
      this.reconnectAttempts = 0;
      
      logger.info('WhatsApp connection established');
      this.emitSystemEvent(SystemEventType.CONNECTION_OPENED, 'WhatsApp connection established', EventSeverity.LOW);
      this.emit('connected');
    } else if (connection === 'connecting') {
      this.state.connectionState = 'connecting';
      logger.info('Connecting to WhatsApp...');
    }
  }

  /**
   * Handle reconnection logic with exponential backoff
   */
  private async handleReconnection(lastDisconnect: any): Promise<void> {
    this.reconnectAttempts++;
    
    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached');
      this.emitSystemEvent(SystemEventType.ERROR, 'Max reconnection attempts reached', EventSeverity.CRITICAL);
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
    logger.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    // Log disconnect reason for better debugging
    const disconnectReason = (lastDisconnect?.error as Boom)?.output?.statusCode;
    logger.debug('Disconnect reason', { reason: disconnectReason, DisconnectReason });
    
    await sleep(delay);
    
    try {
      // Close existing socket if it exists to prevent conflicts
      if (this.socket) {
        try {
          this.socket.end(undefined);
        } catch (error) {
          logger.debug('Error closing existing socket', { error });
        }
        this.socket = null;
      }
      
      // Only reinitialize if not shutting down
      if (!this.isShuttingDown) {
        await this.initialize();
      }
    } catch (error) {
      logError(error as Error, { context: 'Reconnection attempt', attempt: this.reconnectAttempts });
      
      // If initialization fails, try again after a longer delay
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        setTimeout(() => this.handleReconnection(lastDisconnect), 5000);
      }
    }
  }

  /**
   * Handle incoming messages
   */
  private async handleMessagesUpsert(messageUpdate: BaileysEventMap['messages.upsert']): Promise<void> {
    const { messages, type } = messageUpdate;

    for (const message of messages) {
      try {
        if (type === 'notify') {
          this.state.messagesProcessed++;
          this.emit('message', message);
          logger.debug('Message received', { 
            messageId: message.key.id, 
            chatId: message.key.remoteJid,
            type: message.message ? Object.keys(message.message)[0] : 'unknown'
          });
        }
      } catch (error) {
        logError(error as Error, { 
          context: 'Message processing', 
          messageId: message.key.id 
        });
      }
    }
  }

  /**
   * Handle message updates (edits, deletions)
   */
  private async handleMessagesUpdate(messageUpdates: BaileysEventMap['messages.update']): Promise<void> {
    for (const update of messageUpdates) {
      try {
        this.emit('message-update', update);
        logger.debug('Message updated', { 
          messageId: update.key.id,
          chatId: update.key.remoteJid,
          update: Object.keys(update.update || {})
        });
      } catch (error) {
        logError(error as Error, { 
          context: 'Message update processing', 
          messageId: update.key.id 
        });
      }
    }
  }

  /**
   * Handle message reactions
   */
  private async handleMessageReactions(reactions: BaileysEventMap['messages.reaction']): Promise<void> {
    for (const reaction of reactions) {
      try {
        this.emit('message-reaction', reaction);
        logger.debug('Message reaction', { 
          messageId: reaction.key.id,
          chatId: reaction.key.remoteJid,
          reaction: reaction.reaction?.text
        });
      } catch (error) {
        logError(error as Error, { 
          context: 'Message reaction processing', 
          messageId: reaction.key.id 
        });
      }
    }
  }

  /**
   * Handle chat updates
   */
  private async handleChatsUpdate(chatUpdates: BaileysEventMap['chats.update']): Promise<void> {
    for (const chat of chatUpdates) {
      try {
        this.emit('chat-update', chat);
        logger.debug('Chat updated', { chatId: chat.id });
      } catch (error) {
        logError(error as Error, { 
          context: 'Chat update processing', 
          chatId: chat.id 
        });
      }
    }
  }

  /**
   * Handle contact updates
   */
  private async handleContactsUpdate(contactUpdates: BaileysEventMap['contacts.update']): Promise<void> {
    for (const contact of contactUpdates) {
      try {
        this.emit('contact-update', contact);
        logger.debug('Contact updated', { contactId: contact.id });
      } catch (error) {
        logError(error as Error, { 
          context: 'Contact update processing', 
          contactId: contact.id 
        });
      }
    }
  }

  /**
   * Handle group updates
   */
  private async handleGroupsUpdate(groupUpdates: BaileysEventMap['groups.update']): Promise<void> {
    for (const group of groupUpdates) {
      try {
        this.emit('group-update', group);
        logger.debug('Group updated', { groupId: group.id });
      } catch (error) {
        logError(error as Error, { 
          context: 'Group update processing', 
          groupId: group.id 
        });
      }
    }
  }

  /**
   * Handle presence updates
   */
  private async handlePresenceUpdate(presenceUpdate: BaileysEventMap['presence.update']): Promise<void> {
    try {
      this.emit('presence-update', presenceUpdate);
      logger.debug('Presence updated', { 
        chatId: presenceUpdate.id,
        presences: Object.keys(presenceUpdate.presences || {})
      });
    } catch (error) {
      logError(error as Error, { 
        context: 'Presence update processing', 
        chatId: presenceUpdate.id 
      });
    }
  }

  /**
   * Emit system event
   */
  private emitSystemEvent(
    eventType: SystemEventType, 
    description: string, 
    severity: EventSeverity,
    metadata: Record<string, unknown> = {}
  ): void {
    const event = {
      id: generateId(),
      eventType,
      description,
      metadata: JSON.stringify(metadata),
      severity,
      timestamp: getCurrentTimestamp(),
      createdAt: getCurrentTimestamp()
    };

    this.emit('system-event', event);
  }

  /**
   * Get current bot state
   */
  public getState(): BotState {
    return {
      ...this.state,
      uptime: this.state.lastConnected ? getCurrentTimestamp() - this.state.lastConnected : 0
    };
  }

  /**
   * Get WhatsApp socket instance
   */
  public getSocket(): WASocket | null {
    return this.socket;
  }

  /**
   * Gracefully shutdown the service
   */
  public async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    
    if (this.socket) {
      logger.info('Shutting down WhatsApp service');
      this.socket.end(undefined);
      this.socket = null;
    }
    
    this.state.isConnected = false;
    this.state.connectionState = 'close';
    
    this.emitSystemEvent(SystemEventType.BOT_STOPPED, 'WhatsApp bot stopped', EventSeverity.LOW);
    logger.info('WhatsApp service shutdown complete');
  }
}
