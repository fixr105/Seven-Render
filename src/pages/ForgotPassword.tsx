/**
 * Forgot Password – request password reset email (self-service).
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mail } from 'lucide-react';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { apiService } from '../services/api';
import { AuthScreen, authSubmitClassName } from '../auth/AuthScreen';
import logo from '../components/ui/logo.png';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const logoClass = 'mx-auto mb-2 block h-auto max-h-14 w-auto max-w-[180px] object-contain';

export const ForgotPassword: React.FC = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setError(t('auth.emailRequired'));
      return;
    }
    if (!EMAIL_REGEX.test(trimmed)) {
      setError(t('auth.validEmailRequired'));
      return;
    }
    setLoading(true);
    const result = await apiService.forgotPassword(trimmed);
    setLoading(false);
    if (result.success) {
      setSuccess(true);
    } else {
      setError(result.error || t('auth.somethingWrong'));
    }
  };

  if (success) {
    return (
      <AuthScreen>
        <img src={logo} alt={t('common.logoAlt')} className={logoClass} />
        <h1 className="mb-2 text-center text-base font-semibold leading-6 text-dealer-navy">{t('auth.checkEmail')}</h1>
        <p className="mb-6 text-center text-sm leading-5 text-dealer-text-quiet">{t('auth.resetEmailSent')}</p>
        <Link to="/login" className="text-sm text-dealer-navy hover:underline">
          {t('auth.backToLogin')}
        </Link>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen>
      <img src={logo} alt={t('common.logoAlt')} className={logoClass} />
      <h1 className="mb-2 text-center text-base font-semibold leading-6 text-dealer-navy">{t('auth.forgotTitle')}</h1>
      <p className="mb-4 text-center text-sm leading-5 text-dealer-text-quiet">{t('auth.forgotDescription')}</p>

      <form className="dealer-login-form" onSubmit={handleSubmit} noValidate>
        {error && (
          <div className="mb-4 rounded-lg bg-dealer-error/10 px-4 py-3 text-sm font-medium text-dealer-error">
            {error}
          </div>
        )}
        <div className="dealer-login-field mb-6">
          <Input
            type="email"
            label={t('auth.email')}
            placeholder={t('auth.emailPlaceholder')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            icon={Mail}
            iconPosition="left"
            required
            disabled={loading}
            tone="dealer"
          />
        </div>
        <Button type="submit" variant="primary" size="lg" className={authSubmitClassName} loading={loading} disabled={loading}>
          {t('auth.sendResetLink')}
        </Button>
      </form>

      <p className="mt-4 text-left text-[13px] leading-[18px] text-dealer-text-quiet">
        <Link to="/login" className="text-dealer-navy hover:underline">
          {t('auth.backToLogin')}
        </Link>
      </p>
    </AuthScreen>
  );
};
