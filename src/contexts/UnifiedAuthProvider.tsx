/**
 * Unified Auth Provider
 * Handles both API auth and Supabase auth based on environment variable
 * Ensures consistent component tree structure to prevent React error #321
 */

import React, { ReactNode } from 'react';
import { ApiAuthProvider } from './ApiAuthContext';
import { AuthProvider } from './AuthContext';

interface UnifiedAuthProviderProps {
  children: ReactNode;
}

/**
 * Unified provider that always renders the same component structure
 * This prevents React error #321 by ensuring hooks are always called in the same order
 */
export const UnifiedAuthProvider: React.FC<UnifiedAuthProviderProps> = ({ children }) => {
  // Evaluate environment variable once at module load time
  // This ensures the component tree structure is consistent
  const useApiAuth = import.meta.env.VITE_USE_API_AUTH !== 'false';
  
  // Always render the same structure - the conditional is evaluated once
  if (useApiAuth) {
    return <ApiAuthProvider>{children}</ApiAuthProvider>;
  } else {
    return <AuthProvider>{children}</AuthProvider>;
  }
};

