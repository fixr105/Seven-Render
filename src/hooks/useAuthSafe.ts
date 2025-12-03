/**
 * Safe auth hook that works with both ApiAuthProvider and AuthProvider
 * Automatically detects which provider is active and uses the appropriate hook
 * 
 * This hook uses useContext directly to avoid violating React's Rules of Hooks
 * by conditionally calling hooks. It checks both contexts and uses whichever is available.
 */

import { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { ApiAuthContext } from '../contexts/ApiAuthContext';

export const useAuthSafe = () => {
  // Always call useContext unconditionally (this is safe - returns undefined if not in provider)
  const authContext = useContext(AuthContext);
  const apiAuthContext = useContext(ApiAuthContext);
  
  // Check which provider is available and use the appropriate one
  if (apiAuthContext !== undefined) {
    // ApiAuthProvider is available
    return {
      user: apiAuthContext.user,
      userRole: apiAuthContext.user?.role || null,
      userRoleId: apiAuthContext.user?.id || null,
      loading: apiAuthContext.loading,
      signIn: apiAuthContext.login,
      signOut: apiAuthContext.logout,
      signInAsTestUser: apiAuthContext.signInAsTestUser,
    };
  } else if (authContext !== undefined) {
    // AuthProvider is available
    return {
      user: authContext.user,
      userRole: authContext.userRole,
      userRoleId: authContext.userRoleId,
      loading: authContext.loading,
      signIn: authContext.signIn,
      signOut: authContext.signOut,
      signInAsTestUser: authContext.signInAsTestUser,
    };
  } else {
    // No provider available - return defaults
    console.warn('No auth provider available, using defaults');
    return {
      user: null,
      userRole: null,
      userRoleId: null,
      loading: false,
      signIn: async () => ({ error: new Error('No auth provider') }),
      signOut: async () => {},
      signInAsTestUser: () => {},
    };
  }
};

