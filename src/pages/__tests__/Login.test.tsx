/**
 * Frontend Tests for Login Page (P0)
 * Tests login error handling and success flow
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Login } from '../Login';

const mockSignIn = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../../hooks/useAuthSafe', () => ({
  useAuthSafe: () => ({
    user: null,
    signIn: mockSignIn,
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Login Page - P0 Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows error when login fails', async () => {
    mockSignIn.mockResolvedValue({ error: 'Invalid email or password' });

    render(<Login />);

    await userEvent.type(screen.getByPlaceholderText(/Enter your username/i), 'user@example.com');
    await userEvent.type(screen.getByPlaceholderText(/Enter your passcode/i), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    expect(await screen.findByText(/Invalid email or password/i)).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('navigates to dashboard on successful login', async () => {
    mockSignIn.mockResolvedValue({});

    render(<Login />);

    await userEvent.type(screen.getByPlaceholderText(/Enter your username/i), 'user@example.com');
    await userEvent.type(screen.getByPlaceholderText(/Enter your passcode/i), 'correct');
    await userEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });
});
