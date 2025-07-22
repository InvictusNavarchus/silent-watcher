import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';
import { logger } from '@/utils/logger.js';
import type { Config } from '@/types/index.js';

// Load environment variables
dotenvConfig();

// Zod schema for configuration validation
const configSchema = z.object({
  bot: z.object({
    name: z.string().default('silent-watcher'),
    phoneNumber: z.string().optional(),
    usePairingCode: z.boolean().default(false),
    autoReconnect: z.boolean().default(true)
  }),
  database: z.object({
    path: z.string().default('./data/database/silent-watcher.db')
  }),
  web: z.object({
    enabled: z.boolean().default(true),
    host: z.string().default('127.0.0.1'),
    port: z.number().min(1).max(65535).default(3000),
    authEnabled: z.boolean().default(true),
    username: z.string().optional(),
    password: z.string().optional(),
    defaultDays: z.number().min(1).max(365).default(7)
  }),
  jwt: z.object({
    secret: z.string().min(32),
    expiresIn: z.string().default('24h')
  }),
  media: z.object({
    downloadEnabled: z.boolean().default(true),
    maxSizeMB: z.number().min(1).max(1000).default(100),
    compressionEnabled: z.boolean().default(true)
  }),
  logging: z.object({
    level: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    maxFiles: z.number().min(1).max(100).default(10),
    maxSize: z.string().default('10m')
  }),
  dataRetention: z.object({
    days: z.number().min(1).max(3650).default(90),
    autoCleanupEnabled: z.boolean().default(true)
  }),
  security: z.object({
    rateLimitWindowMs: z.number().min(1000).default(900000), // 15 minutes
    rateLimitMaxRequests: z.number().min(1).default(100),
    corsOrigin: z.string().default('http://localhost:5173')
  })
});

/**
 * Parse and validate configuration from environment variables
 */
function parseConfig(): Config {
  const rawConfig = {
    bot: {
      name: process.env.BOT_NAME,
      phoneNumber: process.env.PHONE_NUMBER,
      usePairingCode: process.env.USE_PAIRING_CODE === 'true',
      autoReconnect: process.env.AUTO_RECONNECT !== 'false'
    },
    database: {
      path: process.env.DB_PATH
    },
    web: {
      enabled: process.env.WEB_ENABLED !== 'false',
      host: process.env.WEB_HOST,
      port: process.env.WEB_PORT ? parseInt(process.env.WEB_PORT, 10) : undefined,
      authEnabled: process.env.WEB_AUTH_ENABLED !== 'false',
      username: process.env.WEB_USERNAME,
      password: process.env.WEB_PASSWORD,
      defaultDays: process.env.WEB_DEFAULT_DAYS ? parseInt(process.env.WEB_DEFAULT_DAYS, 10) : undefined
    },
    jwt: {
      secret: process.env.JWT_SECRET,
      expiresIn: process.env.JWT_EXPIRES_IN
    },
    media: {
      downloadEnabled: process.env.MEDIA_DOWNLOAD_ENABLED !== 'false',
      maxSizeMB: process.env.MEDIA_MAX_SIZE_MB ? parseInt(process.env.MEDIA_MAX_SIZE_MB, 10) : undefined,
      compressionEnabled: process.env.MEDIA_COMPRESSION_ENABLED !== 'false'
    },
    logging: {
      level: process.env.LOG_LEVEL as 'error' | 'warn' | 'info' | 'debug',
      maxFiles: process.env.LOG_MAX_FILES ? parseInt(process.env.LOG_MAX_FILES, 10) : undefined,
      maxSize: process.env.LOG_MAX_SIZE
    },
    dataRetention: {
      days: process.env.DATA_RETENTION_DAYS ? parseInt(process.env.DATA_RETENTION_DAYS, 10) : undefined,
      autoCleanupEnabled: process.env.AUTO_CLEANUP_ENABLED !== 'false'
    },
    security: {
      rateLimitWindowMs: process.env.RATE_LIMIT_WINDOW_MS ? parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) : undefined,
      rateLimitMaxRequests: process.env.RATE_LIMIT_MAX_REQUESTS ? parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) : undefined,
      corsOrigin: process.env.CORS_ORIGIN
    }
  };

  try {
    const validatedConfig = configSchema.parse(rawConfig) as Config;
    logger.info('Configuration loaded successfully');
    return validatedConfig;
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('Configuration validation failed', { errors: error.errors });
      throw new Error(`Configuration validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
    }
    throw error;
  }
}

/**
 * Validate required configuration for web authentication
 */
function validateWebAuth(config: Config): void {
  if (config.web.enabled && config.web.authEnabled) {
    if (!config.web.username || !config.web.password) {
      throw new Error('WEB_USERNAME and WEB_PASSWORD are required when web authentication is enabled');
    }
    
    if (config.web.password.length < 8) {
      throw new Error('WEB_PASSWORD must be at least 8 characters long');
    }
  }
}

/**
 * Validate JWT secret
 */
function validateJWT(config: Config): void {
  if (!config.jwt.secret) {
    throw new Error('JWT_SECRET is required');
  }
  
  if (config.jwt.secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }
}

/**
 * Get validated configuration
 */
export function getConfig(): Config {
  const config = parseConfig();
  
  // Additional validation
  validateWebAuth(config);
  validateJWT(config);
  
  return config;
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Check if running in production mode
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if running in test mode
 */
export function isTest(): boolean {
  return process.env.NODE_ENV === 'test';
}

// Export singleton config instance
export const config = getConfig();
