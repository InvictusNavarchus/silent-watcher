import { Router } from 'express';
import { DatabaseService } from '@/services/database.js';
import { WhatsAppService } from '@/services/whatsapp.js';
import { authenticate, requireAdmin } from '@/web/middleware/auth.js';
import { logger } from '@/utils/logger.js';
import { formatBytes } from '@/utils/helpers.js';
import type { MessageQuery, StatsOverview } from '@/types/index.js';

export function createApiRouter(
  databaseService: DatabaseService,
  whatsappService: WhatsAppService
): Router {
  const router = Router();

  // Apply authentication to all API routes
  router.use(authenticate);

  // Message Management Routes
  router.get('/messages', async (req, res) => {
    try {
      const query: MessageQuery = {
        chatId: req.query.chat as string,
        days: req.query.days ? parseInt(req.query.days as string) : undefined,
        type: req.query.type as any,
        state: req.query.state as any,
        search: req.query.search as string,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0
      };

      const result = await databaseService.getMessages(query);
      res.json(result);
    } catch (error) {
      logger.error('Failed to get messages', { error, query: req.query });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve messages'
      });
    }
  });

  router.get('/messages/:id', async (req, res) => {
    try {
      const message = await databaseService.getMessageById(req.params.id);
      
      if (!message) {
        res.status(404).json({
          success: false,
          error: 'Message not found'
        });
        return;
      }

      res.json({
        success: true,
        data: message
      });
    } catch (error) {
      logger.error('Failed to get message', { error, messageId: req.params.id });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve message'
      });
    }
  });

  router.get('/messages/:id/history', async (req, res) => {
    try {
      const events = await databaseService.getMessageEvents(req.params.id);
      
      res.json({
        success: true,
        data: events
      });
    } catch (error) {
      logger.error('Failed to get message history', { error, messageId: req.params.id });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve message history'
      });
    }
  });

  // Chat Management Routes
  router.get('/chats', async (req, res) => {
    try {
      // TODO: Implement getChats in DatabaseService
      res.json({
        success: true,
        data: [],
        message: 'Chat management not yet implemented'
      });
    } catch (error) {
      logger.error('Failed to get chats', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve chats'
      });
    }
  });

  router.get('/chats/:id/messages', async (req, res) => {
    try {
      const query: MessageQuery = {
        chatId: req.params.id,
        days: req.query.days ? parseInt(req.query.days as string) : 7,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0
      };

      const result = await databaseService.getMessages(query);
      res.json(result);
    } catch (error) {
      logger.error('Failed to get chat messages', { error, chatId: req.params.id });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve chat messages'
      });
    }
  });

  // Media Routes
  router.get('/media/:id', async (req, res) => {
    try {
      // TODO: Implement media serving
      res.status(501).json({
        success: false,
        error: 'Media serving not yet implemented'
      });
    } catch (error) {
      logger.error('Failed to serve media', { error, mediaId: req.params.id });
      res.status(500).json({
        success: false,
        error: 'Failed to serve media'
      });
    }
  });

  router.get('/media/:id/thumbnail', async (req, res) => {
    try {
      // TODO: Implement thumbnail serving
      res.status(501).json({
        success: false,
        error: 'Thumbnail serving not yet implemented'
      });
    } catch (error) {
      logger.error('Failed to serve thumbnail', { error, mediaId: req.params.id });
      res.status(500).json({
        success: false,
        error: 'Failed to serve thumbnail'
      });
    }
  });

  // Export Routes (Admin only)
  router.post('/export', requireAdmin, async (req, res) => {
    try {
      const { format = 'json', ...query } = req.body;
      
      // TODO: Implement data export
      res.status(501).json({
        success: false,
        error: 'Data export not yet implemented'
      });
    } catch (error) {
      logger.error('Failed to export data', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to export data'
      });
    }
  });

  // Stats Routes
  router.get('/stats/overview', async (req, res) => {
    try {
      // TODO: Implement comprehensive stats
      const mockStats: StatsOverview = {
        totalMessages: 0,
        totalChats: 0,
        totalMedia: 0,
        storageUsed: 0,
        activeChats: 0,
        messagesLast24h: 0,
        messagesLast7d: 0,
        messagesLast30d: 0
      };

      res.json({
        success: true,
        data: mockStats
      });
    } catch (error) {
      logger.error('Failed to get stats overview', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve statistics'
      });
    }
  });

  router.get('/stats/chats', async (req, res) => {
    try {
      // TODO: Implement chat statistics
      res.json({
        success: true,
        data: [],
        message: 'Chat statistics not yet implemented'
      });
    } catch (error) {
      logger.error('Failed to get chat stats', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve chat statistics'
      });
    }
  });

  router.get('/stats/media', async (req, res) => {
    try {
      // TODO: Implement media statistics
      res.json({
        success: true,
        data: {
          totalFiles: 0,
          totalSize: 0,
          byType: {}
        },
        message: 'Media statistics not yet implemented'
      });
    } catch (error) {
      logger.error('Failed to get media stats', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve media statistics'
      });
    }
  });

  // Health Check
  router.get('/health', async (req, res) => {
    try {
      const whatsappState = whatsappService.getState();
      const dbConnected = databaseService.isConnected();

      const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        whatsapp: {
          connected: whatsappState.isConnected,
          state: whatsappState.connectionState,
          messagesProcessed: whatsappState.messagesProcessed
        },
        database: {
          connected: dbConnected
        }
      };

      const httpStatus = whatsappState.isConnected && dbConnected ? 200 : 503;

      res.status(httpStatus).json({
        success: true,
        data: health
      });
    } catch (error) {
      logger.error('Health check failed', { error });
      res.status(500).json({
        success: false,
        error: 'Health check failed'
      });
    }
  });

  // Bot Control Routes (Admin only)
  router.get('/bot/status', requireAdmin, async (req, res) => {
    try {
      const status = {
        whatsapp: whatsappService.getState(),
        database: {
          connected: databaseService.isConnected()
        },
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          version: process.env.npm_package_version || '0.1.0'
        }
      };

      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      logger.error('Failed to get bot status', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve bot status'
      });
    }
  });

  return router;
}
