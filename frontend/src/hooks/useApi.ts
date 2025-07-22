import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { ApiResponse, UseApiOptions } from '@/types';

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useApi<T>(
  url: string,
  options: UseApiOptions = {}
) {
  const { enabled = true, refetchInterval, onSuccess, onError } = options;
  const { token, logout } = useAuth();
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const fetchData = useCallback(async () => {
    if (!enabled || !token) return;

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401) {
        // Token expired or invalid
        logout();
        return;
      }

      const result: ApiResponse<T> = await response.json();

      if (result.success && result.data !== undefined) {
        setState({
          data: result.data,
          loading: false,
          error: null,
        });
        onSuccess?.(result.data);
      } else {
        const errorMessage = result.error || 'Request failed';
        setState({
          data: null,
          loading: false,
          error: errorMessage,
        });
        onError?.(new Error(errorMessage));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Network error';
      setState({
        data: null,
        loading: false,
        error: errorMessage,
      });
      onError?.(error instanceof Error ? error : new Error(errorMessage));
    }
  }, [url, enabled, token, logout, onSuccess, onError]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Refetch interval
  useEffect(() => {
    if (!refetchInterval || !enabled) return;

    const interval = setInterval(fetchData, refetchInterval);
    return () => clearInterval(interval);
  }, [fetchData, refetchInterval, enabled]);

  const refetch = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return {
    ...state,
    refetch,
  };
}

// Specialized hook for mutations (POST, PUT, DELETE)
export function useApiMutation<TData, TVariables = unknown>(
  url: string,
  method: 'POST' | 'PUT' | 'DELETE' = 'POST'
) {
  const { token, logout } = useAuth();
  const [state, setState] = useState<UseApiState<TData>>({
    data: null,
    loading: false,
    error: null,
  });

  const mutate = useCallback(async (variables?: TVariables) => {
    if (!token) {
      setState(prev => ({ ...prev, error: 'Not authenticated' }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: variables ? JSON.stringify(variables) : undefined,
      });

      if (response.status === 401) {
        logout();
        return;
      }

      const result: ApiResponse<TData> = await response.json();

      if (result.success) {
        setState({
          data: result.data || null,
          loading: false,
          error: null,
        });
        return result.data;
      } else {
        const errorMessage = result.error || 'Request failed';
        setState({
          data: null,
          loading: false,
          error: errorMessage,
        });
        throw new Error(errorMessage);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Network error';
      setState({
        data: null,
        loading: false,
        error: errorMessage,
      });
      throw error;
    }
  }, [url, method, token, logout]);

  const reset = useCallback(() => {
    setState({
      data: null,
      loading: false,
      error: null,
    });
  }, []);

  return {
    ...state,
    mutate,
    reset,
  };
}
