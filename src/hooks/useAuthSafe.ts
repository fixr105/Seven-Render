/**
 * Safe auth hook that works with both ApiAuthProvider and AuthProvider
 * Automatically detects which provider is active and uses the appropriate hook
 * 
 * This hook uses useContext directly to avoid violating React's Rules of Hooks
 * by conditionally calling hooks. It checks both contexts and uses whichever is available.
 */

import { useContext } from 'react';
import { ApiAuthContext } from '../contexts/ApiAuthContext';

export const useAuthSafe = () => {
  // Use API auth context (system works purely on Airtable via backend API)
  const apiAuthContext = useContext(ApiAuthContext);
  
  if (apiAuthContext !== undefined) {
    // ApiAuthProvider is available
    return {
      user: apiAuthContext.user,
      userRole: apiAuthContext.user?.role || null,
      userRoleId: apiAuthContext.user?.id || null,
      loading: apiAuthContext.loading,
      signIn: apiAuthContext.login,
      signOut: apiAuthContext.logout,
      refreshUser: apiAuthContext.refreshUser,
      setAuthUserAndToken: apiAuthContext.setAuthUserAndToken,
    };
  } else {
    // No provider available - return defaults
    // Only warn in development to avoid console noise in production
    return {
      user: null,
      userRole: null,
      userRoleId: null,
      loading: false,
      signIn: async () => ({ error: new Error('No auth provider') }),
      signOut: async () => {},
    };
  }
};

