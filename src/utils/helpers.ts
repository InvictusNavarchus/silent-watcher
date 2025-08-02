import { randomUUID } from 'crypto';
import { createHash } from 'crypto';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return randomUUID();
}

/**
 * Generate a hash from string
 */
export function generateHash(input: string, algorithm: 'md5' | 'sha256' = 'sha256'): string {
  return createHash(algorithm).update(input).digest('hex');
}

/**
 * Get current Unix timestamp in seconds
 */
export function getCurrentTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Convert Unix timestamp to ISO string
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString();
}

/**
 * Convert milliseconds to seconds
 */
export function msToSeconds(ms: number): number {
  return Math.floor(ms / 1000);
}

/**
 * Convert seconds to milliseconds
 */
export function secondsToMs(seconds: number): number {
  return seconds * 1000;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxAttempts) {
        throw lastError;
      }
      
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await sleep(delay);
    }
  }
  
  throw lastError!;
}

/**
 * Sanitize filename for safe storage
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Parse duration string to milliseconds
 */
export function parseDuration(duration: string): number {
  const units: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  };
  
  const match = duration.match(/^(\d+)([a-z]+)$/i);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }
  
  const [, value, unit] = match;
  const multiplier = units[unit!.toLowerCase()];
  
  if (!multiplier) {
    throw new Error(`Unknown duration unit: ${unit}`);
  }
  
  return parseInt(value!, 10) * multiplier;
}

/**
 * Truncate string to specified length
 */
export function truncateString(str: string, maxLength: number, suffix: string = '...'): string {
  if (str.length <= maxLength) {
    return str;
  }
  
  return str.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Deep clone object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T;
  }
  
  if (obj instanceof Array) {
    return obj.map(item => deepClone(item)) as unknown as T;
  }
  
  if (typeof obj === 'object') {
    const cloned = {} as Record<string, unknown>;
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned as T;
  }
  
  return obj;
}

/**
 * Check if object is empty
 */
export function isEmpty(obj: unknown): boolean {
  if (obj === null || obj === undefined) {
    return true;
  }
  
  if (typeof obj === 'string' || Array.isArray(obj)) {
    return obj.length === 0;
  }
  
  if (typeof obj === 'object') {
    return Object.keys(obj).length === 0;
  }
  
  return false;
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Get system information
 */
export async function getSystemInfo(): Promise<Record<string, unknown>> {
  const baseInfo = {
    uptime: process.uptime(),
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch
  };

  // Only run Linux-specific commands on Linux platform
  if (process.platform !== 'linux') {
    return {
      ...baseInfo,
      warning: 'Limited system info available on non-Linux platforms'
    };
  }

  try {
    const { stdout: memInfo } = await execAsync('free -m');
    const { stdout: diskInfo } = await execAsync('df -h /');
    const { stdout: cpuInfo } = await execAsync('cat /proc/loadavg');
    
    return {
      ...baseInfo,
      memory: memInfo.trim(),
      disk: diskInfo.trim(),
      cpu: cpuInfo.trim()
    };
  } catch (error) {
    return {
      ...baseInfo,
      error: 'Could not fetch Linux system info'
    };
  }
}

/**
 * Validate phone number format
 */
export function isValidPhoneNumber(phoneNumber: string): boolean {
  // Basic international phone number validation
  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  return phoneRegex.test(phoneNumber);
}

/**
 * Extract phone number from WhatsApp JID
 */
export function extractPhoneNumber(jid: string): string {
  return jid.split('@')[0] || jid;
}

/**
 * Check if JID is a group
 */
export function isGroupJid(jid: string): boolean {
  return jid.includes('@g.us');
}

/**
 * Check if JID is a broadcast
 */
export function isBroadcastJid(jid: string): boolean {
  return jid.includes('@broadcast');
}

/**
 * Normalize JID format
 */
export function normalizeJid(jid: string): string {
  if (jid.includes('@')) {
    return jid;
  }
  
  // Assume it's a phone number if no @ symbol
  return `${jid}@s.whatsapp.net`;
}
