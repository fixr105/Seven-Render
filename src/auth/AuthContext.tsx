/**
 * Authentication Context
 * Provides auth state and methods; uses backend /auth/login, /auth/me, /auth/logout
 * Single auth module: exports AuthProvider (component) and useAuth (hook). Fast Refresh relaxed for this file.
 */
/* eslint-disable react-refresh/only-export-components */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiService } from '../services/api';
import { UserContext, UserRole } from './types';

interface AuthContextType {
  user: UserContext | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  hasRole: (role: UserRole) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserContext | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      setLoading(true);
      const response = await apiService.getMe();
      if (response.success && response.data) {
        const userData = response.data;
        if (!userData.name && userData.email) {
          userData.name = userData.email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
        }
        setUser(userData);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (email: string, password: string): Promise<{ error?: string }> => {
    try {
      setLoading(true);
      const response = await apiService.login(email, password);
      if (response.success && response.data?.user) {
        const u = response.data.user;
        if (!u.name && u.email) {
          u.name = u.email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
        }
        setUser(u);
        return {};
      }
      return { error: response.error || 'Invalid email or password' };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : 'Login failed. Please try again.' };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    apiService.logout().catch(() => {});
    setUser(null);
  };

  const hasRole = (role: UserRole): boolean => (user?.role ? user.role === role : false);

  return (
    <AuthContext.Provider
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
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
