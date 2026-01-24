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
    const user = apiAuthContext.user;
    const userRole = user?.role || null;
    
    // Get role-specific ID based on user role
    let userRoleId: string | null = null;
    if (user) {
      if (userRole === 'client' && user.clientId) {
        userRoleId = user.clientId;
      } else if (userRole === 'kam' && user.kamId) {
        userRoleId = user.kamId;
      } else if (userRole === 'nbfc' && user.nbfcId) {
        userRoleId = user.nbfcId;
      } else if (userRole === 'credit_team' && user.creditTeamId) {
        userRoleId = user.creditTeamId;
      } else {
        // Fallback to user ID if role-specific ID not available
        userRoleId = user.id || null;
      }
    }
    
    return {
      user,
      userRole,
      userRoleId,
      // Expose individual IDs for direct access
      clientId: user?.clientId || null,
      kamId: user?.kamId || null,
      nbfcId: user?.nbfcId || null,
      creditTeamId: user?.creditTeamId || null,
      loading: apiAuthContext.loading,
      /** Username + passcode (used by Login page) → /auth/validate */
      signIn: apiAuthContext.validate,
      /** Email + password → /auth/login */
      login: apiAuthContext.login,
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

