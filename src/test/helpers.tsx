/**
 * Test Helpers for Frontend Tests
 * Provides utilities for mocking API service, auth context, and common test setup
 */

import React from 'react';
import { vi } from 'vitest';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ApiAuthContext, ApiAuthContextType } from '../contexts/ApiAuthContext';
import { UserContext, UserRole, ApiResponse } from '../services/api';

// Mock API Service
export const createMockApiService = () => {
  const mockApiService = {
    login: vi.fn<(...args: any[]) => Promise<ApiResponse>>(),
    logout: vi.fn(),
    getMe: vi.fn<(...args: any[]) => Promise<ApiResponse<UserContext>>>(),
    getToken: vi.fn<() => string | null>(),
    setToken: vi.fn<(token: string) => void>(),
    clearToken: vi.fn(),
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

// Mock Auth Context Provider
export const createMockAuthContext = (user: UserContext | null = null, loading: boolean = false): ApiAuthContextType => {
  return {
    user,
    loading,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
    hasRole: vi.fn((role: UserRole) => user?.role === role),
    signInAsTestUser: vi.fn(),
  };
};

// Test wrapper with Router and Auth Context
export const TestWrapper: React.FC<{
  children: React.ReactNode;
  authContext?: ApiAuthContextType;
}> = ({ children, authContext }) => {
  const defaultAuthContext = createMockAuthContext();
  const contextValue = authContext || defaultAuthContext;

  return (
    <BrowserRouter>
      <ApiAuthContext.Provider value={contextValue}>
        {children}
      </ApiAuthContext.Provider>
    </BrowserRouter>
  );
};

// Custom render function with default providers
export const renderWithProviders = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & { authContext?: ApiAuthContextType }
) => {
  const { authContext, ...renderOptions } = options || {};
  return render(ui, {
    wrapper: (props) => <TestWrapper {...props} authContext={authContext} />,
    ...renderOptions,
  });
};

// Mock user data
export const mockClientUser: UserContext = {
  id: 'user-1',
  email: 'client@test.com',
  role: 'client',
  clientId: 'CLIENT001',
  name: 'Test Client',
};

export const mockKAMUser: UserContext = {
  id: 'user-2',
  email: 'kam@test.com',
  role: 'kam',
  kamId: 'KAM001',
  name: 'Test KAM',
};

export const mockCreditUser: UserContext = {
  id: 'user-3',
  email: 'credit@test.com',
  role: 'credit_team',
  name: 'Test Credit',
};

export const mockNBFCUser: UserContext = {
  id: 'user-4',
  email: 'nbfc@test.com',
  role: 'nbfc',
  nbfcId: 'NBFC001',
  name: 'Test NBFC',
};

