import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from '../App';
import { UserContext } from '../auth/types';

const mockUpdateProfile = vi.fn();
const mockRefreshUser = vi.fn();

let currentUser: UserContext | null = null;
let currentLoading = false;
let currentSessionId: string | null = 'session-1';

vi.mock('../services/api', () => ({
  apiService: {
    updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
  },
}));

vi.mock('../auth/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => ({
    user: currentUser,
    loading: currentLoading,
    authSessionId: currentSessionId,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: mockRefreshUser,
    hasRole: vi.fn(() => true),
  }),
}));

vi.mock('../pages/Dashboard', () => ({ Dashboard: () => <div>Dashboard</div> }));
vi.mock('../pages/Applications', () => ({ Applications: () => <div>Applications</div> }));
vi.mock('../pages/ApplicationDetail', () => ({ ApplicationDetail: () => <div>Application Detail</div> }));
vi.mock('../pages/NewApplication', () => ({ NewApplication: () => <div>New Application</div> }));
vi.mock('../pages/Ledger', () => ({ Ledger: () => <div>Ledger</div> }));
vi.mock('../pages/Clients', () => ({ Clients: () => <div>Clients</div> }));
vi.mock('../pages/Profile', () => ({ Profile: () => <div>Profile</div> }));
vi.mock('../pages/Settings', () => ({ Settings: () => <div>Settings</div> }));
vi.mock('../pages/Reports', () => ({ Reports: () => <div>Reports</div> }));
vi.mock('../pages/FormConfiguration', () => ({ FormConfiguration: () => <div>Form Config</div> }));
vi.mock('../pages/ForgotPassword', () => ({ ForgotPassword: () => <div>Forgot Password</div> }));
vi.mock('../pages/ResetPassword', () => ({ ResetPassword: () => <div>Reset Password</div> }));
vi.mock('../pages/Privacy', () => ({ PrivacyPage: () => <div>Privacy</div> }));
vi.mock('../pages/Terms', () => ({ TermsPage: () => <div>Terms</div> }));
vi.mock('../pages/NotFoundPage', () => ({ NotFoundPage: () => <div>Not Found</div> }));
vi.mock('../pages/AdminActivityLog', () => ({ AdminActivityLog: () => <div>Admin Activity</div> }));
vi.mock('../pages/AdminUserAccounts', () => ({ AdminUserAccounts: () => <div>Admin Users</div> }));
vi.mock('../pages/AdminNBFCPartners', () => ({ AdminNBFCPartners: () => <div>Admin NBFC</div> }));
vi.mock('../pages/NBFCTools', () => ({ NBFCTools: () => <div>NBFC Tools</div> }));

const incompleteClient: UserContext = {
  id: 'user-1',
  email: 'client@test.com',
  role: 'client',
  name: 'Client User',
  phone: '',
  company: '',
};

describe('App profile prompt integration', () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockUpdateProfile.mockResolvedValue({ success: true });
    mockRefreshUser.mockResolvedValue(undefined);
    currentUser = incompleteClient;
    currentLoading = false;
    currentSessionId = 'session-1';
    window.history.pushState({}, '', '/dashboard');
  });

  it('shows prompt for incomplete authenticated user', () => {
    render(<App />);
    expect(screen.getByTestId('build-profile-prompt')).toBeInTheDocument();
  });

  it('hides prompt after dismiss for current session and re-shows next session', () => {
    const { rerender } = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Maybe Later/i }));
    expect(screen.queryByTestId('build-profile-prompt')).not.toBeInTheDocument();

    currentSessionId = 'session-2';
    rerender(<App />);
    expect(screen.getByTestId('build-profile-prompt')).toBeInTheDocument();
  });

  it('saves profile via API and refreshes auth user', async () => {
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText(/Enter your full name/i), { target: { value: 'Updated User' } });
    fireEvent.change(screen.getByPlaceholderText(/\+91 9876543210/i), { target: { value: '+919999999999' } });
    fireEvent.change(screen.getByPlaceholderText(/Enter company name/i), { target: { value: 'Updated Co' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Profile/i }));

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith({
        name: 'Updated User',
        phone: '+919999999999',
        company: 'Updated Co',
      });
    });
    expect(mockRefreshUser).toHaveBeenCalledTimes(1);
  });
});
