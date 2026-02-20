import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export const NotFoundPage: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-100">
      <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-level-2 text-center">
        <h1 className="text-6xl font-bold text-neutral-400 mb-2">404</h1>
        <h2 className="text-xl font-semibold text-neutral-900 mb-2">Page not found</h2>
        <p className="text-neutral-600 mb-6">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          to={user ? '/dashboard' : '/login'}
          className="inline-block px-4 py-2 bg-brand-primary text-white rounded hover:opacity-90 transition-opacity"
        >
          {user ? 'Go to Dashboard' : 'Go to Login'}
        </Link>
      </div>
    </div>
  );
};
