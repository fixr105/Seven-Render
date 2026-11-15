import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';

export const NotFoundPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-sf-soft px-4">
      <div className="w-full max-w-md rounded-[12px] border border-sf-border bg-sf-surface p-8 text-center shadow-sf-shadow-md">
        <h1 className="font-michroma text-[22px] font-normal leading-7 text-sf-navy">{t('pages.notFound.title')}</h1>
        <p className="mt-2 text-sm leading-5 text-sf-quiet">{t('pages.notFound.description')}</p>
        <p className="mt-4 text-sm text-sf-quiet">{t('pages.notFound.code')}</p>
        <Link
          to={user ? '/dashboard' : '/login'}
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-sf-navy px-4 text-sm text-white"
        >
          {user ? t('pages.notFound.goToDashboard') : t('pages.notFound.goToLogin')}
        </Link>
      </div>
    </div>
  );
};
