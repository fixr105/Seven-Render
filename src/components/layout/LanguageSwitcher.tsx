import React from 'react';
import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '../../i18n/languages';

export const LanguageSwitcher: React.FC = () => {
  const { i18n, t } = useTranslation();
  const current = i18n.language?.split('-')[0] ?? 'en';

  return (
    <div className="relative flex items-center">
      <Globe className="w-4 h-4 text-neutral-600 absolute left-2 pointer-events-none z-10" aria-hidden />
      <select
        value={current}
        onChange={(e) => void i18n.changeLanguage(e.target.value)}
        className="appearance-none pl-8 pr-8 py-2 min-h-[44px] text-sm bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors touch-manipulation cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-primary max-w-[9rem] sm:max-w-[10rem]"
        aria-label={t('topbar.language')}
      >
        {SUPPORTED_LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.label}
          </option>
        ))}
      </select>
    </div>
  );
};
