import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { UseWebSocketOptions, WebSocketMessage } from '@/types';

export function useWebSocket(options: UseWebSocketOptions) {
  const {
    url,
    onMessage,
    onConnect,
    onDisconnect,
    onError,
    reconnect = true,
    reconnectInterval = 3000,
  } = options;

  const { token, isAuthenticated } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');

  const connect = useCallback(() => {
    if (!isAuthenticated || !token) {
      setConnectionState('disconnected');
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    try {
      setConnectionState('connecting');
      
      // Create WebSocket URL with auth token
      const wsUrl = new URL(url, window.location.origin);
      wsUrl.protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl.searchParams.set('token', token);

      const ws = new WebSocket(wsUrl.toString());
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionState('connected');
        onConnect?.();
        
        // Clear any pending reconnection
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          onMessage?.(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        setConnectionState('disconnected');
        onDisconnect?.();
        
        // Attempt to reconnect if enabled
        if (reconnect && isAuthenticated) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        onError?.(error);
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionState('disconnected');
      onError?.(error as Event);
    }
  }, [url, token, isAuthenticated, onConnect, onMessage, onDisconnect, onError, reconnect, reconnectInterval]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setConnectionState('disconnected');
  }, []);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected');
    }
  }, []);

  // Connect when authenticated
  useEffect(() => {
    if (isAuthenticated && token) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [isAuthenticated, token, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connectionState,
    sendMessage,
    connect,
    disconnect,
  };
}

// Hook for subscribing to specific WebSocket channels
export function useWebSocketSubscription(
  channel: string,
  onMessage?: (data: unknown) => void
) {
  const { sendMessage, connectionState } = useWebSocket({
    url: '/api/websocket',
    onMessage: (message) => {
      if (message.type === 'message' && message.channel === channel) {
        onMessage?.(message.data);
      }
    },
    onConnect: () => {
      // Subscribe to channel when connected
      sendMessage({
        type: 'subscribe',
        channel,
      });
    },
  });

  const subscribe = useCallback(() => {
    if (connectionState === 'connected') {
      sendMessage({
        type: 'subscribe',
        channel,
      });
    }
  }, [sendMessage, connectionState, channel]);

  const unsubscribe = useCallback(() => {
    if (connectionState === 'connected') {
      sendMessage({
        type: 'unsubscribe',
        channel,
      });
    }
  }, [sendMessage, connectionState, channel]);

  return {
    connectionState,
    subscribe,
    unsubscribe,
  };
}
