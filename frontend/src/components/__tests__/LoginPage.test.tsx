import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { LoginPage } from '@/pages/LoginPage';

// Mock fetch
global.fetch = vi.fn();

const MockedLoginPage = () => (
  <BrowserRouter>
    <ThemeProvider>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </ThemeProvider>
  </BrowserRouter>
);

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders login form correctly', () => {
    render(<MockedLoginPage />);
    
    expect(screen.getByText('Silent Watcher')).toBeInTheDocument();
    expect(screen.getByText('WhatsApp Bot Dashboard')).toBeInTheDocument();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows validation errors for empty fields', async () => {
    render(<MockedLoginPage />);
    
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    
    // Button should be disabled when fields are empty
    expect(submitButton).toBeDisabled();
  });

  it('enables submit button when fields are filled', async () => {
    const user = userEvent.setup();
    render(<MockedLoginPage />);
    
    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    
    await user.type(usernameInput, 'testuser');
    await user.type(passwordInput, 'testpass');
    
    expect(submitButton).not.toBeDisabled();
  });

  it('toggles password visibility', async () => {
    const user = userEvent.setup();
    render(<MockedLoginPage />);
    
    const passwordInput = screen.getByLabelText(/password/i);
    const toggleButton = screen.getByRole('button', { name: '' }); // Eye icon button
    
    expect(passwordInput).toHaveAttribute('type', 'password');
    
    await user.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'text');
    
    await user.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('handles successful login', async () => {
    const user = userEvent.setup();
    
    // Mock successful login response
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          token: 'mock-jwt-token',
          user: {
            id: '1',
            username: 'testuser',
            role: 'admin'
          }
        }
      })
    });

    render(<MockedLoginPage />);
    
    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    
    await user.type(usernameInput, 'testuser');
    await user.type(passwordInput, 'testpass');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: 'testuser',
          password: 'testpass'
        })
      });
    });
  });

  it('handles login failure', async () => {
    const user = userEvent.setup();
    
    // Mock failed login response
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        success: false,
        error: 'Invalid credentials'
      })
    });

    render(<MockedLoginPage />);
    
    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    
    await user.type(usernameInput, 'testuser');
    await user.type(passwordInput, 'wrongpass');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });

  it('shows loading state during login', async () => {
    const user = userEvent.setup();
    
    // Mock delayed response
    (global.fetch as any).mockImplementationOnce(() => 
      new Promise(resolve => setTimeout(() => resolve({
        ok: true,
        json: async () => ({
          success: true,
          data: { token: 'token', user: { id: '1', username: 'test', role: 'admin' } }
        })
      }), 100))
    );

    render(<MockedLoginPage />);
    
    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    
    await user.type(usernameInput, 'testuser');
    await user.type(passwordInput, 'testpass');
    await user.click(submitButton);
    
    // Should show loading state
    expect(screen.getByText('Signing in...')).toBeInTheDocument();
    expect(submitButton).toBeDisabled();
  });

  it('clears error when user starts typing', async () => {
    const user = userEvent.setup();
    
    // Mock failed login first
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        success: false,
        error: 'Invalid credentials'
      })
    });

    render(<MockedLoginPage />);
    
    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    
    // Trigger error
    await user.type(usernameInput, 'testuser');
    await user.type(passwordInput, 'wrongpass');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
    
    // Start typing again - error should clear
    await user.type(usernameInput, 'x');
    
    await waitFor(() => {
      expect(screen.queryByText('Invalid credentials')).not.toBeInTheDocument();
    });
  });

  it('handles network errors gracefully', async () => {
    const user = userEvent.setup();
    
    // Mock network error
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    render(<MockedLoginPage />);
    
    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    
    await user.type(usernameInput, 'testuser');
    await user.type(passwordInput, 'testpass');
    await user.click(submitButton);
    
    // Should handle the error gracefully
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
  });
});
