/**
 * Unified Auth Provider
 * Handles both API auth and Supabase auth based on environment variable
 * Ensures consistent component tree structure to prevent React error #321
 * 
 * IMPORTANT: This component must always render the same structure to prevent
 * React error #321. The environment variable is evaluated at module load time.
 */

import React, { ReactNode, useMemo } from 'react';
import { ApiAuthProvider } from './ApiAuthContext';
import { AuthProvider } from './AuthContext';

interface UnifiedAuthProviderProps {
  children: ReactNode;
}

// Evaluate environment variable at module load time (not in component)
// This ensures the component tree structure is consistent across renders
const USE_API_AUTH = import.meta.env.VITE_USE_API_AUTH !== 'false';

/**
 * Unified provider that always renders the same component structure
 * This prevents React error #321 by ensuring hooks are always called in the same order
 * 
 * The environment variable is evaluated once at module load, ensuring consistent
 * component tree structure even if the env var changes (which shouldn't happen in production)
 */
export const UnifiedAuthProvider: React.FC<UnifiedAuthProviderProps> = ({ children }) => {
  // Use useMemo to ensure the provider selection is stable across renders
  // This prevents React from seeing different component trees
  const provider = useMemo(() => {
    if (USE_API_AUTH) {
      return <ApiAuthProvider>{children}</ApiAuthProvider>;
    } else {
      return <AuthProvider>{children}</AuthProvider>;
    }
  }, [children]);
  
  return provider;
};

