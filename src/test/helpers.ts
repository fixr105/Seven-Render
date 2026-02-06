/**
 * Test helpers (non-component): mocks, constants, renderWithProviders.
 * Component TestWrapper is in helpers.tsx for Fast Refresh.
 */

import React from 'react';
import { vi } from 'vitest';
import { render, RenderOptions } from '@testing-library/react';
import { UserContext, UserRole, ApiResponse } from '../services/api';
import { TestWrapper } from './helpers.tsx';

export { TestWrapper };

export interface MockAuthContextType {
  user: UserContext | null;
  loading: boolean;
  login: ReturnType<typeof vi.fn>;
  logout: ReturnType<typeof vi.fn>;
  refreshUser: ReturnType<typeof vi.fn>;
  hasRole: (role: UserRole) => boolean;
}

export const createMockApiService = () => {
  const mockApiService = {
    listApplications: vi.fn<(...args: unknown[]) => Promise<ApiResponse>>(),
    getApplication: vi.fn<(...args: unknown[]) => Promise<ApiResponse>>(),
    createApplication: vi.fn<(...args: unknown[]) => Promise<ApiResponse>>(),
    submitApplication: vi.fn<(...args: unknown[]) => Promise<ApiResponse>>(),
    getFormConfig: vi.fn<(...args: unknown[]) => Promise<ApiResponse>>(),
    listLoanProducts: vi.fn<(...args: unknown[]) => Promise<ApiResponse>>(),
    getClientLedger: vi.fn<(...args: unknown[]) => Promise<ApiResponse>>(),
    createPayoutRequest: vi.fn<(...args: unknown[]) => Promise<ApiResponse>>(),
    getClientPayoutRequests: vi.fn<(...args: unknown[]) => Promise<ApiResponse>>(),
    createQuery: vi.fn<(...args: unknown[]) => Promise<ApiResponse>>(),
    createQueryReply: vi.fn<(...args: unknown[]) => Promise<ApiResponse>>(),
    getQueries: vi.fn<(...args: unknown[]) => Promise<ApiResponse>>(),
    generateAISummary: vi.fn<(...args: unknown[]) => Promise<ApiResponse>>(),
    uploadDocument: vi.fn<(...args: unknown[]) => Promise<ApiResponse>>(),
  };
  return mockApiService;
};

export const createMockAuthContext = (user: UserContext | null = null, loading = false): MockAuthContextType => {
  return {
    user,
    loading,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
    hasRole: vi.fn((role: UserRole) => user?.role === role),
  };
};

export const renderWithProviders = (ui: React.ReactElement, options?: Omit<RenderOptions, 'wrapper'>) => {
  return render(ui, {
    wrapper: TestWrapper,
    ...options,
  });
};

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
