// Jest globals are available globally, no need to import

describe('Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('getConfig', () => {
    it('should load default configuration', async () => {
      // Set required environment variables
      process.env.JWT_SECRET = 'test-secret-key-that-is-long-enough-for-validation';
      process.env.WEB_USERNAME = 'admin';
      process.env.WEB_PASSWORD = 'password123';

      // Dynamic import to get fresh config
      const { getConfig } = await import('@/config/index.js');
      const config = getConfig();

      expect(config.bot.name).toBe('silent-watcher');
      expect(config.bot.usePairingCode).toBe(false);
      expect(config.bot.autoReconnect).toBe(true);
      expect(config.database.path).toBe('./data/database/silent-watcher.db');
      expect(config.web.enabled).toBe(true);
      expect(config.web.host).toBe('127.0.0.1');
      expect(config.web.port).toBe(3000);
      expect(config.web.authEnabled).toBe(true);
      expect(config.web.defaultDays).toBe(7);
      expect(config.jwt.secret).toBe('test-secret-key-that-is-long-enough-for-validation');
      expect(config.jwt.expiresIn).toBe('24h');
      expect(config.media.downloadEnabled).toBe(true);
      expect(config.media.maxSizeMB).toBe(100);
      expect(config.media.compressionEnabled).toBe(true);
      expect(config.logging.level).toBe('error'); // Test environment uses error level
      expect(config.logging.maxFiles).toBe(10);
      expect(config.logging.maxSize).toBe('10m');
      expect(config.dataRetention.days).toBe(90);
      expect(config.dataRetention.autoCleanupEnabled).toBe(true);
      expect(config.security.rateLimitWindowMs).toBe(900000);
      expect(config.security.rateLimitMaxRequests).toBe(100);
      expect(config.security.corsOrigin).toBe('http://localhost:5173');
    });

    it('should override defaults with environment variables', async () => {
      process.env.BOT_NAME = 'custom-watcher';
      process.env.WEB_PORT = '4000';
      process.env.LOG_LEVEL = 'debug';
      process.env.JWT_SECRET = 'test-secret-key-that-is-long-enough-for-validation';
      process.env.WEB_USERNAME = 'admin';
      process.env.WEB_PASSWORD = 'password123';

      const { getConfig } = await import('@/config/index.js');
      const config = getConfig();

      expect(config.bot.name).toBe('custom-watcher');
      expect(config.web.port).toBe(4000);
      expect(config.logging.level).toBe('debug');
    });

    it('should validate JWT secret requirement', async () => {
      delete process.env.JWT_SECRET;
      process.env.WEB_USERNAME = 'admin';
      process.env.WEB_PASSWORD = 'password123';

      const { getConfig } = await import('@/config/index.js');
      expect(() => getConfig()).toThrow('jwt.secret: Required');
    });

    it('should validate JWT secret length', async () => {
      process.env.JWT_SECRET = 'short';
      process.env.WEB_USERNAME = 'admin';
      process.env.WEB_PASSWORD = 'password123';

      const { getConfig } = await import('@/config/index.js');
      expect(() => getConfig()).toThrow('String must contain at least 32 character(s)');
    });

    it('should validate web authentication credentials', async () => {
      process.env.JWT_SECRET = 'test-secret-key-that-is-long-enough-for-validation';
      process.env.WEB_AUTH_ENABLED = 'true';
      delete process.env.WEB_USERNAME;
      delete process.env.WEB_PASSWORD;

      const { getConfig } = await import('@/config/index.js');
      expect(() => getConfig()).toThrow('WEB_USERNAME and WEB_PASSWORD are required when web authentication is enabled');
    });

    it('should validate web password length', async () => {
      process.env.JWT_SECRET = 'test-secret-key-that-is-long-enough-for-validation';
      process.env.WEB_USERNAME = 'admin';
      process.env.WEB_PASSWORD = 'short';

      const { getConfig } = await import('@/config/index.js');
      expect(() => getConfig()).toThrow('WEB_PASSWORD must be at least 8 characters long');
    });

    it('should handle boolean environment variables correctly', async () => {
      process.env.USE_PAIRING_CODE = 'true';
      process.env.AUTO_RECONNECT = 'false';
      process.env.WEB_ENABLED = 'false';
      process.env.WEB_AUTH_ENABLED = 'false';
      process.env.MEDIA_DOWNLOAD_ENABLED = 'false';
      process.env.MEDIA_COMPRESSION_ENABLED = 'false';
      process.env.AUTO_CLEANUP_ENABLED = 'false';
      process.env.JWT_SECRET = 'test-secret-key-that-is-long-enough-for-validation';

      const { getConfig } = await import('@/config/index.js');
      const config = getConfig();

      expect(config.bot.usePairingCode).toBe(true);
      expect(config.bot.autoReconnect).toBe(false);
      expect(config.web.enabled).toBe(false);
      expect(config.web.authEnabled).toBe(false);
      expect(config.media.downloadEnabled).toBe(false);
      expect(config.media.compressionEnabled).toBe(false);
      expect(config.dataRetention.autoCleanupEnabled).toBe(false);
    });

    it('should validate numeric ranges', async () => {
      process.env.WEB_PORT = '70000'; // Invalid port
      process.env.JWT_SECRET = 'test-secret-key-that-is-long-enough-for-validation';
      process.env.WEB_USERNAME = 'admin';
      process.env.WEB_PASSWORD = 'password123';

      const { getConfig } = await import('@/config/index.js');
      expect(() => getConfig()).toThrow('Configuration validation failed');
    });
  });

  describe('Environment helpers', () => {
    it('should detect development environment', async () => {
      process.env.NODE_ENV = 'development';
      const { isDevelopment, isProduction, isTest } = await import('@/config/index.js');
      
      expect(isDevelopment()).toBe(true);
      expect(isProduction()).toBe(false);
      expect(isTest()).toBe(false);
    });

    it('should detect production environment', async () => {
      process.env.NODE_ENV = 'production';
      const { isDevelopment, isProduction, isTest } = await import('@/config/index.js');
      
      expect(isDevelopment()).toBe(false);
      expect(isProduction()).toBe(true);
      expect(isTest()).toBe(false);
    });

    it('should detect test environment', async () => {
      process.env.NODE_ENV = 'test';
      const { isDevelopment, isProduction, isTest } = await import('@/config/index.js');
      
      expect(isDevelopment()).toBe(false);
      expect(isProduction()).toBe(false);
      expect(isTest()).toBe(true);
    });
  });
});
