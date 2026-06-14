/**
 * Login Page
 * Ref-based submission to avoid autofill/state bugs. Reads DOM values at submit time.
 */

import React, { useRef, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mail, Lock } from 'lucide-react';
import { useAuth } from './AuthContext';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { LanguageSwitcher } from '../components/layout/LanguageSwitcher';
import loginBg from '../components/ui/login-bg.png';
import logo from '../components/ui/logo.png';
import './LoginPage.css';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, user } = useAuth();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const resetSuccess = searchParams.get('reset') === 'success';

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
      setError(t('auth.emailRequired'));
      emailRef.current?.focus();
      return;
    }
    if (email.length > 254) {
      setError(t('auth.invalidEmail'));
      return;
    }
    if (!EMAIL_REGEX.test(email)) {
      setError(t('auth.validEmailRequired'));
      return;
    }
    if (!password) {
      setError(t('auth.passwordRequired'));
      passwordRef.current?.focus();
      return;
    }
    if (password.length > 128) {
      setError(t('auth.invalidPassword'));
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
      <div className="login-card relative">
        <div className="absolute top-4 right-4 z-10">
          <LanguageSwitcher />
        </div>
        <img src={logo} alt={t('common.logoAlt')} className="login-logo" />
        <p className="login-tagline">{t('common.tagline')}</p>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          {resetSuccess && (
            <div className="login-success mb-3 p-2 rounded bg-green-50 text-green-800 text-sm">
              {t('auth.resetSuccess')}
            </div>
          )}
          {error && <div className="login-error">{error}</div>}

          <div className="form-group">
            <Input
              ref={emailRef}
              type="email"
              label={t('auth.email')}
              placeholder={t('auth.emailPlaceholder')}
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
              label={t('auth.password')}
              placeholder={t('auth.passwordPlaceholder')}
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
            {t('auth.login')}
          </Button>

          <p className="login-forgot-hint text-sm text-neutral-500 mt-4">
            <Link to="/forgot-password" className="text-brand-primary hover:underline">
              {t('auth.forgotPassword')}
            </Link>{' '}
            {t('auth.contactAdminReset')}
          </p>
        </form>
      </div>
    </div>
  );
};
