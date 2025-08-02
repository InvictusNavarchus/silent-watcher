import type { WAMessage } from '@whiskeysockets/baileys';

// Database Models
export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  messageType: MessageType;
  timestamp: number;
  isFromMe: boolean;
  quotedMessageId?: string | undefined;
  mediaPath?: string | undefined;
  mediaType?: MediaType | undefined;
  mediaMimeType?: string | undefined;
  mediaSize?: number | undefined;
  isForwarded: boolean;
  forwardedFrom?: string | undefined;
  isEphemeral: boolean;
  ephemeralDuration?: number | undefined;
  isViewOnce: boolean;
  reactions: string; // JSON string of reactions
  createdAt: number;
  updatedAt: number;
}

export interface MessageEvent {
  id: string;
  messageId: string;
  eventType: MessageEventType;
  oldContent?: string;
  newContent?: string;
  timestamp: number;
  metadata: string; // JSON string for additional data
  createdAt: number;
}

export interface Chat {
  id: string;
  name: string;
  isGroup: boolean;
  participantCount?: number;
  description?: string;
  profilePicture?: string;
  lastMessageId?: string;
  lastMessageTime?: number;
  isArchived: boolean;
  isMuted: boolean;
  muteUntil?: number;
  createdAt: number;
  updatedAt: number;
}

export interface Media {
  id: string;
  messageId: string;
  fileName: string;
  filePath: string;
  mimeType: string;
  size: number;
  width?: number | undefined;
  height?: number | undefined;
  duration?: number | undefined;
  thumbnailPath?: string | undefined;
  isCompressed: boolean;
  originalSize?: number | undefined;
  createdAt: number;
}

export interface Contact {
  id: string;
  name?: string;
  pushName?: string;
  phoneNumber?: string;
  profilePicture?: string;
  status?: string;
  isBlocked: boolean;
  isBusiness: boolean;
  businessName?: string;
  lastSeen?: number;
  createdAt: number;
  updatedAt: number;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  profilePicture?: string;
  ownerId: string;
  adminIds: string; // JSON array of admin IDs
  participantIds: string; // JSON array of participant IDs
  settings: string; // JSON string of group settings
  inviteCode?: string;
  createdAt: number;
  updatedAt: number;
}

export interface SystemEvent {
  id: string;
  eventType: SystemEventType;
  description: string;
  metadata: string; // JSON string for additional data
  severity: EventSeverity;
  timestamp: number;
  createdAt: number;
}

// Enums
export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  DOCUMENT = 'document',
  STICKER = 'sticker',
  LOCATION = 'location',
  CONTACT = 'contact',
  POLL = 'poll',
  REACTION = 'reaction',
  SYSTEM = 'system'
}

export enum MediaType {
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  DOCUMENT = 'document',
  STICKER = 'sticker'
}

export enum MessageEventType {
  CREATED = 'created',
  EDITED = 'edited',
  DELETED = 'deleted',
  REACTION_ADDED = 'reaction_added',
  REACTION_REMOVED = 'reaction_removed'
}

export enum SystemEventType {
  BOT_STARTED = 'bot_started',
  BOT_STOPPED = 'bot_stopped',
  CONNECTION_OPENED = 'connection_opened',
  CONNECTION_CLOSED = 'connection_closed',
  QR_CODE_GENERATED = 'qr_code_generated',
  AUTHENTICATION_SUCCESS = 'authentication_success',
  AUTHENTICATION_FAILURE = 'authentication_failure',
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info'
}

export enum EventSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// API Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface MessageQuery {
  chatId?: string;
  days?: number;
  type?: MessageType;
  state?: 'all' | 'edited' | 'deleted';
  search?: string;
  limit?: number;
  offset?: number;
}

export interface StatsOverview {
  totalMessages: number;
  totalChats: number;
  totalMedia: number;
  storageUsed: number;
  activeChats: number;
  messagesLast24h: number;
  messagesLast7d: number;
  messagesLast30d: number;
}

// Configuration Types
export interface Config {
  bot: {
    name: string;
    phoneNumber?: string;
    usePairingCode: boolean;
    autoReconnect: boolean;
  };
  database: {
    path: string;
  };
  web: {
    enabled: boolean;
    host: string;
    port: number;
    authEnabled: boolean;
    username?: string;
    password?: string;
    defaultDays: number;
  };
  jwt: {
    secret: string;
    expiresIn: string;
  };
  media: {
    downloadEnabled: boolean;
    maxSizeMB: number;
    compressionEnabled: boolean;
  };
  logging: {
    level: string;
    maxFiles: number;
    maxSize: string;
  };
  dataRetention: {
    days: number;
    autoCleanupEnabled: boolean;
  };
  security: {
    rateLimitWindowMs: number;
    rateLimitMaxRequests: number;
    corsOrigin: string;
  };
}

// Baileys Extended Types
export interface ExtendedWAMessage extends WAMessage {
  messageId: string;
  chatId: string;
  senderId: string;
  isFromMe: boolean;
  timestamp: number;
}

export interface BotState {
  isConnected: boolean;
  connectionState: string;
  qrCode?: string;
  lastConnected?: number;
  messagesProcessed: number;
  uptime: number;
}

// Authentication Types
export interface AuthUser {
  id: string;
  username: string;
  role: 'admin' | 'viewer';
}

export interface JWTPayload {
  userId: string;
  username: string;
  role: string;
  iat: number;
  exp: number;
}
