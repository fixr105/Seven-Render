/**
 * Test wrapper component only. Other helpers (mocks, renderWithProviders) are in helpers.ts for Fast Refresh.
 */

import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { AuthProvider } from '../auth/AuthContext';
import i18n from '../i18n';

export const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <I18nextProvider i18n={i18n}>
      <BrowserRouter>
        <AuthProvider>
          {children}
        </AuthProvider>
      </BrowserRouter>
    </I18nextProvider>
  );
};
