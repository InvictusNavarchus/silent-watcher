import express from 'express';
import helmet from 'helmet';
import { join } from 'path';
import { existsSync } from 'fs';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { logger, logRequest } from '@/utils/logger.js';
import { config } from '@/config/index.js';
import { corsMiddleware } from '@/web/middleware/cors.js';
import { apiLimiter, authLimiter } from '@/web/middleware/rateLimiter.js';
import { createApiRouter } from '@/web/routes/api.js';
import { createAuthRouter } from '@/web/routes/auth.js';
import type { DatabaseService } from '@/services/database.js';
import type { WhatsAppService } from '@/services/whatsapp.js';

// WebSocket message interface
interface WebSocketMessage {
  type: string;
  data?: unknown;
  message?: string;
  channel?: string;
}

export class WebServer {
  private app: express.Application;
  private server: ReturnType<typeof createServer> | null = null;
  private wss: WebSocketServer | null = null;
  private databaseService: DatabaseService;
  private whatsappService: WhatsAppService;

  constructor(databaseService: DatabaseService, whatsappService: WhatsAppService) {
    this.app = express();
    this.databaseService = databaseService;
    this.whatsappService = whatsappService;
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "blob:"],
          connectSrc: ["'self'", "ws:", "wss:"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"]
        }
      },
      crossOriginEmbedderPolicy: false
    }));

    // CORS
    this.app.use(corsMiddleware);

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use((req, res, next) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        logRequest({ ...req, ip: req.ip || 'unknown' }, duration);
      });
      
      next();
    });

    // Rate limiting
    this.app.use('/api', apiLimiter);
    this.app.use('/auth', authLimiter);
  }

  /**
   * Setup Express routes
   */
  private setupRoutes(): void {
    // Health check (no auth required)
    this.app.get('/health', (_req, res) => {
      res.json({
        success: true,
        data: {
          status: 'ok',
          timestamp: new Date().toISOString(),
          uptime: process.uptime()
        }
      });
    });

    // Authentication routes
    this.app.use('/auth', createAuthRouter());

    // API routes
    this.app.use('/api', createApiRouter(this.databaseService, this.whatsappService));

    // Serve static frontend files
    this.setupStaticFileServing();

    // Catch-all handler for SPA routing
    this.app.get('/{*path}', (_req, res) => {
      const frontendPath = join(process.cwd(), 'frontend', 'dist', 'index.html');
      
      if (existsSync(frontendPath)) {
        res.sendFile(frontendPath);
      } else {
        res.status(404).json({
          success: false,
          error: 'Frontend not built. Run the frontend build process first.'
        });
      }
    });
  }

  /**
   * Setup static file serving for frontend
   */
  private setupStaticFileServing(): void {
    const frontendDistPath = join(process.cwd(), 'frontend', 'dist');
    
    if (existsSync(frontendDistPath)) {
      // Serve static assets with caching
      this.app.use(express.static(frontendDistPath, {
        maxAge: '1y',
        etag: true,
        lastModified: true,
        setHeaders: (res, path) => {
          // Don't cache HTML files
          if (path.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
          }
        }
      }));
      
      logger.info('Serving frontend from', { path: frontendDistPath });
    } else {
      logger.warn('Frontend dist directory not found', { path: frontendDistPath });
    }
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    // 404 handler for API routes
    this.app.use('/api/*path', (_req, res) => {
      res.status(404).json({
        success: false,
        error: 'API endpoint not found'
      });
    });

    // Global error handler
    this.app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
      logger.error('Express error', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        ip: req.ip
      });

      // Don't leak error details in production
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        ...(isDevelopment && { details: err.message, stack: err.stack })
      });
    });
  }

  /**
   * Setup WebSocket server for real-time updates
   */
  private setupWebSocket(): void {
    if (!this.server) return;

    this.wss = new WebSocketServer({ 
      server: this.server,
      path: '/api/websocket'
    });

    this.wss.on('connection', (ws, req) => {
      logger.info('WebSocket connection established', { ip: req.socket.remoteAddress });

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          logger.debug('WebSocket message received', { data });
          
          // Handle WebSocket messages (authentication, subscriptions, etc.)
          this.handleWebSocketMessage(ws, data);
        } catch (error) {
          logger.error('WebSocket message error', { error });
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format'
          }));
        }
      });

      ws.on('close', () => {
        logger.info('WebSocket connection closed');
      });

      ws.on('error', (error) => {
        logger.error('WebSocket error', { error });
      });

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'welcome',
        message: 'Connected to Silent Watcher'
      }));
    });

    logger.info('WebSocket server initialized');
  }

  /**
   * Handle WebSocket messages
   */
  private handleWebSocketMessage(ws: WebSocket, data: WebSocketMessage): void {
    switch (data.type) {
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong' }));
        break;
      
      case 'subscribe':
        // TODO: Implement subscription management
        ws.send(JSON.stringify({
          type: 'subscribed',
          channel: data.channel
        }));
        break;
      
      default:
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Unknown message type'
        }));
    }
  }

  /**
   * Broadcast message to all connected WebSocket clients
   */
  public broadcast(message: any): void {
    if (!this.wss) return;

    const messageStr = JSON.stringify(message);
    
    this.wss.clients.forEach((client) => {
      if (client.readyState === client.OPEN) {
        client.send(messageStr);
      }
    });
  }

  /**
   * Start the web server
   */
  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = createServer(this.app);
        
        this.server.listen(config.web.port, config.web.host, () => {
          logger.info('Web server started', {
            host: config.web.host,
            port: config.web.port,
            url: `http://${config.web.host}:${config.web.port}`
          });
          
          // Setup WebSocket after server starts
          this.setupWebSocket();
          
          resolve();
        });

        this.server.on('error', (error) => {
          logger.error('Web server error', { error });
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the web server
   */
  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.wss) {
        this.wss.close();
        this.wss = null;
      }

      if (this.server) {
        this.server.close(() => {
          logger.info('Web server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Get server instance
   */
  public getApp(): express.Application {
    return this.app;
  }
}
