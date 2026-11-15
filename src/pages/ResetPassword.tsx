/**
 * Reset Password – set new password using token from email link.
 */

import React, { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { apiService } from '../services/api';
import { AuthScreen, authSubmitClassName } from '../auth/AuthScreen';
import logo from '../components/ui/logo.png';

const MIN_PASSWORD_LENGTH = 6;
const logoClass = 'mx-auto mb-2 block h-auto max-h-14 w-auto max-w-[180px] object-contain';

export const ResetPassword: React.FC = () => {
  const { t } = useTranslation();
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
      setError(t('auth.invalidResetToken'));
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(t('auth.passwordMinLength', { min: MIN_PASSWORD_LENGTH }));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }
    setLoading(true);
    const result = await apiService.resetPassword(token, newPassword);
    setLoading(false);
    if (result.success) {
      setSuccess(true);
      setTimeout(() => navigate('/login?reset=success', { replace: true }), 2000);
    } else {
      setError(result.error || t('auth.updatePasswordFailed'));
    }
  };

  if (!token && !success) {
    return (
      <AuthScreen>
        <img src={logo} alt={t('common.logoAlt')} className={logoClass} />
        <h1 className="mb-2 text-center text-base font-semibold leading-6 text-dealer-navy">{t('auth.invalidResetLink')}</h1>
        <p className="mb-6 text-center text-sm leading-5 text-dealer-text-quiet">{t('auth.invalidResetDescription')}</p>
        <Link to="/forgot-password" className="text-sm text-dealer-navy hover:underline">
          {t('auth.forgotTitle')}
        </Link>
        <p className="mt-4">
          <Link to="/login" className="text-sm text-dealer-navy hover:underline">
            {t('auth.backToLogin')}
          </Link>
        </p>
      </AuthScreen>
    );
  }

  if (success) {
    return (
      <AuthScreen>
        <img src={logo} alt={t('common.logoAlt')} className={logoClass} />
        <h1 className="mb-2 text-center text-base font-semibold leading-6 text-dealer-navy">{t('auth.passwordUpdated')}</h1>
        <p className="mb-6 text-center text-sm leading-5 text-dealer-text-quiet">{t('auth.redirectingToLogin')}</p>
        <Link to="/login" className="text-sm text-dealer-navy hover:underline">
          {t('auth.goToLogin')}
        </Link>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen>
      <img src={logo} alt={t('common.logoAlt')} className={logoClass} />
      <h1 className="mb-2 text-center text-base font-semibold leading-6 text-dealer-navy">{t('auth.setNewPassword')}</h1>
      <p className="mb-4 text-center text-sm leading-5 text-dealer-text-quiet">{t('auth.setNewPasswordDescription')}</p>

      <form className="dealer-login-form" onSubmit={handleSubmit} noValidate>
        {error && (
          <div className="mb-4 rounded-lg bg-dealer-error/10 px-4 py-3 text-sm font-medium text-dealer-error">
            {error}
          </div>
        )}
        <div className="dealer-login-field mb-5">
          <Input
            type="password"
            label={t('auth.newPassword')}
            placeholder={t('auth.newPasswordPlaceholder')}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            icon={Lock}
            iconPosition="left"
            required
            disabled={loading}
            minLength={MIN_PASSWORD_LENGTH}
            tone="dealer"
          />
        </div>
        <div className="dealer-login-field mb-6">
          <Input
            type="password"
            label={t('auth.confirmPassword')}
            placeholder={t('auth.confirmPasswordPlaceholder')}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            icon={Lock}
            iconPosition="left"
            required
            disabled={loading}
            minLength={MIN_PASSWORD_LENGTH}
            tone="dealer"
          />
        </div>
        <Button type="submit" variant="primary" size="lg" className={authSubmitClassName} loading={loading} disabled={loading}>
          {t('auth.updatePassword')}
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
