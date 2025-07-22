// API Response Types
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

// Message Types
export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  messageType: MessageType;
  timestamp: number;
  isFromMe: boolean;
  quotedMessageId?: string;
  mediaPath?: string;
  mediaType?: MediaType;
  mediaMimeType?: string;
  mediaSize?: number;
  isForwarded: boolean;
  forwardedFrom?: string;
  isEphemeral: boolean;
  ephemeralDuration?: number;
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
  metadata: string;
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

// Query Types
export interface MessageQuery {
  chatId?: string;
  days?: number;
  type?: MessageType;
  state?: 'all' | 'edited' | 'deleted';
  search?: string;
  limit?: number;
  offset?: number;
}

// Statistics Types
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

// Authentication Types
export interface AuthUser {
  id: string;
  username: string;
  role: 'admin' | 'viewer';
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

// Bot Status Types
export interface BotState {
  isConnected: boolean;
  connectionState: string;
  qrCode?: string;
  lastConnected?: number;
  messagesProcessed: number;
  uptime: number;
}

export interface BotStatus {
  whatsapp: BotState;
  database: {
    connected: boolean;
  };
  system: {
    uptime: number;
    memory: NodeJS.MemoryUsage;
    version: string;
  };
}

// UI State Types
export interface FilterState {
  chatId?: string;
  days: number;
  messageType?: MessageType;
  messageState: 'all' | 'edited' | 'deleted';
  search: string;
}

export interface UIState {
  sidebarOpen: boolean;
  darkMode: boolean;
  filters: FilterState;
  selectedMessage?: Message;
  loading: boolean;
  error?: string;
}

// WebSocket Types
export interface WebSocketMessage {
  type: string;
  data?: unknown;
  message?: string;
  channel?: string;
}

// Theme Types
export type Theme = 'light' | 'dark' | 'system';

// Component Props Types
export interface MessageBubbleProps {
  message: Message;
  contact?: Contact;
  onSelect?: (message: Message) => void;
  showHistory?: boolean;
}

export interface ChatListItemProps {
  chat: Chat;
  isSelected: boolean;
  onClick: (chat: Chat) => void;
  unreadCount?: number;
}

export interface FilterPanelProps {
  filters: FilterState;
  onFiltersChange: (filters: Partial<FilterState>) => void;
  chats: Chat[];
}

// Hook Types
export interface UseApiOptions {
  enabled?: boolean;
  refetchInterval?: number;
  onSuccess?: (data: unknown) => void;
  onError?: (error: Error) => void;
}

export interface UseWebSocketOptions {
  url: string;
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  reconnect?: boolean;
  reconnectInterval?: number;
}

// Error Types
export interface AppError {
  message: string;
  code?: string;
  details?: unknown;
  timestamp: number;
}

// Export utility type helpers
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
