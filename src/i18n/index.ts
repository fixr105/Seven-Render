import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import {
  APP_LANGUAGE_STORAGE_KEY,
  DEFAULT_LANGUAGE,
  isAppLanguageCode,
} from './languages';
import { applyDocumentLanguage } from './applyDocumentLanguage';

import en from '../locales/en/translation.json';
import hi from '../locales/hi/translation.json';
import bn from '../locales/bn/translation.json';
import te from '../locales/te/translation.json';
import mr from '../locales/mr/translation.json';
import ta from '../locales/ta/translation.json';
import gu from '../locales/gu/translation.json';
import kn from '../locales/kn/translation.json';
import ml from '../locales/ml/translation.json';
import pa from '../locales/pa/translation.json';
import orLang from '../locales/or/translation.json';
import asLang from '../locales/as/translation.json';
import ur from '../locales/ur/translation.json';

function getInitialLanguage(): string {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;
  const stored = localStorage.getItem(APP_LANGUAGE_STORAGE_KEY);
  if (stored && isAppLanguageCode(stored)) return stored;
  return DEFAULT_LANGUAGE;
}

const initialLanguage = getInitialLanguage();

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    hi: { translation: hi },
    bn: { translation: bn },
    te: { translation: te },
    mr: { translation: mr },
    ta: { translation: ta },
    gu: { translation: gu },
    kn: { translation: kn },
    ml: { translation: ml },
    pa: { translation: pa },
    or: { translation: orLang },
    as: { translation: asLang },
    ur: { translation: ur },
  },
  lng: initialLanguage,
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: { escapeValue: false },
});

applyDocumentLanguage(isAppLanguageCode(initialLanguage) ? initialLanguage : DEFAULT_LANGUAGE);

i18n.on('languageChanged', (lng) => {
  if (isAppLanguageCode(lng)) {
    localStorage.setItem(APP_LANGUAGE_STORAGE_KEY, lng);
    applyDocumentLanguage(lng);
  }
});

export default i18n;
