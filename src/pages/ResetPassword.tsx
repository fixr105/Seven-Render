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
import loginBg from '../components/ui/login-bg.png';
import logo from '../components/ui/logo.png';
import '../auth/LoginPage.css';

const MIN_PASSWORD_LENGTH = 6;

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
      <div className="login-page" style={{ ['--login-bg' as string]: `url(${loginBg})` }}>
        <div className="login-card">
          <img src={logo} alt={t('common.logoAlt')} className="login-logo" />
          <h1 className="text-xl font-semibold text-white mb-2">{t('auth.invalidResetLink')}</h1>
          <p className="text-neutral-200 mb-6">{t('auth.invalidResetDescription')}</p>
          <Link to="/forgot-password" className="text-blue-200 hover:text-white hover:underline">
            {t('auth.forgotTitle')}
          </Link>
          <p className="mt-4">
            <Link to="/login" className="text-neutral-300 hover:text-white hover:underline text-sm">
              {t('auth.backToLogin')}
            </Link>
          </p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="login-page" style={{ ['--login-bg' as string]: `url(${loginBg})` }}>
        <div className="login-card">
          <img src={logo} alt={t('common.logoAlt')} className="login-logo" />
          <h1 className="text-xl font-semibold text-white mb-2">{t('auth.passwordUpdated')}</h1>
          <p className="text-neutral-200 mb-6">{t('auth.redirectingToLogin')}</p>
          <Link to="/login" className="text-blue-200 hover:text-white hover:underline">
            {t('auth.goToLogin')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page" style={{ ['--login-bg' as string]: `url(${loginBg})` }}>
      <div className="login-card">
        <img src={logo} alt={t('common.logoAlt')} className="login-logo" />
        <h1 className="text-xl font-semibold text-white mb-2">{t('auth.setNewPassword')}</h1>
        <p className="text-neutral-200 mb-4">{t('auth.setNewPasswordDescription')}</p>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          {error && <div className="login-error">{error}</div>}
          <div className="form-group">
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
            />
          </div>
          <div className="form-group">
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
            />
          </div>
          <Button type="submit" variant="primary" className="w-full login-btn" loading={loading} disabled={loading}>
            {t('auth.updatePassword')}
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
