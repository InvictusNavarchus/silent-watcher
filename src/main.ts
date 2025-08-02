#!/usr/bin/env node

import { config } from '@/config/index.js';
import { logger, logError } from '@/utils/logger.js';
import { DatabaseService } from '@/services/database.js';
import { WhatsAppService } from '@/services/whatsapp.js';
import { MediaService } from '@/services/media.js';
import { MessageHandler } from '@/handlers/message.js';
import { WebServer } from '@/web/server.js';
// import { getCurrentTimestamp, generateId } from '@/utils/helpers.js';
import type { SystemEvent } from '@/types/index.js';
import { SystemEventType, EventSeverity } from '@/types/index.js';

class SilentWatcherBot {
  private databaseService: DatabaseService;
  private whatsappService: WhatsAppService;
  private mediaService: MediaService;
  private messageHandler: MessageHandler;
  private webServer: WebServer | null = null;
  private isShuttingDown = false;

  constructor() {
    this.databaseService = new DatabaseService(config.database);
    this.whatsappService = new WhatsAppService(config);
    this.mediaService = new MediaService(config, this.databaseService);
    this.messageHandler = new MessageHandler(this.databaseService, this.mediaService, config);

    // Initialize web server if enabled
    if (config.web.enabled) {
      this.webServer = new WebServer(this.databaseService, this.whatsappService);
    }
  }

  /**
   * Initialize and start the bot
   */
  public async start(): Promise<void> {
    try {
      logger.info('Starting Silent Watcher Bot', { 
        version: process.env.npm_package_version || '0.1.0',
        nodeVersion: process.version,
        config: {
          webEnabled: config.web.enabled,
          mediaDownload: config.media.downloadEnabled,
          dataRetention: config.dataRetention.days
        }
      });

      // Initialize services
      await this.initializeServices();

      // Setup event handlers
      this.setupEventHandlers();

      // Start WhatsApp connection
      await this.whatsappService.initialize();

      // Start web server if enabled
      if (this.webServer) {
        await this.webServer.start();
        logger.info('Web server started successfully');
      }

      // Log startup event
      await this.logSystemEvent(SystemEventType.BOT_STARTED, 'Silent Watcher Bot started successfully', EventSeverity.LOW);

      logger.info('Silent Watcher Bot started successfully');

    } catch (error) {
      logError(error as Error, { context: 'Bot startup' });
      await this.logSystemEvent(SystemEventType.ERROR, `Bot startup failed: ${(error as Error).message}`, EventSeverity.CRITICAL);
      process.exit(1);
    }
  }

  /**
   * Initialize all services
   */
  private async initializeServices(): Promise<void> {
    logger.info('Initializing services...');

    // Initialize database
    await this.databaseService.initialize();
    logger.info('Database service initialized');

    // Initialize media service
    await this.mediaService.initialize();
    logger.info('Media service initialized');

    logger.info('All services initialized successfully');
  }

  /**
   * Setup event handlers for WhatsApp service
   */
  private setupEventHandlers(): void {
    // Handle incoming messages
    this.whatsappService.on('message', async (message) => {
      try {
        await this.messageHandler.processMessage(message);
      } catch (error) {
        logError(error as Error, { context: 'Message processing' });
      }
    });

    // Handle message updates
    this.whatsappService.on('message-update', async (update) => {
      try {
        await this.messageHandler.processMessageUpdate(update);
      } catch (error) {
        logError(error as Error, { context: 'Message update processing' });
      }
    });

    // Handle message reactions
    this.whatsappService.on('message-reaction', async (reaction) => {
      try {
        await this.messageHandler.processMessageReaction(reaction);
      } catch (error) {
        logError(error as Error, { context: 'Message reaction processing' });
      }
    });

    // Handle system events
    this.whatsappService.on('system-event', async (event: SystemEvent) => {
      try {
        await this.logSystemEvent(event.eventType, event.description, event.severity, JSON.parse(event.metadata));
      } catch (error) {
        logError(error as Error, { context: 'System event processing' });
      }
    });

    // Handle connection events
    this.whatsappService.on('connected', () => {
      logger.info('WhatsApp connection established');
    });

    this.whatsappService.on('qr-code', (qr: string) => {
      logger.info('QR Code generated for WhatsApp authentication');
      console.log('\n📱 Scan this QR code with WhatsApp:');
      console.log(qr);
      console.log('\n');
    });

    this.whatsappService.on('pairing-code', (code: string) => {
      logger.info('Pairing code generated for WhatsApp authentication', { code });
      console.log(`\n📱 Enter this pairing code in WhatsApp: ${code}\n`);
    });

    // Handle chat updates
    this.whatsappService.on('chat-update', async (chat) => {
      try {
        logger.debug('Chat updated', { chatId: chat.id });
        // TODO: Update chat in database
      } catch (error) {
        logError(error as Error, { context: 'Chat update processing' });
      }
    });

    // Handle contact updates
    this.whatsappService.on('contact-update', async (contact) => {
      try {
        logger.debug('Contact updated', { contactId: contact.id });
        // TODO: Update contact in database
      } catch (error) {
        logError(error as Error, { context: 'Contact update processing' });
      }
    });

    // Handle group updates
    this.whatsappService.on('group-update', async (group) => {
      try {
        logger.debug('Group updated', { groupId: group.id });
        // TODO: Update group in database
      } catch (error) {
        logError(error as Error, { context: 'Group update processing' });
      }
    });

    // Handle presence updates
    this.whatsappService.on('presence-update', async (presence) => {
      try {
        logger.debug('Presence updated', { chatId: presence.id });
        // TODO: Log presence update if needed
      } catch (error) {
        logError(error as Error, { context: 'Presence update processing' });
      }
    });
  }

  /**
   * Log system event to database
   */
  private async logSystemEvent(
    eventType: SystemEvent['eventType'],
    description: string,
    severity: SystemEvent['severity'],
    metadata: Record<string, unknown> = {}
  ): Promise<void> {
    try {
      // TODO: Save to database when system events table is implemented
      // const event: SystemEvent = {
      //   id: generateId(),
      //   eventType,
      //   description,
      //   metadata: JSON.stringify(metadata),
      //   severity,
      //   timestamp: getCurrentTimestamp(),
      //   createdAt: getCurrentTimestamp()
      // };
      // await this.databaseService.saveSystemEvent(event);
      logger.info('System event', { eventType, description, severity, metadata });
    } catch (error) {
      logError(error as Error, { context: 'System event logging' });
    }
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    logger.info('Shutting down Silent Watcher Bot...');

    try {
      // Log shutdown event
      await this.logSystemEvent(SystemEventType.BOT_STOPPED, 'Silent Watcher Bot shutting down', EventSeverity.LOW);

      // Stop web server
      if (this.webServer) {
        await this.webServer.stop();
      }

      // Shutdown WhatsApp service
      await this.whatsappService.shutdown();

      // Close database connection
      this.databaseService.close();

      logger.info('Silent Watcher Bot shutdown complete');
      process.exit(0);
    } catch (error) {
      logError(error as Error, { context: 'Bot shutdown' });
      process.exit(1);
    }
  }

  /**
   * Get bot status
   */
  public getStatus(): Record<string, unknown> {
    return {
      whatsapp: this.whatsappService.getState(),
      database: {
        connected: this.databaseService.isConnected()
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '0.1.0'
    };
  }
}

// Create bot instance
const bot = new SilentWatcherBot();

// Handle process signals for graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT signal');
  await bot.shutdown();
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM signal');
  await bot.shutdown();
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logError(error, { context: 'Uncaught exception' });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled promise rejection', { 
    reason: reason instanceof Error ? reason.message : reason, 
    stack: reason instanceof Error ? reason.stack : undefined,
    promise: promise.toString()
  });
  // Don't exit immediately, let the bot continue running
  // process.exit(1);
});

// Start the bot
if (import.meta.url === `file://${process.argv[1]}`) {
  bot.start().catch((error) => {
    logError(error, { context: 'Bot startup' });
    process.exit(1);
  });
}

export { SilentWatcherBot };
