import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../components/ui/Modal';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuthSafe } from '../hooks/useAuthSafe';
import { supabase } from '../lib/supabase';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { user, signIn } = useAuthSafe();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

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

  const handleForgotPassword = async () => {
    if (!resetEmail.trim()) {
      setError('Please enter your email address');
      return;
    }

    setResetLoading(true);
    setError('');

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) {
        setError(resetError.message || 'Failed to send password reset email');
        setResetLoading(false);
      } else {
        setResetSuccess(true);
        setResetLoading(false);
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      setResetLoading(false);
    }
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
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-sm text-brand-primary hover:underline"
              >
                Forgot password?
              </button>
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

          {/* Dummy Login Credentials */}
          <div className="mt-6 pt-6 border-t border-neutral-200">
            <p className="text-xs font-semibold text-neutral-500 uppercase mb-3">Test Credentials</p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  setEmail('client@test.com');
                  setPassword('password123');
                  setError('');
                }}
                className="w-full p-3 bg-neutral-50 rounded border border-neutral-200 hover:bg-neutral-100 hover:border-brand-primary/30 transition-colors text-left"
              >
                <p className="text-xs font-medium text-neutral-700 mb-1">👤 Client (DSA)</p>
                <p className="text-xs text-neutral-600">Email: <span className="font-mono text-brand-primary">client@test.com</span></p>
                <p className="text-xs text-neutral-600">Password: <span className="font-mono text-brand-primary">password123</span></p>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail('kam@test.com');
                  setPassword('password123');
                  setError('');
                }}
                className="w-full p-3 bg-neutral-50 rounded border border-neutral-200 hover:bg-neutral-100 hover:border-brand-primary/30 transition-colors text-left"
              >
                <p className="text-xs font-medium text-neutral-700 mb-1">👔 Key Account Manager (KAM)</p>
                <p className="text-xs text-neutral-600">Email: <span className="font-mono text-brand-primary">kam@test.com</span></p>
                <p className="text-xs text-neutral-600">Password: <span className="font-mono text-brand-primary">password123</span></p>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail('credit@test.com');
                  setPassword('password123');
                  setError('');
                }}
                className="w-full p-3 bg-neutral-50 rounded border border-neutral-200 hover:bg-neutral-100 hover:border-brand-primary/30 transition-colors text-left"
              >
                <p className="text-xs font-medium text-neutral-700 mb-1">💼 Credit Team</p>
                <p className="text-xs text-neutral-600">Email: <span className="font-mono text-brand-primary">credit@test.com</span></p>
                <p className="text-xs text-neutral-600">Password: <span className="font-mono text-brand-primary">password123</span></p>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail('nbfc@test.com');
                  setPassword('password123');
                  setError('');
                }}
                className="w-full p-3 bg-neutral-50 rounded border border-neutral-200 hover:bg-neutral-100 hover:border-brand-primary/30 transition-colors text-left"
              >
                <p className="text-xs font-medium text-neutral-700 mb-1">🏦 NBFC Partner</p>
                <p className="text-xs text-neutral-600">Email: <span className="font-mono text-brand-primary">nbfc@test.com</span></p>
                <p className="text-xs text-neutral-600">Password: <span className="font-mono text-brand-primary">password123</span></p>
              </button>
            </div>
            <p className="mt-3 text-xs text-neutral-500 text-center">
              Click any credential card to auto-fill the form
            </p>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-neutral-500">
          <p>© 2025 Seven Fincorp. All rights reserved.</p>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <Modal
        isOpen={showForgotPassword}
        onClose={() => {
          setShowForgotPassword(false);
          setResetEmail('');
          setResetSuccess(false);
          setError('');
        }}
        size="md"
      >
        <ModalHeader onClose={() => {
          setShowForgotPassword(false);
          setResetEmail('');
          setResetSuccess(false);
          setError('');
        }}>
          Reset Password
        </ModalHeader>
        <ModalBody>
          {resetSuccess ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8 text-success" />
              </div>
              <h3 className="text-lg font-semibold text-neutral-900 mb-2">Check Your Email</h3>
              <p className="text-sm text-neutral-600">
                We've sent a password reset link to <strong>{resetEmail}</strong>
              </p>
              <p className="text-sm text-neutral-500 mt-2">
                Please check your inbox and follow the instructions to reset your password.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-neutral-600">
                Enter your email address and we'll send you a link to reset your password.
              </p>
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-error">
                  {error}
                </div>
              )}
              <Input
                type="email"
                label="Email Address"
                placeholder="Enter your email"
                icon={Mail}
                iconPosition="left"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
              />
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          {resetSuccess ? (
            <Button
              variant="primary"
              onClick={() => {
                setShowForgotPassword(false);
                setResetEmail('');
                setResetSuccess(false);
              }}
            >
              Close
            </Button>
          ) : (
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowForgotPassword(false);
                  setResetEmail('');
                  setError('');
                }}
                disabled={resetLoading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleForgotPassword}
                loading={resetLoading}
                disabled={!resetEmail.trim()}
              >
                Send Reset Link
              </Button>
            </>
          )}
        </ModalFooter>
      </Modal>
    </div>
  );
};
