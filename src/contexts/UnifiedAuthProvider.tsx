/**
 * Unified Auth Provider
 * Uses API-based authentication (Airtable via backend)
 * Ensures consistent component tree structure to prevent React error #321
 */

import React, { ReactNode } from 'react';
import { ApiAuthProvider } from './ApiAuthContext';

interface UnifiedAuthProviderProps {
  children: ReactNode;
}

/**
 * Unified provider that uses API authentication
 * System works purely on Airtable via backend API
 */
export const UnifiedAuthProvider: React.FC<UnifiedAuthProviderProps> = ({ children }) => {
  return <ApiAuthProvider>{children}</ApiAuthProvider>;
};

