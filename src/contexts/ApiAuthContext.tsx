/**
 * API-based Authentication Context
 * Replaces Supabase auth with backend API auth
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
}

const ApiAuthContext = createContext<ApiAuthContextType | undefined>(undefined);

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
        return { error: response.error || 'Login failed' };
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

  return (
    <ApiAuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        refreshUser,
        hasRole,
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

