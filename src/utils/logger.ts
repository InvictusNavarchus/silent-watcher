import winston from 'winston';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

// Lazy logger initialization to avoid issues during testing
let _logger: winston.Logger | null = null;
let _debugLogger: winston.Logger | null = null;

/**
 * Parse log size string (e.g., "10m", "1g", "500k") to bytes
 * @param sizeStr - Size string like "10m" or "1g"
 * @returns Size in bytes
 */
function parseLogSize(sizeStr: string): number {
  const units: Record<string, number> = {
    'k': 1024,
    'm': 1024 * 1024,
    'g': 1024 * 1024 * 1024
  };
  
  const match = sizeStr.toLowerCase().match(/^(\d+)([kmg]?)$/);
  if (!match) {
    throw new Error(`Invalid log size format: ${sizeStr}`);
  }
  
  const [, numberStr, unit = ''] = match;
  const number = parseInt(numberStr!, 10);
  const multiplier = units[unit] || 1;
  
  return number * multiplier;
}

function createLogger(): winston.Logger {
  if (_logger) {
    return _logger;
  }

  // Ensure logs directory exists
  const logsDir = join(process.cwd(), 'data', 'logs');
  if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true });
  }

  // Parse configuration from environment variables
  const logMaxSize = process.env.LOG_MAX_SIZE || '10m';
  const logMaxFiles = process.env.LOG_MAX_FILES ? parseInt(process.env.LOG_MAX_FILES, 10) : 10;
  
  // Convert log size to bytes
  const maxSizeBytes = parseLogSize(logMaxSize);

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

  _logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      }),
      new winston.transports.File({
        filename: join(logsDir, 'app.log'),
        maxsize: maxSizeBytes,
        maxFiles: logMaxFiles,
        tailable: true
      }),
      new winston.transports.File({
        filename: join(logsDir, 'error.log'),
        level: 'error',
        maxsize: maxSizeBytes,
        maxFiles: logMaxFiles,
        tailable: true
      })
    ]
  });

  return _logger;
}

function createDebugLogger(): winston.Logger {
  if (_debugLogger) {
    return _debugLogger;
  }

  const logsDir = join(process.cwd(), 'data', 'logs');
  if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true });
  }

  const logMaxSize = process.env.LOG_MAX_SIZE || '50m'; // Larger size for debug logs
  const logMaxFiles = process.env.LOG_MAX_FILES ? parseInt(process.env.LOG_MAX_FILES, 10) : 20;
  const maxSizeBytes = parseLogSize(logMaxSize);

  // Custom format for debug logs to ensure all data is captured
  const debugLogFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  );

  _debugLogger = winston.createLogger({
    level: 'debug',
    format: debugLogFormat,
    transports: [
      new winston.transports.File({
        filename: join(logsDir, 'debug.log'),
        maxsize: maxSizeBytes,
        maxFiles: logMaxFiles,
        tailable: true,
      }),
    ],
    exitOnError: false, // Prevent exit on error
  });

  return _debugLogger;
}

// Create a proxy logger that lazily initializes the real logger
export const logger = {
  info: (message: string, meta?: any) => createLogger().info(message, meta),
  error: (message: string, meta?: any) => createLogger().error(message, meta),
  warn: (message: string, meta?: any) => createLogger().warn(message, meta),
  debug: (message: string, meta?: any) => createLogger().debug(message, meta),
  end: () => createLogger().end(),
};

// Create a dedicated, lazily-initialized logger for detailed debug information
export const debugLogger = {
  trace: (message: string, meta?: any) => createDebugLogger().debug(message, { ...meta, level: 'trace' }),
  debug: (message: string, meta?: any) => createDebugLogger().debug(message, meta),
  info: (message: string, meta?: any) => createDebugLogger().info(message, meta),
  warn: (message: string, meta?: any) => createDebugLogger().warn(message, meta),
  error: (message: string, meta?: any) => createDebugLogger().error(message, meta),
  fatal: (message: string, meta?: any) => createDebugLogger().error(message, { ...meta, level: 'fatal' }),
  child: () => debugLogger, // Return the same logger for child instances
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
export const logError = (error: Error, context?: Record<string, unknown>): Promise<void> => {
  const errorInfo = {
    ...context,
    stack: error.stack,
    message: error.message,
    name: error.name
  };
  return new Promise((resolve) => {
    logger.error(error.message, errorInfo);
    resolve();
  });
};

/**
 * Close all logger transports
 */
export function closeLogger(): Promise<void> {
  if (!_logger && !_debugLogger) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const mainTransports = _logger?.transports || [];
    const debugTransports = _debugLogger?.transports || [];
    const allTransports = [...mainTransports, ...debugTransports];
    let closedTransports = 0;

    if (allTransports.length === 0) {
      _logger = null;
      _debugLogger = null;
      return resolve();
    }

    const handleClose = () => {
      closedTransports++;
      if (closedTransports >= allTransports.length) {
        _logger = null;
        _debugLogger = null;
        resolve();
      }
    };

    for (const transport of allTransports) {
      if (transport.close) {
        transport.close();
      }
      // For file transports, we need to wait for the 'finish' event
      if ('on' in transport) {
        transport.on('finish', handleClose);
      } else {
        handleClose();
      }
    }
  });
}

// Signal handling is now managed in main.ts
