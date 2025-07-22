import type { 
  Message, 
  MessageQuery, 
  PaginatedResponse, 
  StatsOverview, 
  BotStatus,
  Chat,
  MessageEvent,
  ApiResponse 
} from '@/types';

const API_BASE = '/api';

// Helper function to build query string
function buildQueryString(params: Record<string, any>): string {
  const searchParams = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  });
  
  return searchParams.toString();
}

// Helper function to make authenticated requests
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = localStorage.getItem('auth_token');
  
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      // Token expired, redirect to login
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
      throw new Error('Authentication required');
    }
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

// Message API
export const messageApi = {
  // Get messages with filtering and pagination
  getMessages: async (query: MessageQuery): Promise<PaginatedResponse<Message>> => {
    const queryString = buildQueryString(query);
    const endpoint = `/messages${queryString ? `?${queryString}` : ''}`;
    return apiRequest<Message[]>(endpoint);
  },

  // Get single message by ID
  getMessage: async (id: string): Promise<ApiResponse<Message>> => {
    return apiRequest<Message>(`/messages/${id}`);
  },

  // Get message history (edits, deletions, reactions)
  getMessageHistory: async (id: string): Promise<ApiResponse<MessageEvent[]>> => {
    return apiRequest<MessageEvent[]>(`/messages/${id}/history`);
  },

  // Get message media
  getMessageMedia: async (id: string): Promise<Response> => {
    const token = localStorage.getItem('auth_token');
    return fetch(`${API_BASE}/messages/${id}/media`, {
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });
  },
};

// Chat API
export const chatApi = {
  // Get all chats
  getChats: async (): Promise<ApiResponse<Chat[]>> => {
    return apiRequest<Chat[]>('/chats');
  },

  // Get messages for specific chat
  getChatMessages: async (
    chatId: string, 
    query: Omit<MessageQuery, 'chatId'> = {}
  ): Promise<PaginatedResponse<Message>> => {
    const queryString = buildQueryString(query);
    const endpoint = `/chats/${chatId}/messages${queryString ? `?${queryString}` : ''}`;
    return apiRequest<Message[]>(endpoint);
  },

  // Get chat participants
  getChatParticipants: async (chatId: string): Promise<ApiResponse<any[]>> => {
    return apiRequest<any[]>(`/chats/${chatId}/participants`);
  },
};

// Media API
export const mediaApi = {
  // Get media file
  getMedia: async (id: string): Promise<Response> => {
    const token = localStorage.getItem('auth_token');
    return fetch(`${API_BASE}/media/${id}`, {
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });
  },

  // Get media thumbnail
  getThumbnail: async (id: string): Promise<Response> => {
    const token = localStorage.getItem('auth_token');
    return fetch(`${API_BASE}/media/${id}/thumbnail`, {
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });
  },
};

// Stats API
export const statsApi = {
  // Get overview statistics
  getOverview: async (): Promise<ApiResponse<StatsOverview>> => {
    return apiRequest<StatsOverview>('/stats/overview');
  },

  // Get chat statistics
  getChatStats: async (): Promise<ApiResponse<any>> => {
    return apiRequest<any>('/stats/chats');
  },

  // Get media statistics
  getMediaStats: async (): Promise<ApiResponse<any>> => {
    return apiRequest<any>('/stats/media');
  },
};

// Bot API
export const botApi = {
  // Get bot status
  getStatus: async (): Promise<ApiResponse<BotStatus>> => {
    return apiRequest<BotStatus>('/bot/status');
  },
};

// Export API
export const exportApi = {
  // Export data
  exportData: async (format: 'json' | 'csv', query: MessageQuery = {}): Promise<Response> => {
    const token = localStorage.getItem('auth_token');
    return fetch(`${API_BASE}/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify({ format, ...query }),
    });
  },
};

// Health API
export const healthApi = {
  // Get health status
  getHealth: async (): Promise<ApiResponse<any>> => {
    return apiRequest<any>('/health');
  },
};
