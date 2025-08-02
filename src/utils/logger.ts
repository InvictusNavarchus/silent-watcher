import winston from 'winston';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

/**
 * Parse log size string to bytes
 */
function parseLogSize(sizeStr: string, defaultSize: number = 10000000): number {
  if (!sizeStr) return defaultSize;
  
  const str = sizeStr.toLowerCase().trim();
  const match = str.match(/^(\d+(?:\.\d+)?)(m|mb|k|kb|g|gb)?$/);
  
  if (!match || !match[1]) return defaultSize;
  
  const value = parseFloat(match[1]);
  const unit = match[2] || '';
  
  switch (unit) {
    case 'k':
    case 'kb':
      return Math.floor(value * 1024);
    case 'm':
    case 'mb':
      return Math.floor(value * 1024 * 1024);
    case 'g':
    case 'gb':
      return Math.floor(value * 1024 * 1024 * 1024);
    default:
      return Math.floor(value);
  }
}

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
