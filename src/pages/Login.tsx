import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { user, signIn, signInAsTestUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleLogin = async (userEmail: string, userPassword: string) => {
    setError('');
    setLoading(true);
    setEmail(userEmail);
    setPassword(userPassword);

    try {
      const { error: signInError } = await signIn(userEmail, userPassword);

      if (signInError) {
        // Provide more helpful error messages
        let errorMessage = signInError.message || 'Invalid email or password';
        
        if (signInError.message?.includes('Email not confirmed')) {
          errorMessage = 'Email not confirmed. Please check your email or contact administrator.';
        } else if (signInError.message?.includes('Invalid login credentials')) {
          errorMessage = 'Invalid email or password. Please check your credentials or create a test user first.';
        } else if (signInError.message?.includes('Failed to fetch')) {
          errorMessage = 'Connection error. Please check your Supabase configuration in .env file.';
        }
        
        setError(errorMessage);
        setLoading(false);
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleLogin(email, password);
  };

  return (
    <div className="min-h-screen bg-neutral-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo and title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-primary rounded-lg mb-4">
            <span className="text-white font-bold text-2xl">SF</span>
          </div>
          <h1 className="text-2xl font-bold text-neutral-900">Seven Fincorp</h1>
          <p className="text-neutral-500 mt-2">Loan Management Dashboard</p>
        </div>

        {/* Login form */}
        <div className="bg-white rounded shadow-level-2 p-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-6">Sign in to your account</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-error">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              label="Email Address"
              placeholder="Enter your email"
              icon={Mail}
              iconPosition="left"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                label="Password"
                placeholder="Enter your password"
                icon={Lock}
                iconPosition="left"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-[38px] text-neutral-500 hover:text-neutral-700"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded border-neutral-300 text-brand-primary focus:ring-brand-primary" />
                Remember me
              </label>
              <a href="#" className="text-sm text-brand-primary hover:underline">
                Forgot password?
              </a>
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              loading={loading}
            >
              Sign In
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-neutral-500">
              Need access? Contact your administrator
            </p>
          </div>

          {/* Quick Login Buttons - Bypass Mode */}
          <div className="mt-6 pt-6 border-t border-neutral-200">
            <p className="text-xs font-semibold text-neutral-500 uppercase mb-3">Quick Login (Bypass Mode)</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setError('');
                  signInAsTestUser('client', 'client@test.com');
                  navigate('/dashboard');
                }}
                disabled={loading}
                className="px-3 py-2 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                👤 Client
              </button>
              <button
                type="button"
                onClick={() => {
                  setError('');
                  signInAsTestUser('kam', 'kam@test.com');
                  navigate('/dashboard');
                }}
                disabled={loading}
                className="px-3 py-2 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                👔 KAM
              </button>
              <button
                type="button"
                onClick={() => {
                  setError('');
                  signInAsTestUser('credit_team', 'credit@test.com');
                  navigate('/dashboard');
                }}
                disabled={loading}
                className="px-3 py-2 text-xs font-medium text-white bg-purple-600 rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                💼 Credit
              </button>
              <button
                type="button"
                onClick={() => {
                  setError('');
                  signInAsTestUser('nbfc', 'nbfc@test.com');
                  navigate('/dashboard');
                }}
                disabled={loading}
                className="px-3 py-2 text-xs font-medium text-white bg-orange-600 rounded hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                🏦 NBFC
              </button>
            </div>
            <p className="mt-2 text-xs text-neutral-500 text-center">
              ⚡ Instant login - No authentication required
            </p>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-neutral-500">
          <p>© 2025 Seven Fincorp. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};
