/**
 * Forgot Password - Admin-only reset
 * Self-service password reset is not implemented. Users must contact their administrator.
 */

import React from 'react';
import { Link } from 'react-router-dom';

export const ForgotPassword: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-neutral-100">
    <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-level-2 text-center">
      <h1 className="text-2xl font-bold text-neutral-900 mb-2">Forgot password?</h1>
      <p className="text-neutral-600 mb-6">
        Password reset is admin-only. Please contact your administrator to reset your password.
      </p>
      <Link to="/login" className="text-brand-primary hover:underline">
        Back to login
      </Link>
    </div>
  </div>
);
