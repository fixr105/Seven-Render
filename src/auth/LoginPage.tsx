/**
 * Login Page
 * Ref-based submission to avoid autofill/state bugs. Reads DOM values at submit time.
 */

import React, { useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock } from 'lucide-react';
import { useAuth } from './AuthContext';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import loginBg from '../components/ui/login-bg.png';
import logo from '../components/ui/logo.png';
import './LoginPage.css';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, user } = useAuth();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in
  React.useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const email = (emailRef.current?.value ?? '').trim();
    const password = passwordRef.current?.value ?? '';

    if (!email) {
      setError('Email is required');
      emailRef.current?.focus();
      return;
    }
    if (email.length > 254) {
      setError('Invalid email');
      return;
    }
    if (!EMAIL_REGEX.test(email)) {
      setError('Please enter a valid email address');
      return;
    }
    if (!password) {
      setError('Password is required');
      passwordRef.current?.focus();
      return;
    }
    if (password.length > 128) {
      setError('Invalid password');
      return;
    }

    setLoading(true);
    const result = await login(email, password);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    navigate('/dashboard', { replace: true });
  };

  return (
    <div
      className="login-page"
      style={{ ['--login-bg' as string]: `url(${loginBg})` }}
    >
      <div className="login-card">
        <img src={logo} alt="SEVEN FINCORP" className="login-logo" />
        <p className="login-tagline">AI-FIRST TECH-FIRST PLATFORM</p>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          {error && <div className="login-error">{error}</div>}

          <div className="form-group">
            <Input
              ref={emailRef}
              type="email"
              label="Email"
              placeholder="Enter your email"
              autoComplete="email"
              icon={Mail}
              iconPosition="left"
              required
              disabled={loading}
              data-testid="login-username"
            />
          </div>

          <div className="form-group">
            <Input
              ref={passwordRef}
              type="password"
              label="Password"
              placeholder="Enter your password"
              autoComplete="current-password"
              icon={Lock}
              iconPosition="left"
              required
              disabled={loading}
              data-testid="login-password"
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={loading}
            disabled={loading}
            className="login-btn"
          >
            Login
          </Button>

          <Link to="/forgot-password" className="login-forgot">
            Forgot password?
          </Link>
        </form>
      </div>
    </div>
  );
};
