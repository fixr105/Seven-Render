/**
 * API-based Authentication Context
 * Handles authentication via backend API (Airtable-based)
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiService, UserContext, UserRole } from '../services/api';

interface ApiAuthContextType {
  user: UserContext | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  hasRole: (role: UserRole) => boolean;
  signInAsTestUser: (role: UserRole, email: string) => void;
}

export const ApiAuthContext = createContext<ApiAuthContextType | undefined>(undefined);

export const ApiAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserContext | null>(null);
  const [loading, setLoading] = useState(true);

  // Load user on mount
  useEffect(() => {
    refreshUser();
  }, []);

  const refreshUser = async () => {
    try {
      const token = apiService.getToken();
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }

      // Check if token is in old format (test-token-{role}-{timestamp})
      // If so, clear it so user can log in again with new format
      if (token.startsWith('test-token-') && !token.includes('@')) {
        console.warn('[ApiAuthContext] Old token format detected, clearing token. Please log in again.');
        apiService.clearToken();
        setUser(null);
        setLoading(false);
        return;
      }

      // Handle test tokens - create mock user directly without API call
      if (token.startsWith('test-token-') && token.includes('@')) {
        const roleAndTimestamp = token.replace('test-token-', '');
        const atIndex = roleAndTimestamp.indexOf('@');
        const role = atIndex > 0 ? roleAndTimestamp.substring(0, atIndex) : roleAndTimestamp;
        
        const userProfiles: Record<string, Partial<UserContext>> = {
          'client': {
            name: 'Test Client',
            clientId: 'TEST-CLIENT-001',
            email: 'client@test.com',
          },
          'kam': {
            name: 'Test KAM',
            kamId: 'TEST-KAM-001',
            email: 'kam@test.com',
          },
          'credit_team': {
            name: 'Test Credit',
            email: 'credit@test.com',
          },
          'nbfc': {
            name: 'Test NBFC',
            nbfcId: 'TEST-NBFC-001',
            email: 'nbfc@test.com',
          },
        };
        
        const profile = userProfiles[role] || {};
        const mockUser: UserContext = {
          id: `test-${role}-${Date.now()}`,
          email: profile.email || `${role}@test.com`,
          role: role as UserRole,
          name: profile.name || role,
          clientId: profile.clientId,
          kamId: profile.kamId,
          nbfcId: profile.nbfcId,
        };
        
        setUser(mockUser);
        setLoading(false);
        return;
      }

      // For real JWT tokens, call the API
      const response = await apiService.getMe();
      if (response.success && response.data) {
        setUser(response.data);
      } else {
        // Token invalid, clear it
        apiService.clearToken();
        setUser(null);
        // If error indicates auth failure, user needs to login again
        if (response.error?.includes('401') || response.error?.includes('403') || response.error?.includes('Authentication')) {
          console.warn('Authentication failed, user needs to login again');
        }
      }
    } catch (error) {
      apiService.clearToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await apiService.login(email, password);
      
      if (response.success && response.data) {
        setUser(response.data.user);
        return {};
      } else {
        // Return error string
        const errorMessage = response.error || 'Login failed';
        return { error: errorMessage };
      }
    } catch (error: any) {
      console.error('Login error in ApiAuthContext:', error);
      return { error: error.message || 'Login failed' };
    }
  };

  const logout = () => {
    apiService.logout();
    setUser(null);
  };

  const hasRole = (role: UserRole): boolean => {
    return user?.role === role;
  };

  const signInAsTestUser = (role: UserRole, email: string) => {
    console.log('[ApiAuthContext] signInAsTestUser called with:', { role, email });
    
    // User profiles matching the specified emails
    const userProfiles: Record<string, Partial<UserContext>> = {
      'client@test.com': {
        name: 'Test Client',
        clientId: 'TEST-CLIENT-001',
      },
      'kam@test.com': {
        name: 'Test KAM',
        kamId: 'TEST-KAM-001',
      },
      'credit@test.com': {
        name: 'Test Credit',
      },
      'nbfc@test.com': {
        name: 'Test NBFC',
        nbfcId: 'TEST-NBFC-001',
      },
    };

    // Create a mock user for bypass/test mode
    const profile = userProfiles[email] || {};
    const mockUser: UserContext = {
      id: `test-${role}-${Date.now()}`,
      email: email,
      role: role,
      name: profile.name || email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      clientId: profile.clientId,
      kamId: profile.kamId,
      nbfcId: profile.nbfcId,
    };

    // Store a test token in localStorage FIRST (before setting user state)
    // Token format: test-token-{role}@{timestamp}
    // Using '@' separator allows roles with underscores (e.g., credit_team)
    // This ensures the token is available immediately for any API calls
    const testToken = `test-token-${role}@${Date.now()}`;
    console.log('[ApiAuthContext] Setting test token:', testToken.substring(0, 30) + '...');
    
    apiService.setToken(testToken);
    
    // Verify token was set in both service and localStorage
    const verifyToken = apiService.getToken();
    const verifyStorage = localStorage.getItem('auth_token');
    
    console.log('[ApiAuthContext] Token verification:', {
      serviceToken: verifyToken ? `${verifyToken.substring(0, 20)}...` : 'null',
      storageToken: verifyStorage ? `${verifyStorage.substring(0, 20)}...` : 'null',
      match: verifyToken === verifyStorage,
    });
    
    if (!verifyToken || !verifyStorage) {
      console.error('[ApiAuthContext] ❌ Failed to set test token!');
      console.error('[ApiAuthContext] Service token:', verifyToken);
      console.error('[ApiAuthContext] Storage token:', verifyStorage);
    } else {
      console.log('[ApiAuthContext] ✅ Test token set successfully');
    }
    
    // Set the user directly (bypass API call)
    setUser(mockUser);
    setLoading(false);
    console.log('[ApiAuthContext] User state set:', mockUser);
  };

  return (
    <ApiAuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        refreshUser,
        hasRole,
        signInAsTestUser,
      }}
    >
      {children}
    </ApiAuthContext.Provider>
  );
};

export const useApiAuth = () => {
  const context = useContext(ApiAuthContext);
  if (context === undefined) {
    throw new Error('useApiAuth must be used within ApiAuthProvider');
  }
  return context;
};

