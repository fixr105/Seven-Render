/**
 * Forgot Password – request password reset email (self-service).
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { apiService } from '../services/api';
import loginBg from '../components/ui/login-bg.png';
import logo from '../components/ui/logo.png';
import '../auth/LoginPage.css';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Email is required');
      return;
    }
    if (!EMAIL_REGEX.test(trimmed)) {
      setError('Please enter a valid email address');
      return;
    }
    setLoading(true);
    const result = await apiService.forgotPassword(trimmed);
    setLoading(false);
    if (result.success) {
      setSuccess(true);
    } else {
      setError(result.error || 'Something went wrong. Please try again.');
    }
  };

  if (success) {
    return (
      <div className="login-page" style={{ ['--login-bg' as string]: `url(${loginBg})` }}>
        <div className="login-card">
          <img src={logo} alt="SEVEN FINCORP" className="login-logo" />
          <h1 className="text-xl font-semibold text-neutral-900 mb-2">Check your email</h1>
          <p className="text-neutral-600 mb-6">
            If an account exists for that email, we've sent a reset link. It may take a few minutes to arrive.
          </p>
          <Link to="/login" className="text-brand-primary hover:underline">
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page" style={{ ['--login-bg' as string]: `url(${loginBg})` }}>
      <div className="login-card">
        <img src={logo} alt="SEVEN FINCORP" className="login-logo" />
        <h1 className="text-xl font-semibold text-neutral-900 mb-2">Forgot password?</h1>
        <p className="text-neutral-600 mb-4">Enter your email and we'll send you a link to reset your password.</p>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          {error && <div className="login-error">{error}</div>}
          <div className="form-group">
            <Input
              type="email"
              label="Email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              icon={Mail}
              iconPosition="left"
              required
              disabled={loading}
            />
          </div>
          <Button type="submit" variant="primary" className="w-full login-btn" loading={loading} disabled={loading}>
            Send reset link
          </Button>
        </form>

        <p className="login-forgot-hint text-sm text-neutral-500 mt-4">
          <Link to="/login" className="text-brand-primary hover:underline">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
};
