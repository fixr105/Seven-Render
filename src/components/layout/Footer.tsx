import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface FooterProps {
  className?: string;
}

export const Footer: React.FC<FooterProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  return (
    <footer className={`bg-white border-t border-neutral-200 py-4 pb-safe ${className}`}>
      <div className="max-w-7xl mx-auto px-4 lg:px-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-neutral-500">
            {t('footer.copyright', { year: currentYear })}
          </div>
          <div className="flex items-center gap-6 text-sm text-neutral-500">
            <a
              href="mailto:contact@sevenfincorp.com"
              className="inline-flex items-center py-2 min-h-[44px] touch-manipulation hover:text-brand-primary transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 rounded"
            >
              {t('footer.support')}
            </a>
            <Link
              to="/privacy"
              className="inline-flex items-center py-2 min-h-[44px] touch-manipulation hover:text-brand-primary transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 rounded"
            >
              {t('footer.privacy')}
            </Link>
            <Link
              to="/terms"
              className="inline-flex items-center py-2 min-h-[44px] touch-manipulation hover:text-brand-primary transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 rounded"
            >
              {t('footer.terms')}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
