import React from 'react';
import { ChevronDown, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '../../i18n/languages';

type LanguageSwitcherVariant = 'default' | 'onDark';

interface LanguageSwitcherProps {
  variant?: LanguageSwitcherVariant;
  className?: string;
  id?: string;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  variant = 'default',
  className = '',
  id,
}) => {
  const { i18n, t } = useTranslation();
  const current = i18n.language?.split('-')[0] ?? 'en';
  const isOnDark = variant === 'onDark';

  return (
    <div className={`relative flex items-center ${className}`.trim()}>
      <Globe
        className={`w-4 h-4 absolute left-3 pointer-events-none z-10 ${
          isOnDark ? 'text-sky-200/90' : 'text-neutral-600'
        }`}
        aria-hidden
      />
      <select
        id={id}
        value={current}
        onChange={(e) => void i18n.changeLanguage(e.target.value)}
        className={
          isOnDark
            ? 'appearance-none w-full pl-9 pr-9 py-2.5 min-h-[44px] text-sm rounded-lg border touch-manipulation cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-300/40 bg-[rgba(10,30,70,0.6)] border-[rgba(100,180,255,0.5)] text-white hover:border-[rgba(100,180,255,0.75)] transition-colors'
            : 'appearance-none pl-8 pr-9 py-2 min-h-[44px] text-sm bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors touch-manipulation cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-primary max-w-[9rem] sm:max-w-[10rem]'
        }
        aria-label={t('topbar.language')}
        data-testid="language-switcher"
      >
        {SUPPORTED_LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className={`w-4 h-4 absolute right-3 pointer-events-none ${
          isOnDark ? 'text-sky-200/90' : 'text-neutral-500'
        }`}
        aria-hidden
      />
    </div>
  );
};
