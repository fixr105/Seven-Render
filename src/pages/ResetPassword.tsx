/**
 * Reset Password – set new password using token from email link.
 */

import React, { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { apiService } from '../services/api';
import loginBg from '../components/ui/login-bg.png';
import logo from '../components/ui/logo.png';
import '../auth/LoginPage.css';

const MIN_PASSWORD_LENGTH = 6;

export const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!token) {
      setError('Invalid reset link. Request a new one from the forgot password page.');
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    const result = await apiService.resetPassword(token, newPassword);
    setLoading(false);
    if (result.success) {
      setSuccess(true);
      setTimeout(() => navigate('/login?reset=success', { replace: true }), 2000);
    } else {
      setError(result.error || 'Failed to update password. Please try again.');
    }
  };

  if (!token && !success) {
    return (
      <div className="login-page" style={{ ['--login-bg' as string]: `url(${loginBg})` }}>
        <div className="login-card">
          <img src={logo} alt="SEVEN FINCORP" className="login-logo" />
          <h1 className="text-xl font-semibold text-white mb-2">Invalid reset link</h1>
          <p className="text-neutral-200 mb-6">
            This link is missing or invalid. Request a new password reset link.
          </p>
          <Link to="/forgot-password" className="text-blue-200 hover:text-white hover:underline">
            Forgot password
          </Link>
          <p className="mt-4">
            <Link to="/login" className="text-neutral-300 hover:text-white hover:underline text-sm">Back to login</Link>
          </p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="login-page" style={{ ['--login-bg' as string]: `url(${loginBg})` }}>
        <div className="login-card">
          <img src={logo} alt="SEVEN FINCORP" className="login-logo" />
          <h1 className="text-xl font-semibold text-white mb-2">Password updated</h1>
          <p className="text-neutral-200 mb-6">Redirecting you to login...</p>
          <Link to="/login" className="text-blue-200 hover:text-white hover:underline">
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page" style={{ ['--login-bg' as string]: `url(${loginBg})` }}>
      <div className="login-card">
        <img src={logo} alt="SEVEN FINCORP" className="login-logo" />
        <h1 className="text-xl font-semibold text-white mb-2">Set new password</h1>
        <p className="text-neutral-200 mb-4">Enter your new password below.</p>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          {error && <div className="login-error">{error}</div>}
          <div className="form-group">
            <Input
              type="password"
              label="New password"
              placeholder="Min 6 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              icon={Lock}
              iconPosition="left"
              required
              disabled={loading}
              minLength={MIN_PASSWORD_LENGTH}
            />
          </div>
          <div className="form-group">
            <Input
              type="password"
              label="Confirm password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              icon={Lock}
              iconPosition="left"
              required
              disabled={loading}
              minLength={MIN_PASSWORD_LENGTH}
            />
          </div>
          <Button type="submit" variant="primary" className="w-full login-btn" loading={loading} disabled={loading}>
            Update password
          </Button>
        </form>

        <p className="login-forgot-hint text-sm text-neutral-300 mt-4">
          <Link to="/login" className="text-blue-200 hover:text-white hover:underline">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
};
