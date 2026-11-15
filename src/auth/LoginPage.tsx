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
import logo from '../components/ui/logo.png';
import { AuthScreen, authSubmitClassName } from './AuthScreen';

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
    <AuthScreen testId="login-page">
          <img src={logo} alt={t('common.logoAlt')} className="mx-auto mb-2 block h-auto max-h-14 w-auto max-w-[180px] object-contain" />
          <p className="mb-5 text-center text-sm font-normal leading-5 text-dealer-text-quiet">
            {t('common.tagline')}
          </p>

          <div className="dealer-login-language mb-6">
            <label htmlFor="login-language-select" className="mb-2 block text-[13px] font-medium leading-[18px] text-dealer-text">
              {t('topbar.language')}
            </label>
            <LanguageSwitcher
              id="login-language-select"
              className="dealer-login-language"
            />
          </div>

          <form className="dealer-login-form" onSubmit={handleSubmit} noValidate>
            {resetSuccess && (
              <div className="mb-3 rounded-[8px] bg-dealer-success/10 p-2 text-sm text-dealer-success">
                {t('auth.resetSuccess')}
              </div>
            )}
            {error && (
              <div className="mb-4 rounded-lg bg-dealer-error/10 px-4 py-3 text-sm font-medium text-dealer-error">
                {error}
              </div>
            )}

            <div className="dealer-login-field mb-5">
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
                tone="dealer"
                data-testid="login-username"
              />
            </div>

            <div className="dealer-login-field mb-6">
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
                tone="dealer"
                data-testid="login-password"
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              disabled={loading}
              className={authSubmitClassName}
            >
              {t('auth.login')}
            </Button>

            <p className="mt-4 text-left text-[13px] leading-[18px] text-dealer-text-quiet">
              <Link to="/forgot-password" className="text-dealer-navy hover:underline">
                {t('auth.forgotPassword')}
              </Link>{' '}
              {t('auth.contactAdminReset')}
            </p>
          </form>
    </AuthScreen>
  );
};
