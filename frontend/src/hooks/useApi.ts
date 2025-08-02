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
    if (!enabled || !token) return null;

    setState(prev => ({ ...prev, loading: true, error: null }));

    const controller = new AbortController();

    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      if (response.status === 401) {
        // Token expired or invalid
        logout();
        return controller;
      }

      // Check if response status indicates an error
      if (!response.ok) {
        const errorMessage = `Request failed with status ${response.status}`;
        setState({
          data: null,
          loading: false,
          error: errorMessage,
        });
        onError?.(new Error(errorMessage));
        return controller;
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
      // Don't update state if request was aborted
      if (error instanceof Error && error.name === 'AbortError') {
        return controller;
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Network error';
      setState({
        data: null,
        loading: false,
        error: errorMessage,
      });
      onError?.(error instanceof Error ? error : new Error(errorMessage));
    }
    
    return controller;
  }, [url, enabled, token, logout, onSuccess, onError]);

  // Initial fetch
  useEffect(() => {
    let controller: AbortController | null = null;
    
    const doFetch = async () => {
      controller = await fetchData();
    };
    
    doFetch();
    
    return () => {
      if (controller) {
        controller.abort();
      }
    };
  }, [fetchData]);

  // Refetch interval
  useEffect(() => {
    if (!refetchInterval || !enabled) return;

    const interval = setInterval(() => {
      fetchData();
    }, refetchInterval);
    
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
      const error = new Error('Not authenticated');
      setState(prev => ({ ...prev, error: error.message }));
      throw error;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const requestInit: RequestInit = {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      };

      if (variables) {
        requestInit.body = JSON.stringify(variables);
      }

      const response = await fetch(url, requestInit);

      if (response.status === 401) {
        logout();
        return;
      }

      // Check if response status indicates an error
      if (!response.ok) {
        const errorMessage = `Request failed with status ${response.status}`;
        setState({
          data: null,
          loading: false,
          error: errorMessage,
        });
        throw new Error(errorMessage);
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
