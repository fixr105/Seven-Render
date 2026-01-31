/**
 * Test Helpers for Frontend Tests
 * Provides utilities for mocking API service, auth context, and common test setup
 */

import React from 'react';
import { vi } from 'vitest';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext';
import { UserContext, UserRole, ApiResponse } from '../services/api';

export interface MockAuthContextType {
  user: UserContext | null;
  loading: boolean;
  login: ReturnType<typeof vi.fn>;
  logout: ReturnType<typeof vi.fn>;
  refreshUser: ReturnType<typeof vi.fn>;
  hasRole: (role: UserRole) => boolean;
}

// Mock API Service
export const createMockApiService = () => {
  const mockApiService = {
    listApplications: vi.fn<(...args: any[]) => Promise<ApiResponse>>(),
    getApplication: vi.fn<(...args: any[]) => Promise<ApiResponse>>(),
    createApplication: vi.fn<(...args: any[]) => Promise<ApiResponse>>(),
    submitApplication: vi.fn<(...args: any[]) => Promise<ApiResponse>>(),
    getFormConfig: vi.fn<(...args: any[]) => Promise<ApiResponse>>(),
    listLoanProducts: vi.fn<(...args: any[]) => Promise<ApiResponse>>(),
    getClientLedger: vi.fn<(...args: any[]) => Promise<ApiResponse>>(),
    createPayoutRequest: vi.fn<(...args: any[]) => Promise<ApiResponse>>(),
    getClientPayoutRequests: vi.fn<(...args: any[]) => Promise<ApiResponse>>(),
    createQuery: vi.fn<(...args: any[]) => Promise<ApiResponse>>(),
    createQueryReply: vi.fn<(...args: any[]) => Promise<ApiResponse>>(),
    getQueries: vi.fn<(...args: any[]) => Promise<ApiResponse>>(),
    generateAISummary: vi.fn<(...args: any[]) => Promise<ApiResponse>>(),
    uploadDocument: vi.fn<(...args: any[]) => Promise<ApiResponse>>(),
  };

  return mockApiService;
};

// Mock Auth Context (for tests that mock useAuth)
export const createMockAuthContext = (user: UserContext | null = null, loading: boolean = false): MockAuthContextType => {
  return {
    user,
    loading,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
    hasRole: vi.fn((role: UserRole) => user?.role === role),
  };
};

// Test wrapper with Router and Auth (stub provider)
export const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <BrowserRouter>
      <AuthProvider>
        {children}
      </AuthProvider>
    </BrowserRouter>
  );
};

// Custom render function with default providers
export const renderWithProviders = (ui: React.ReactElement, options?: Omit<RenderOptions, 'wrapper'>) => {
  return render(ui, {
    wrapper: TestWrapper,
    ...options,
  });
};

// Mock user data (tests use Sagar@gmail.com / pass@123)
export const mockClientUser: UserContext = {
  id: 'user-1',
  email: 'Sagar@gmail.com',
  role: 'client',
  clientId: 'CLIENT001',
  name: 'Sagar',
};

export const mockKAMUser: UserContext = {
  id: 'user-2',
  email: 'Sagar@gmail.com',
  role: 'kam',
  kamId: 'KAM001',
  name: 'Sagar',
};

export const mockCreditUser: UserContext = {
  id: 'user-3',
  email: 'Sagar@gmail.com',
  role: 'credit_team',
  name: 'Sagar',
};

export const mockNBFCUser: UserContext = {
  id: 'user-4',
  email: 'Sagar@gmail.com',
  role: 'nbfc',
  nbfcId: 'NBFC001',
  name: 'Sagar',
};

