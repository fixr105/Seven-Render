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
import loginBg from '../components/ui/login-bg.png';
import logo from '../components/ui/logo.png';
import '../auth/LoginPage.css';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
      <div className="login-page" style={{ ['--login-bg' as string]: `url(${loginBg})` }}>
        <div className="login-card">
          <img src={logo} alt={t('common.logoAlt')} className="login-logo" />
          <h1 className="text-xl font-semibold text-white mb-2">{t('auth.checkEmail')}</h1>
          <p className="text-neutral-200 mb-6">{t('auth.resetEmailSent')}</p>
          <Link to="/login" className="text-blue-200 hover:text-white hover:underline">
            {t('auth.backToLogin')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page" style={{ ['--login-bg' as string]: `url(${loginBg})` }}>
      <div className="login-card">
        <img src={logo} alt={t('common.logoAlt')} className="login-logo" />
        <h1 className="text-xl font-semibold text-white mb-2">{t('auth.forgotTitle')}</h1>
        <p className="text-neutral-200 mb-4">{t('auth.forgotDescription')}</p>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          {error && <div className="login-error">{error}</div>}
          <div className="form-group">
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
            />
          </div>
          <Button type="submit" variant="primary" className="w-full login-btn" loading={loading} disabled={loading}>
            {t('auth.sendResetLink')}
          </Button>
        </form>

        <p className="login-forgot-hint text-sm text-neutral-300 mt-4">
          <Link to="/login" className="text-blue-200 hover:text-white hover:underline">
            {t('auth.backToLogin')}
          </Link>
        </p>
      </div>
    </div>
  );
};
