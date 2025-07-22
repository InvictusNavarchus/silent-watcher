// Jest globals are available globally, no need to import
import { config } from 'dotenv';
import { join } from 'path';

// Load test environment variables
config({ path: join(process.cwd(), '.env.test') });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests

// Mock console methods to reduce test output noise
const originalConsole = { ...console };

beforeAll(() => {
  // Mock console methods but keep error for important test failures
  console.log = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
  console.debug = jest.fn();
});

afterAll(() => {
  // Restore console methods
  Object.assign(console, originalConsole);
});

// Global test timeout
jest.setTimeout(30000);

// Mock external dependencies that shouldn't be called during tests
jest.mock('@whiskeysockets/baileys', () => ({
  makeWASocket: jest.fn(),
  useMultiFileAuthState: jest.fn(),
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

// Mock file system operations for media handling
jest.mock('fs/promises', () => ({
  writeFile: jest.fn(),
  readFile: jest.fn(),
  mkdir: jest.fn(),
  unlink: jest.fn(),
  stat: jest.fn(),
  access: jest.fn()
}));

// Mock sharp for image processing
jest.mock('sharp', () => {
  const mockSharp = {
    resize: jest.fn().mockReturnThis(),
    jpeg: jest.fn().mockReturnThis(),
    png: jest.fn().mockReturnThis(),
    webp: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('mock-image')),
    toFile: jest.fn().mockResolvedValue({ size: 1024 })
  };
  
  return jest.fn(() => mockSharp);
});

// Global test utilities
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidUUID(): R;
      toBeValidTimestamp(): R;
    }
  }
}

// Custom Jest matchers
expect.extend({
  toBeValidUUID(received: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = typeof received === 'string' && uuidRegex.test(received);
    
    return {
      message: () => `expected ${received} to be a valid UUID`,
      pass
    };
  },
  
  toBeValidTimestamp(received: number) {
    const pass = typeof received === 'number' && 
                  received > 0 && 
                  received <= Date.now() / 1000 + 60; // Allow 1 minute in future for clock skew
    
    return {
      message: () => `expected ${received} to be a valid Unix timestamp`,
      pass
    };
  }
});
