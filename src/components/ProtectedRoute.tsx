import React from 'react';
import { Navigate } from 'react-router-dom';
// Support both API auth and Supabase auth
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../lib/supabase';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  // Check which auth system is being used
  const useApiAuth = import.meta.env.VITE_USE_API_AUTH !== 'false';
  
  let user: any = null;
  let userRole: UserRole | null = null;
  let loading = false;

  if (useApiAuth) {
    // Use API auth
    try {
      const { useApiAuth: useApiAuthHook } = require('../contexts/ApiAuthContext');
      const apiAuth = useApiAuthHook();
      user = apiAuth.user;
      userRole = apiAuth.user?.role as UserRole;
      loading = apiAuth.loading;
    } catch (error) {
      // API auth not available, fallback to Supabase
      const auth = useAuth();
      user = auth.user;
      userRole = auth.userRole;
      loading = auth.loading;
    }
  } else {
    // Use Supabase auth
    const auth = useAuth();
    user = auth.user;
    userRole = auth.userRole;
    loading = auth.loading;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-100">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-neutral-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && userRole && !allowedRoles.includes(userRole)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};
