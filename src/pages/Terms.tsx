import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export const TermsPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-neutral-100">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold text-neutral-900 mb-6">{t('pages.terms.title')}</h1>
        <div className="prose prose-neutral text-neutral-600 space-y-4">
          <p>{t('pages.terms.intro')}</p>
          <p>
            {t('pages.terms.contact')}{' '}
            <a href="mailto:contact@sevenfincorp.com" className="text-brand-primary hover:underline">
              contact@sevenfincorp.com
            </a>
            .
          </p>
        </div>
        <Link
          to="/"
          className="inline-block mt-8 text-brand-primary hover:underline"
        >
          {t('pages.terms.backToHome')}
        </Link>
      </div>
    </div>
  );
};
