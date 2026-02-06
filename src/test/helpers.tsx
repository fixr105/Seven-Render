/**
 * Test wrapper component only. Other helpers (mocks, renderWithProviders) are in helpers.ts for Fast Refresh.
 */

import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext';

export const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <BrowserRouter>
      <AuthProvider>
        {children}
      </AuthProvider>
    </BrowserRouter>
  );
};
