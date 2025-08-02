// Jest globals are available globally, no need to import
import {
  generateId,
  generateHash,
  getCurrentTimestamp,
  formatTimestamp,
  msToSeconds,
  secondsToMs,
  sleep,
  retry,
  sanitizeFilename,
  formatBytes,
  parseDuration,
  truncateString,
  deepClone,
  isEmpty,
  debounce,
  throttle,
  isValidPhoneNumber,
  extractPhoneNumber,
  isGroupJid,
  isBroadcastJid,
  normalizeJid
} from '../../../src/utils/helpers';

describe('Helper Functions', () => {
  describe('generateId', () => {
    it('should generate a valid UUID', () => {
      const id = generateId();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('generateHash', () => {
    it('should generate SHA256 hash by default', () => {
      const hash = generateHash('test');
      expect(hash).toBe('9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08');
    });

    it('should generate MD5 hash when specified', () => {
      const hash = generateHash('test', 'md5');
      expect(hash).toBe('098f6bcd4621d373cade4e832627b4f6');
    });
  });

  describe('getCurrentTimestamp', () => {
    it('should return current Unix timestamp in seconds', () => {
      const timestamp = getCurrentTimestamp();
      expect(timestamp).toBeGreaterThan(1000000000); // Valid timestamp after 2001
      expect(typeof timestamp).toBe('number');
    });
  });

  describe('formatTimestamp', () => {
    it('should format timestamps correctly', () => {
      const timestamp = 1640995200; // 2022-01-01 00:00:00 UTC
      const formatted = formatTimestamp(timestamp);
      expect(formatted).toBe('2022-01-01T00:00:00.000Z');
    });

    it('should handle different timestamps', () => {
      const timestamp = 1672531200; // 2023-01-01 00:00:00 UTC
      const formatted = formatTimestamp(timestamp);
      expect(formatted).toBe('2023-01-01T00:00:00.000Z');
    });
  });

  describe('msToSeconds', () => {
    it('should convert milliseconds to seconds', () => {
      expect(msToSeconds(1000)).toBe(1);
      expect(msToSeconds(5500)).toBe(5);
    });
  });

  describe('secondsToMs', () => {
    it('should convert seconds to milliseconds', () => {
      expect(secondsToMs(1)).toBe(1000);
      expect(secondsToMs(5)).toBe(5000);
    });
  });

  describe('sleep', () => {
    it('should resolve after specified time', async () => {
      const start = Date.now();
      await sleep(100);
      const end = Date.now();
      expect(end - start).toBeGreaterThanOrEqual(90); // Allow some tolerance
    });
  });

  describe('retry', () => {
    it('should succeed on first attempt', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      const result = await retry(fn, 3, 100);
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');
      
      const result = await retry(fn, 3, 10);
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should throw after max attempts', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('fail'));
      
      await expect(retry(fn, 2, 10)).rejects.toThrow('fail');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('sanitizeFilename', () => {
    it('should replace invalid characters with underscores', () => {
      expect(sanitizeFilename('file<>name.txt')).toBe('file_name.txt');
      expect(sanitizeFilename('file/\\name.txt')).toBe('file_name.txt');
    });

    it('should remove leading and trailing underscores', () => {
      expect(sanitizeFilename('_filename_')).toBe('filename');
    });

    it('should collapse multiple underscores', () => {
      expect(sanitizeFilename('file___name.txt')).toBe('file_name.txt');
    });
  });

  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 Bytes');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1048576)).toBe('1 MB');
      expect(formatBytes(1073741824)).toBe('1 GB');
    });

    it('should respect decimal places', () => {
      expect(formatBytes(1536, 1)).toBe('1.5 KB');
      expect(formatBytes(1536, 0)).toBe('2 KB');
    });
  });

  describe('parseDuration', () => {
    it('should parse duration strings correctly', () => {
      expect(parseDuration('1000ms')).toBe(1000);
      expect(parseDuration('5s')).toBe(5000);
      expect(parseDuration('2m')).toBe(120000);
      expect(parseDuration('1h')).toBe(3600000);
      expect(parseDuration('1d')).toBe(86400000);
    });

    it('should throw for invalid format', () => {
      expect(() => parseDuration('invalid')).toThrow('Invalid duration format');
      expect(() => parseDuration('5x')).toThrow('Unknown duration unit');
    });
  });

  describe('truncateString', () => {
    it('should truncate long strings', () => {
      expect(truncateString('hello world', 8)).toBe('hello...');
      expect(truncateString('hello world', 8, '***')).toBe('hello***');
    });

    it('should not truncate short strings', () => {
      expect(truncateString('hello', 10)).toBe('hello');
    });
  });

  describe('deepClone', () => {
    it('should clone primitive values', () => {
      expect(deepClone(42)).toBe(42);
      expect(deepClone('hello')).toBe('hello');
      expect(deepClone(null)).toBe(null);
    });

    it('should clone arrays', () => {
      const arr = [1, 2, { a: 3 }];
      const cloned = deepClone(arr);
      expect(cloned).toEqual(arr);
      expect(cloned).not.toBe(arr);
      expect(cloned[2]).not.toBe(arr[2]);
    });

    it('should clone objects', () => {
      const obj = { a: 1, b: { c: 2 } };
      const cloned = deepClone(obj);
      expect(cloned).toEqual(obj);
      expect(cloned).not.toBe(obj);
      expect(cloned.b).not.toBe(obj.b);
    });

    it('should clone dates', () => {
      const date = new Date();
      const cloned = deepClone(date);
      expect(cloned).toEqual(date);
      expect(cloned).not.toBe(date);
    });
  });

  describe('isEmpty', () => {
    it('should return true for empty values', () => {
      expect(isEmpty(null)).toBe(true);
      expect(isEmpty(undefined)).toBe(true);
      expect(isEmpty('')).toBe(true);
      expect(isEmpty([])).toBe(true);
      expect(isEmpty({})).toBe(true);
    });

    it('should return false for non-empty values', () => {
      expect(isEmpty('hello')).toBe(false);
      expect(isEmpty([1])).toBe(false);
      expect(isEmpty({ a: 1 })).toBe(false);
      expect(isEmpty(0)).toBe(false);
    });
  });

  describe('debounce', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should debounce function calls', () => {
      const fn = jest.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn();
      debouncedFn();
      debouncedFn();

      expect(fn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('throttle', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should throttle function calls', () => {
      const fn = jest.fn();
      const throttledFn = throttle(fn, 100);

      throttledFn();
      throttledFn();
      throttledFn();

      expect(fn).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(100);
      throttledFn();
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('WhatsApp JID helpers', () => {
    describe('isValidPhoneNumber', () => {
      it('should validate phone numbers', () => {
        expect(isValidPhoneNumber('+1234567890')).toBe(true);
        expect(isValidPhoneNumber('+919876543210')).toBe(true);
        expect(isValidPhoneNumber('1234567890')).toBe(false);
        expect(isValidPhoneNumber('+0123456789')).toBe(false);
      });
    });

    describe('extractPhoneNumber', () => {
      it('should extract phone number from JID', () => {
        expect(extractPhoneNumber('1234567890@s.whatsapp.net')).toBe('1234567890');
        expect(extractPhoneNumber('1234567890')).toBe('1234567890');
      });
    });

    describe('isGroupJid', () => {
      it('should identify group JIDs', () => {
        expect(isGroupJid('123456789@g.us')).toBe(true);
        expect(isGroupJid('1234567890@s.whatsapp.net')).toBe(false);
      });
    });

    describe('isBroadcastJid', () => {
      it('should identify broadcast JIDs', () => {
        expect(isBroadcastJid('status@broadcast')).toBe(true);
        expect(isBroadcastJid('1234567890@s.whatsapp.net')).toBe(false);
      });
    });

    describe('normalizeJid', () => {
      it('should normalize JID format', () => {
        expect(normalizeJid('1234567890')).toBe('1234567890@s.whatsapp.net');
        expect(normalizeJid('1234567890@s.whatsapp.net')).toBe('1234567890@s.whatsapp.net');
      });
    });
  });
});
