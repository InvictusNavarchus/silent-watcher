import winston from 'winston';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

// Lazy logger initialization to avoid issues during testing
let _logger: winston.Logger | null = null;

function createLogger(): winston.Logger {
  if (_logger) {
    return _logger;
  }

  // Ensure logs directory exists
  const logsDir = join(process.cwd(), 'data', 'logs');
  if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true });
  }

  // Custom log format
  const logFormat = winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
      return `${timestamp} [${level.toUpperCase()}] ${message}${metaStr}`;
    })
  );

  // Create logger instance
  _logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    defaultMeta: { service: 'silent-watcher' },
    transports: [
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    
    // File transport for all logs
    new winston.transports.File({
      filename: join(logsDir, 'app.log'),
      maxsize: parseInt(process.env.LOG_MAX_SIZE?.replace('m', '000000') || '10000000'),
      maxFiles: parseInt(process.env.LOG_MAX_FILES || '10'),
      tailable: true
    }),
    
    // Separate file for errors
    new winston.transports.File({
      filename: join(logsDir, 'error.log'),
      level: 'error',
      maxsize: parseInt(process.env.LOG_MAX_SIZE?.replace('m', '000000') || '10000000'),
      maxFiles: parseInt(process.env.LOG_MAX_FILES || '10'),
      tailable: true
    }),
    
    // Audit log for important events
    new winston.transports.File({
      filename: join(logsDir, 'audit.log'),
      level: 'info',
      maxsize: parseInt(process.env.LOG_MAX_SIZE?.replace('m', '000000') || '10000000'),
      maxFiles: parseInt(process.env.LOG_MAX_FILES || '10'),
      tailable: true,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  ],
  
  // Handle uncaught exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({
      filename: join(logsDir, 'exceptions.log')
    })
  ],
  
  rejectionHandlers: [
    new winston.transports.File({
      filename: join(logsDir, 'rejections.log')
    })
  ]
});

  return _logger;
}

// Create a proxy logger that lazily initializes the real logger
export const logger = {
  info: (message: string, meta?: any) => createLogger().info(message, meta),
  error: (message: string, meta?: any) => createLogger().error(message, meta),
  warn: (message: string, meta?: any) => createLogger().warn(message, meta),
  debug: (message: string, meta?: any) => createLogger().debug(message, meta),
  end: () => createLogger().end(),
};

// Add request logging helper
export const logRequest = (req: { method: string; url: string; ip: string }, duration?: number): void => {
  const meta = {
    method: req.method,
    url: req.url,
    ip: req.ip,
    ...(duration && { duration: `${duration}ms` })
  };
  
  logger.info('HTTP Request', meta);
};

// Add audit logging helper
export const logAudit = (action: string, userId: string, details: Record<string, unknown>): void => {
  logger.info('Audit Log', {
    action,
    userId,
    timestamp: Date.now(),
    ...details
  });
};

// Add performance logging helper
export const logPerformance = (operation: string, duration: number, metadata?: Record<string, unknown>): void => {
  logger.info('Performance', {
    operation,
    duration: `${duration}ms`,
    ...metadata
  });
};

// Add error logging helper with context
export const logError = (error: Error, context?: Record<string, unknown>): void => {
  logger.error('Error occurred', {
    message: error.message,
    stack: error.stack,
    name: error.name,
    ...context
  });
};

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully');
  logger.end();
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  logger.end();
});
