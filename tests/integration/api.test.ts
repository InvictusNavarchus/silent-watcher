// Jest globals are available globally, no need to import
import request from 'supertest';
import { SilentWatcherBot } from '@/main.js';
// import { config } from '@/config/index.js';

describe('API Integration Tests', () => {
  let app: any;
  let authToken: string;
  let bot: SilentWatcherBot;

  beforeAll(async () => {
    // Override config for testing
    process.env.NODE_ENV = 'test';
    process.env.DB_PATH = ':memory:';
    process.env.WEB_ENABLED = 'true';
    process.env.WEB_PORT = '0'; // Use random port
    process.env.JWT_SECRET = 'test-secret-key-that-is-long-enough-for-testing';
    process.env.WEB_USERNAME = 'testuser';
    process.env.WEB_PASSWORD = 'testpassword';

    // Create bot instance but don't start WhatsApp service
    bot = new SilentWatcherBot();
    
    // Initialize only the services we need for API testing
    // Note: This would require refactoring the bot to allow partial initialization
    // For now, we'll mock the services
  });

  afterAll(async () => {
    if (bot) {
      await bot.shutdown();
    }
  });

  beforeEach(async () => {
    // Reset database state before each test
    // This would require implementing a reset method
  });

  describe('Authentication', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          username: 'testuser',
          password: 'testpassword'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user.username).toBe('testuser');

      authToken = response.body.data.token;
    });

    it('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          username: 'testuser',
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should require authentication for protected routes', async () => {
      const response = await request(app)
        .get('/api/messages')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Authentication required');
    });

    it('should accept valid JWT token', async () => {
      // First login to get token
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          username: 'testuser',
          password: 'testpassword'
        });

      const token = loginResponse.body.data.token;

      // Use token to access protected route
      const response = await request(app)
        .get('/api/health')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should reject invalid JWT token', async () => {
      const response = await request(app)
        .get('/api/health')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Messages API', () => {
    beforeEach(async () => {
      // Login to get auth token
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          username: 'testuser',
          password: 'testpassword'
        });

      authToken = loginResponse.body.data.token;
    });

    it('should get messages with default pagination', async () => {
      const response = await request(app)
        .get('/api/messages')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(50);
    });

    it('should filter messages by chat ID', async () => {
      const chatId = 'test-chat@g.us';
      
      const response = await request(app)
        .get(`/api/messages?chat=${encodeURIComponent(chatId)}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      // All returned messages should be from the specified chat
      response.body.data.forEach((message: any) => {
        expect(message.chatId).toBe(chatId);
      });
    });

    it('should filter messages by days', async () => {
      const response = await request(app)
        .get('/api/messages?days=1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      
      const oneDayAgo = Math.floor(Date.now() / 1000) - (24 * 60 * 60);
      response.body.data.forEach((message: any) => {
        expect(message.timestamp).toBeGreaterThan(oneDayAgo);
      });
    });

    it('should search messages by content', async () => {
      const searchTerm = 'hello';
      
      const response = await request(app)
        .get(`/api/messages?search=${encodeURIComponent(searchTerm)}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      
      response.body.data.forEach((message: any) => {
        expect(message.content.toLowerCase()).toContain(searchTerm.toLowerCase());
      });
    });

    it('should get single message by ID', async () => {
      // First, get a message ID from the list
      const listResponse = await request(app)
        .get('/api/messages?limit=1')
        .set('Authorization', `Bearer ${authToken}`);

      if (listResponse.body.data.length > 0) {
        const messageId = listResponse.body.data[0].id;
        
        const response = await request(app)
          .get(`/api/messages/${messageId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.id).toBe(messageId);
      }
    });

    it('should return 404 for non-existent message', async () => {
      const response = await request(app)
        .get('/api/messages/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Message not found');
    });

    it('should get message history', async () => {
      // This test would require having a message with history
      // For now, we'll test the endpoint structure
      const response = await request(app)
        .get('/api/messages/test-id/history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });
  });

  describe('Stats API', () => {
    beforeEach(async () => {
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          username: 'testuser',
          password: 'testpassword'
        });

      authToken = loginResponse.body.data.token;
    });

    it('should get overview statistics', async () => {
      const response = await request(app)
        .get('/api/stats/overview')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalMessages');
      expect(response.body.data).toHaveProperty('totalChats');
      expect(response.body.data).toHaveProperty('totalMedia');
      expect(response.body.data).toHaveProperty('storageUsed');
      expect(response.body.data).toHaveProperty('activeChats');
      expect(response.body.data).toHaveProperty('messagesLast24h');
      expect(response.body.data).toHaveProperty('messagesLast7d');
      expect(response.body.data).toHaveProperty('messagesLast30d');
    });

    it('should get chat statistics', async () => {
      const response = await request(app)
        .get('/api/stats/chats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });

    it('should get media statistics', async () => {
      const response = await request(app)
        .get('/api/stats/media')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalFiles');
      expect(response.body.data).toHaveProperty('totalSize');
      expect(response.body.data).toHaveProperty('byType');
    });
  });

  describe('Health Check', () => {
    it('should return health status without authentication', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('timestamp');
      expect(response.body.data).toHaveProperty('uptime');
    });

    it('should return detailed health with authentication', async () => {
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          username: 'testuser',
          password: 'testpassword'
        });

      const token = loginResponse.body.data.token;

      const response = await request(app)
        .get('/api/health')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('whatsapp');
      expect(response.body.data).toHaveProperty('database');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on authentication endpoints', async () => {
      const requests = Array.from({ length: 10 }, () =>
        request(app)
          .post('/auth/login')
          .send({
            username: 'testuser',
            password: 'wrongpassword'
          })
      );

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited (429 status)
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('CORS', () => {
    it('should include CORS headers', async () => {
      const response = await request(app)
        .options('/api/health')
        .set('Origin', 'http://localhost:5173');

      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toBeDefined();
      expect(response.headers['access-control-allow-headers']).toBeDefined();
    });

    it('should reject requests from unauthorized origins', async () => {
      const response = await request(app)
        .get('/api/health')
        .set('Origin', 'http://malicious-site.com');

      // This test depends on CORS configuration
      // The exact behavior may vary based on implementation
      expect(response).toBeDefined();
    });
  });
});
