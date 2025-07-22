import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useApi, useApiMutation } from '@/hooks/useApi';
import { AuthProvider } from '@/contexts/AuthContext';
import type { ReactNode } from 'react';

// Mock fetch
global.fetch = vi.fn();

// Mock auth context
const mockAuthContext = {
  user: { id: '1', username: 'test', role: 'admin' as const },
  token: 'mock-token',
  isAuthenticated: true,
  isLoading: false,
  error: null,
  login: vi.fn(),
  logout: vi.fn(),
  clearError: vi.fn(),
  refreshToken: vi.fn(),
};

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockAuthContext,
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}));

describe('useApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthContext.token = 'mock-token';
    mockAuthContext.isAuthenticated = true;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch data successfully', async () => {
    const mockData = { id: 1, name: 'Test' };
    
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: mockData
      })
    });

    const { result } = renderHook(() => useApi('/test-endpoint'));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBe(null);
    expect(result.current.error).toBe(null);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(mockData);
    expect(result.current.error).toBe(null);
    expect(global.fetch).toHaveBeenCalledWith('/test-endpoint', {
      headers: {
        'Authorization': 'Bearer mock-token',
        'Content-Type': 'application/json',
      },
    });
  });

  it('should handle API errors', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: false,
        error: 'API Error'
      })
    });

    const { result } = renderHook(() => useApi('/test-endpoint'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBe(null);
    expect(result.current.error).toBe('API Error');
  });

  it('should handle network errors', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useApi('/test-endpoint'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBe(null);
    expect(result.current.error).toBe('Network error');
  });

  it('should handle 401 unauthorized', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      status: 401,
      ok: false,
    });

    const { result } = renderHook(() => useApi('/test-endpoint'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockAuthContext.logout).toHaveBeenCalled();
  });

  it('should not fetch when disabled', async () => {
    const { result } = renderHook(() => useApi('/test-endpoint', { enabled: false }));

    expect(result.current.loading).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should not fetch when not authenticated', async () => {
    mockAuthContext.token = null;
    mockAuthContext.isAuthenticated = false;

    const { result } = renderHook(() => useApi('/test-endpoint'));

    expect(result.current.loading).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should refetch data when refetch is called', async () => {
    const mockData = { id: 1, name: 'Test' };
    
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: mockData
      })
    });

    const { result } = renderHook(() => useApi('/test-endpoint'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Call refetch
    result.current.refetch();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  it('should call onSuccess callback', async () => {
    const mockData = { id: 1, name: 'Test' };
    const onSuccess = vi.fn();
    
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: mockData
      })
    });

    renderHook(() => useApi('/test-endpoint', { onSuccess }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(mockData);
    });
  });

  it('should call onError callback', async () => {
    const onError = vi.fn();
    
    (global.fetch as any).mockRejectedValueOnce(new Error('Test error'));

    renderHook(() => useApi('/test-endpoint', { onError }));

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});

describe('useApiMutation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthContext.token = 'mock-token';
    mockAuthContext.isAuthenticated = true;
  });

  it('should perform POST mutation successfully', async () => {
    const mockData = { id: 1, name: 'Created' };
    const requestData = { name: 'Test' };
    
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: mockData
      })
    });

    const { result } = renderHook(() => useApiMutation('/test-endpoint', 'POST'));

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBe(null);

    const response = await result.current.mutate(requestData);

    expect(response).toEqual(mockData);
    expect(result.current.data).toEqual(mockData);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(null);

    expect(global.fetch).toHaveBeenCalledWith('/test-endpoint', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer mock-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData)
    });
  });

  it('should handle mutation errors', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: false,
        error: 'Mutation failed'
      })
    });

    const { result } = renderHook(() => useApiMutation('/test-endpoint'));

    await expect(result.current.mutate({})).rejects.toThrow('Mutation failed');
    
    expect(result.current.data).toBe(null);
    expect(result.current.error).toBe('Mutation failed');
  });

  it('should handle 401 during mutation', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      status: 401,
      ok: false,
    });

    const { result } = renderHook(() => useApiMutation('/test-endpoint'));

    await result.current.mutate({});

    expect(mockAuthContext.logout).toHaveBeenCalled();
  });

  it('should not mutate when not authenticated', async () => {
    mockAuthContext.token = null;

    const { result } = renderHook(() => useApiMutation('/test-endpoint'));

    await result.current.mutate({});

    expect(result.current.error).toBe('Not authenticated');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should reset state', async () => {
    const { result } = renderHook(() => useApiMutation('/test-endpoint'));

    // Set some state
    result.current.mutate({}).catch(() => {});
    
    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });

    // Reset
    result.current.reset();

    expect(result.current.data).toBe(null);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('should perform PUT mutation', async () => {
    const mockData = { id: 1, name: 'Updated' };
    
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: mockData
      })
    });

    const { result } = renderHook(() => useApiMutation('/test-endpoint', 'PUT'));

    await result.current.mutate({ name: 'Updated' });

    expect(global.fetch).toHaveBeenCalledWith('/test-endpoint', {
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer mock-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Updated' })
    });
  });

  it('should perform DELETE mutation', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true
      })
    });

    const { result } = renderHook(() => useApiMutation('/test-endpoint', 'DELETE'));

    await result.current.mutate();

    expect(global.fetch).toHaveBeenCalledWith('/test-endpoint', {
      method: 'DELETE',
      headers: {
        'Authorization': 'Bearer mock-token',
        'Content-Type': 'application/json',
      },
      body: undefined
    });
  });
});
