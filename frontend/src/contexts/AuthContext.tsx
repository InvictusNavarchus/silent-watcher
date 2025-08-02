import { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';
import type { AuthUser, LoginRequest, LoginResponse, ApiResponse } from '@/types';

// Auth State
interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// Auth Actions
type AuthAction =
  | { type: 'LOGIN_START' }
  | { type: 'LOGIN_SUCCESS'; payload: { user: AuthUser; token: string } }
  | { type: 'LOGIN_FAILURE'; payload: string }
  | { type: 'LOGOUT' }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SET_LOADING'; payload: boolean };

// Auth Context
interface AuthContextType extends AuthState {
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth Reducer
function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'LOGIN_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      };
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };
    case 'LOGIN_FAILURE':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload,
      };
    case 'LOGOUT':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      };
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };
    default:
      return state;
  }
}

// Initial state
const initialState: AuthState = {
  user: null,
  token: localStorage.getItem('auth_token'),
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

// Auth Provider
interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Check for existing token on mount
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      // Verify token and get user info
      verifyToken(token);
    }
  }, []);

  // Verify token with server
  const verifyToken = async (token: string) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      const response = await fetch('/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result: ApiResponse<AuthUser> = await response.json();
        if (result.success && result.data) {
          dispatch({
            type: 'LOGIN_SUCCESS',
            payload: { user: result.data, token },
          });
        } else {
          throw new Error(result.error || 'Token verification failed');
        }
      } else {
        throw new Error('Token verification failed');
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      localStorage.removeItem('auth_token');
      dispatch({ type: 'LOGOUT' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // Login function
  const login = async (credentials: LoginRequest) => {
    try {
      dispatch({ type: 'LOGIN_START' });

      const response = await fetch('/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      const result: ApiResponse<LoginResponse> = await response.json();

      if (response.ok && result.success && result.data) {
        const { user, token } = result.data;
        
        // Store token in localStorage
        localStorage.setItem('auth_token', token);
        
        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: { user, token },
        });
      } else {
        throw new Error(result.error || 'Login failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      dispatch({ type: 'LOGIN_FAILURE', payload: errorMessage });
      throw error;
    }
  };

  // Logout function
  const logout = () => {
    localStorage.removeItem('auth_token');
    dispatch({ type: 'LOGOUT' });
    
    // Call logout endpoint to invalidate token on server
    fetch('/auth/logout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${state.token}`,
        'Content-Type': 'application/json',
      },
    }).catch(console.error);
  };

  // Clear error function
  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  // Refresh token function
  const refreshToken = async () => {
    try {
      if (!state.token) {
        throw new Error('No token available');
      }

      const response = await fetch('/auth/refresh', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${state.token}`,
          'Content-Type': 'application/json',
        },
      });

      const result: ApiResponse<{ token: string }> = await response.json();

      if (response.ok && result.success && result.data) {
        const { token } = result.data;
        localStorage.setItem('auth_token', token);
        
        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: { user: state.user!, token },
        });
      } else {
        throw new Error(result.error || 'Token refresh failed');
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      logout();
      throw error;
    }
  };

  const contextValue: AuthContextType = {
    ...state,
    login,
    logout,
    clearError,
    refreshToken,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
