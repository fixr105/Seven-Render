/**
 * Safe auth hook that works with both ApiAuthProvider and AuthProvider
 * Automatically detects which provider is active and uses the appropriate hook
 */

import { useAuth } from '../contexts/AuthContext';
import { useApiAuth } from '../contexts/ApiAuthContext';

export const useAuthSafe = () => {
  const useApiAuthEnv = import.meta.env.VITE_USE_API_AUTH !== 'false';
  
  try {
    if (useApiAuthEnv) {
      const apiAuth = useApiAuth();
      return {
        user: apiAuth.user,
        userRole: apiAuth.user?.role || null,
        userRoleId: apiAuth.user?.id || null,
        loading: apiAuth.loading,
        signIn: apiAuth.login,
        signOut: apiAuth.logout,
        signInAsTestUser: () => {}, // Not available in API auth
      };
    } else {
      const auth = useAuth();
      return {
        user: auth.user,
        userRole: auth.userRole,
        userRoleId: auth.userRoleId,
        loading: auth.loading,
        signIn: auth.signIn,
        signOut: auth.signOut,
        signInAsTestUser: auth.signInAsTestUser,
      };
    }
  } catch (error) {
    // If neither hook works, return safe defaults
    console.warn('No auth provider available, using defaults:', error);
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

