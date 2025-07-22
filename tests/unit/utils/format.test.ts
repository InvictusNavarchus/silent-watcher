import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  formatTimestamp,
  formatFullTimestamp,
  formatRelativeTime,
  formatFileSize,
  formatDuration,
  formatPhoneNumber,
  truncateText,
  formatMessagePreview,
  formatNumber,
  formatPercentage,
  formatUptime,
  formatMemory,
  getMessageTypeDisplayName,
  getConnectionStateDisplay,
  highlightSearchTerm
} from '@/utils/format.js';

describe('Format Utilities', () => {
  // Mock Date.now for consistent testing
  const mockDate = new Date('2023-01-15T10:30:00Z');
  const originalDateNow = Date.now;

  beforeEach(() => {
    Date.now = jest.fn(() => mockDate.getTime());
  });

  afterEach(() => {
    Date.now = originalDateNow;
  });

  describe('formatTimestamp', () => {
    it('should format today timestamps as time only', () => {
      const todayTimestamp = Math.floor(mockDate.getTime() / 1000);
      const result = formatTimestamp(todayTimestamp);
      expect(result).toBe('10:30');
    });

    it('should format yesterday timestamps with "Yesterday"', () => {
      const yesterday = new Date(mockDate);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayTimestamp = Math.floor(yesterday.getTime() / 1000);
      
      const result = formatTimestamp(yesterdayTimestamp);
      expect(result).toContain('Yesterday');
      expect(result).toContain('10:30');
    });

    it('should format older timestamps with date and time', () => {
      const oldDate = new Date('2023-01-10T15:45:00Z');
      const oldTimestamp = Math.floor(oldDate.getTime() / 1000);
      
      const result = formatTimestamp(oldTimestamp);
      expect(result).toBe('Jan 10, 15:45');
    });
  });

  describe('formatFullTimestamp', () => {
    it('should format full date and time', () => {
      const timestamp = Math.floor(mockDate.getTime() / 1000);
      const result = formatFullTimestamp(timestamp);
      
      expect(result).toContain('Jan 15, 2023');
      expect(result).toContain('10:30');
    });
  });

  describe('formatRelativeTime', () => {
    it('should format relative time correctly', () => {
      const oneHourAgo = Math.floor((mockDate.getTime() - 60 * 60 * 1000) / 1000);
      const result = formatRelativeTime(oneHourAgo);
      
      expect(result).toContain('ago');
      expect(result).toContain('hour');
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1048576)).toBe('1 MB');
      expect(formatFileSize(1073741824)).toBe('1 GB');
      expect(formatFileSize(1099511627776)).toBe('1 TB');
    });

    it('should handle decimal values', () => {
      expect(formatFileSize(1536)).toBe('1.5 KB');
      expect(formatFileSize(2621440)).toBe('2.5 MB');
    });

    it('should handle very small values', () => {
      expect(formatFileSize(512)).toBe('512 Bytes');
      expect(formatFileSize(1)).toBe('1 Bytes');
    });
  });

  describe('formatDuration', () => {
    it('should format seconds only', () => {
      expect(formatDuration(30)).toBe('30s');
      expect(formatDuration(45.7)).toBe('46s');
    });

    it('should format minutes and seconds', () => {
      expect(formatDuration(90)).toBe('1m 30s');
      expect(formatDuration(125)).toBe('2m 5s');
      expect(formatDuration(120)).toBe('2m');
    });

    it('should format hours and minutes', () => {
      expect(formatDuration(3600)).toBe('1h');
      expect(formatDuration(3660)).toBe('1h 1m');
      expect(formatDuration(7200)).toBe('2h');
    });
  });

  describe('formatPhoneNumber', () => {
    it('should add country code to 10-digit numbers', () => {
      expect(formatPhoneNumber('1234567890')).toBe('+11234567890');
    });

    it('should add + to numbers without it', () => {
      expect(formatPhoneNumber('441234567890')).toBe('+441234567890');
    });

    it('should leave properly formatted numbers unchanged', () => {
      expect(formatPhoneNumber('+1234567890')).toBe('+1234567890');
    });

    it('should clean non-digit characters', () => {
      expect(formatPhoneNumber('(123) 456-7890')).toBe('+11234567890');
    });
  });

  describe('truncateText', () => {
    it('should truncate long text', () => {
      const longText = 'This is a very long text that should be truncated';
      expect(truncateText(longText, 20)).toBe('This is a very lo...');
    });

    it('should not truncate short text', () => {
      const shortText = 'Short text';
      expect(truncateText(shortText, 20)).toBe('Short text');
    });

    it('should handle exact length', () => {
      const text = 'Exactly twenty chars';
      expect(truncateText(text, 20)).toBe('Exactly twenty chars');
    });
  });

  describe('formatMessagePreview', () => {
    it('should clean and truncate message content', () => {
      const message = 'This is a\nmulti-line\n\nmessage with   extra spaces';
      const result = formatMessagePreview(message, 30);
      
      expect(result).toBe('This is a multi-line message...');
    });

    it('should handle empty messages', () => {
      expect(formatMessagePreview('', 50)).toBe('');
    });

    it('should handle whitespace-only messages', () => {
      expect(formatMessagePreview('   \n\n   ', 50)).toBe('');
    });
  });

  describe('formatNumber', () => {
    it('should format numbers with commas', () => {
      expect(formatNumber(1000)).toBe('1,000');
      expect(formatNumber(1234567)).toBe('1,234,567');
      expect(formatNumber(42)).toBe('42');
    });
  });

  describe('formatPercentage', () => {
    it('should calculate and format percentages', () => {
      expect(formatPercentage(25, 100)).toBe('25.0%');
      expect(formatPercentage(1, 3)).toBe('33.3%');
      expect(formatPercentage(0, 100)).toBe('0.0%');
    });

    it('should handle division by zero', () => {
      expect(formatPercentage(10, 0)).toBe('0%');
    });
  });

  describe('formatUptime', () => {
    it('should format uptime in different units', () => {
      expect(formatUptime(30)).toBe('0m');
      expect(formatUptime(90)).toBe('1m');
      expect(formatUptime(3600)).toBe('1h 0m');
      expect(formatUptime(3660)).toBe('1h 1m');
      expect(formatUptime(86400)).toBe('1d 0h 0m');
      expect(formatUptime(90061)).toBe('1d 1h 1m');
    });
  });

  describe('formatMemory', () => {
    it('should format memory same as file size', () => {
      expect(formatMemory(1024)).toBe('1 KB');
      expect(formatMemory(1048576)).toBe('1 MB');
    });
  });

  describe('getMessageTypeDisplayName', () => {
    it('should return display names for message types', () => {
      expect(getMessageTypeDisplayName('text')).toBe('Text');
      expect(getMessageTypeDisplayName('image')).toBe('Image');
      expect(getMessageTypeDisplayName('video')).toBe('Video');
      expect(getMessageTypeDisplayName('audio')).toBe('Audio');
      expect(getMessageTypeDisplayName('document')).toBe('Document');
      expect(getMessageTypeDisplayName('sticker')).toBe('Sticker');
      expect(getMessageTypeDisplayName('location')).toBe('Location');
      expect(getMessageTypeDisplayName('contact')).toBe('Contact');
      expect(getMessageTypeDisplayName('poll')).toBe('Poll');
      expect(getMessageTypeDisplayName('reaction')).toBe('Reaction');
      expect(getMessageTypeDisplayName('system')).toBe('System');
    });

    it('should return original type for unknown types', () => {
      expect(getMessageTypeDisplayName('unknown')).toBe('unknown');
    });
  });

  describe('getConnectionStateDisplay', () => {
    it('should return display info for connection states', () => {
      expect(getConnectionStateDisplay('open')).toEqual({
        text: 'Connected',
        color: 'text-success-600'
      });

      expect(getConnectionStateDisplay('connecting')).toEqual({
        text: 'Connecting',
        color: 'text-warning-600'
      });

      expect(getConnectionStateDisplay('close')).toEqual({
        text: 'Disconnected',
        color: 'text-danger-600'
      });
    });

    it('should handle unknown states', () => {
      expect(getConnectionStateDisplay('unknown')).toEqual({
        text: 'unknown',
        color: 'text-gray-600'
      });
    });
  });

  describe('highlightSearchTerm', () => {
    it('should highlight search terms', () => {
      const text = 'This is a test message';
      const result = highlightSearchTerm(text, 'test');
      
      expect(result).toBe('This is a <mark class="bg-yellow-200 dark:bg-yellow-800">test</mark> message');
    });

    it('should be case insensitive', () => {
      const text = 'This is a TEST message';
      const result = highlightSearchTerm(text, 'test');
      
      expect(result).toContain('<mark');
      expect(result).toContain('TEST');
    });

    it('should handle multiple occurrences', () => {
      const text = 'test test test';
      const result = highlightSearchTerm(text, 'test');
      
      const matches = result.match(/<mark/g);
      expect(matches).toHaveLength(3);
    });

    it('should escape special regex characters', () => {
      const text = 'Price: $10.99 (special)';
      const result = highlightSearchTerm(text, '$10.99');
      
      expect(result).toContain('<mark');
      expect(result).toContain('$10.99');
    });

    it('should return original text for empty search', () => {
      const text = 'This is a test message';
      expect(highlightSearchTerm(text, '')).toBe(text);
      expect(highlightSearchTerm(text, '   ')).toBe(text);
    });
  });
});
