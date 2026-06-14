import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';

export const NotFoundPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-100">
      <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-level-2 text-center">
        <h1 className="text-6xl font-bold text-neutral-400 mb-2">{t('pages.notFound.code')}</h1>
        <h2 className="text-xl font-semibold text-neutral-900 mb-2">{t('pages.notFound.title')}</h2>
        <p className="text-neutral-600 mb-6">{t('pages.notFound.description')}</p>
        <Link
          to={user ? '/dashboard' : '/login'}
          className="inline-block px-4 py-2 bg-brand-primary text-white rounded hover:opacity-90 transition-opacity"
        >
          {user ? t('pages.notFound.goToDashboard') : t('pages.notFound.goToLogin')}
        </Link>
      </div>
    </div>
  );
};
