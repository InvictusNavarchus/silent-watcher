import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { EventEmitter } from 'events';
import type { Config } from '@/types/index.js';

// Mock Baileys
const mockSocket = {
  ev: new EventEmitter(),
  end: jest.fn(),
  requestPairingCode: jest.fn()
};

const mockMakeWASocket = jest.fn(() => mockSocket);
const mockUseMultiFileAuthState = jest.fn(() => ({
  state: {},
  saveCreds: jest.fn()
}));

jest.mock('@whiskeysockets/baileys', () => ({
  __esModule: true,
  default: mockMakeWASocket,
  useMultiFileAuthState: mockUseMultiFileAuthState,
  DisconnectReason: {
    badSession: 'badSession',
    connectionClosed: 'connectionClosed',
    connectionLost: 'connectionLost',
    connectionReplaced: 'connectionReplaced',
    loggedOut: 'loggedOut',
    restartRequired: 'restartRequired',
    timedOut: 'timedOut'
  },
  ConnectionState: {
    close: 'close',
    connecting: 'connecting',
    open: 'open'
  }
}));

// Mock Boom
jest.mock('@hapi/boom', () => ({
  Boom: class MockBoom extends Error {
    output = { statusCode: 'connectionClosed' };
  }
}));

describe('WhatsAppService', () => {
  let WhatsAppService: any;
  let service: any;
  let mockConfig: Config;

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();
    mockSocket.ev.removeAllListeners();

    // Mock config
    mockConfig = {
      bot: {
        name: 'test-bot',
        usePairingCode: false,
        autoReconnect: true
      },
      database: { path: ':memory:' },
      web: {
        enabled: true,
        host: '127.0.0.1',
        port: 3000,
        authEnabled: true,
        defaultDays: 7
      },
      jwt: {
        secret: 'test-secret-key-that-is-long-enough',
        expiresIn: '24h'
      },
      media: {
        downloadEnabled: true,
        maxSizeMB: 100,
        compressionEnabled: true
      },
      logging: {
        level: 'info',
        maxFiles: 10,
        maxSize: '10m'
      },
      dataRetention: {
        days: 90,
        autoCleanupEnabled: true
      },
      security: {
        rateLimitWindowMs: 900000,
        rateLimitMaxRequests: 100,
        corsOrigin: 'http://localhost:5173'
      }
    } as Config;

    // Dynamic import to get fresh instance
    const module = await import('@/services/whatsapp.js');
    WhatsAppService = module.WhatsAppService;
    service = new WhatsAppService(mockConfig);
  });

  afterEach(() => {
    if (service) {
      service.removeAllListeners();
    }
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await service.initialize();

      expect(mockUseMultiFileAuthState).toHaveBeenCalledWith('./data/auth/baileys_auth_info');
      expect(mockMakeWASocket).toHaveBeenCalledWith(
        expect.objectContaining({
          auth: {},
          printQRInTerminal: true,
          browser: ['Silent Watcher', 'Chrome', '1.0.0']
        })
      );
    });

    it('should request pairing code when enabled', async () => {
      mockConfig.bot.usePairingCode = true;
      mockConfig.bot.phoneNumber = '+1234567890';
      mockSocket.requestPairingCode.mockResolvedValue('123456');

      const pairingCodePromise = new Promise((resolve) => {
        service.once('pairing-code', resolve);
      });

      await service.initialize();

      expect(mockSocket.requestPairingCode).toHaveBeenCalledWith('+1234567890');
      
      const code = await pairingCodePromise;
      expect(code).toBe('123456');
    });

    it('should handle initialization errors', async () => {
      mockUseMultiFileAuthState.mockRejectedValue(new Error('Auth state error'));

      await expect(service.initialize()).rejects.toThrow('Auth state error');
    });
  });

  describe('connection handling', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should handle successful connection', () => {
      const connectedPromise = new Promise((resolve) => {
        service.once('connected', resolve);
      });

      mockSocket.ev.emit('connection.update', { connection: 'open' });

      return connectedPromise.then(() => {
        const state = service.getState();
        expect(state.isConnected).toBe(true);
        expect(state.connectionState).toBe('open');
      });
    });

    it('should handle connection close', () => {
      mockSocket.ev.emit('connection.update', { connection: 'close' });

      const state = service.getState();
      expect(state.isConnected).toBe(false);
      expect(state.connectionState).toBe('close');
    });

    it('should emit QR code when received', () => {
      const qrPromise = new Promise((resolve) => {
        service.once('qr-code', resolve);
      });

      mockSocket.ev.emit('connection.update', { qr: 'test-qr-code' });

      return qrPromise.then((qr) => {
        expect(qr).toBe('test-qr-code');
        const state = service.getState();
        expect(state.qrCode).toBe('test-qr-code');
      });
    });

    it('should handle connecting state', () => {
      mockSocket.ev.emit('connection.update', { connection: 'connecting' });

      const state = service.getState();
      expect(state.connectionState).toBe('connecting');
    });
  });

  describe('message handling', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should emit message events', () => {
      const messagePromise = new Promise((resolve) => {
        service.once('message', resolve);
      });

      const testMessage = {
        key: { id: 'test-id', remoteJid: 'test@s.whatsapp.net' },
        message: { conversation: 'test message' }
      };

      mockSocket.ev.emit('messages.upsert', {
        messages: [testMessage],
        type: 'notify'
      });

      return messagePromise.then((message) => {
        expect(message).toEqual(testMessage);
        const state = service.getState();
        expect(state.messagesProcessed).toBe(1);
      });
    });

    it('should emit message update events', () => {
      const updatePromise = new Promise((resolve) => {
        service.once('message-update', resolve);
      });

      const testUpdate = {
        key: { id: 'test-id', remoteJid: 'test@s.whatsapp.net' },
        update: { message: { conversation: 'updated message' } }
      };

      mockSocket.ev.emit('messages.update', [testUpdate]);

      return updatePromise.then((update) => {
        expect(update).toEqual(testUpdate);
      });
    });

    it('should emit message reaction events', () => {
      const reactionPromise = new Promise((resolve) => {
        service.once('message-reaction', resolve);
      });

      const testReaction = {
        key: { id: 'test-id', remoteJid: 'test@s.whatsapp.net' },
        reaction: { text: '👍' }
      };

      mockSocket.ev.emit('messages.reaction', [testReaction]);

      return reactionPromise.then((reaction) => {
        expect(reaction).toEqual(testReaction);
      });
    });
  });

  describe('chat and contact handling', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should emit chat update events', () => {
      const chatPromise = new Promise((resolve) => {
        service.once('chat-update', resolve);
      });

      const testChat = { id: 'test-chat@g.us', name: 'Test Group' };
      mockSocket.ev.emit('chats.update', [testChat]);

      return chatPromise.then((chat) => {
        expect(chat).toEqual(testChat);
      });
    });

    it('should emit contact update events', () => {
      const contactPromise = new Promise((resolve) => {
        service.once('contact-update', resolve);
      });

      const testContact = { id: 'test@s.whatsapp.net', name: 'Test User' };
      mockSocket.ev.emit('contacts.update', [testContact]);

      return contactPromise.then((contact) => {
        expect(contact).toEqual(testContact);
      });
    });

    it('should emit group update events', () => {
      const groupPromise = new Promise((resolve) => {
        service.once('group-update', resolve);
      });

      const testGroup = { id: 'test-group@g.us', subject: 'Test Group' };
      mockSocket.ev.emit('groups.update', [testGroup]);

      return groupPromise.then((group) => {
        expect(group).toEqual(testGroup);
      });
    });

    it('should emit presence update events', () => {
      const presencePromise = new Promise((resolve) => {
        service.once('presence-update', resolve);
      });

      const testPresence = { 
        id: 'test@s.whatsapp.net', 
        presences: { 'test@s.whatsapp.net': { lastKnownPresence: 'available' } }
      };
      
      mockSocket.ev.emit('presence.update', testPresence);

      return presencePromise.then((presence) => {
        expect(presence).toEqual(testPresence);
      });
    });
  });

  describe('state management', () => {
    it('should return initial state', () => {
      const state = service.getState();
      
      expect(state).toEqual({
        isConnected: false,
        connectionState: 'close',
        messagesProcessed: 0,
        uptime: 0
      });
    });

    it('should update state on connection', async () => {
      await service.initialize();
      mockSocket.ev.emit('connection.update', { connection: 'open' });

      const state = service.getState();
      expect(state.isConnected).toBe(true);
      expect(state.connectionState).toBe('open');
      expect(state.lastConnected).toBeValidTimestamp();
    });

    it('should return socket instance', async () => {
      await service.initialize();
      const socket = service.getSocket();
      expect(socket).toBe(mockSocket);
    });
  });

  describe('shutdown', () => {
    it('should shutdown gracefully', async () => {
      await service.initialize();
      await service.shutdown();

      expect(mockSocket.end).toHaveBeenCalled();
      expect(service.getSocket()).toBeNull();
      
      const state = service.getState();
      expect(state.isConnected).toBe(false);
      expect(state.connectionState).toBe('close');
    });

    it('should handle shutdown when not initialized', async () => {
      await expect(service.shutdown()).resolves.not.toThrow();
    });
  });
});
