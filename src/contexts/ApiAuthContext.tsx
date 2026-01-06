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
  setAuthUserAndToken: (user: UserContext, token: string) => void;
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

      // For JWT tokens, call the API
      const response = await apiService.getMe();
      if (response.success && response.data) {
        setUser(response.data);
      } else {
        // Token invalid, clear it
        apiService.clearToken();
        setUser(null);
        // If error indicates auth failure, user needs to login again
        if (response.error?.includes('401') || response.error?.includes('403') || response.error?.includes('Authentication')) {
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

  const setAuthUserAndToken = (userData: UserContext, token: string) => {
    // Set token first
    apiService.setToken(token);
    
    // Set user directly (bypass API call)
    setUser(userData);
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
        setAuthUserAndToken,
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

