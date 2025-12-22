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
    // Create a mock user for bypass/test mode
    const mockUser: UserContext = {
      id: `test-${role}-${Date.now()}`,
      email: email,
      role: role,
      name: email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      clientId: role === 'client' ? `test-client-${Date.now()}` : undefined,
      kamId: role === 'kam' ? `test-kam-${Date.now()}` : undefined,
      nbfcId: role === 'nbfc' ? `test-nbfc-${Date.now()}` : undefined,
    };

    // Store a test token in localStorage
    const testToken = `test-token-${role}-${Date.now()}`;
    apiService.setToken(testToken);
    
    // Set the user directly (bypass API call)
    setUser(mockUser);
    setLoading(false);
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

