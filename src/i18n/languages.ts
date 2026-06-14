export type AppLanguageCode =
  | 'en'
  | 'hi'
  | 'bn'
  | 'te'
  | 'mr'
  | 'ta'
  | 'gu'
  | 'kn'
  | 'ml'
  | 'pa'
  | 'or'
  | 'as'
  | 'ur';

export interface SupportedLanguage {
  code: AppLanguageCode;
  label: string;
  dir: 'ltr' | 'rtl';
}

export const APP_LANGUAGE_STORAGE_KEY = 'appLanguage';

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: 'en', label: 'English', dir: 'ltr' },
  { code: 'hi', label: 'हिन्दी', dir: 'ltr' },
  { code: 'bn', label: 'বাংলা', dir: 'ltr' },
  { code: 'te', label: 'తెలుగు', dir: 'ltr' },
  { code: 'mr', label: 'मराठी', dir: 'ltr' },
  { code: 'ta', label: 'தமிழ்', dir: 'ltr' },
  { code: 'gu', label: 'ગુજરાતી', dir: 'ltr' },
  { code: 'kn', label: 'ಕನ್ನಡ', dir: 'ltr' },
  { code: 'ml', label: 'മലയാളം', dir: 'ltr' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ', dir: 'ltr' },
  { code: 'or', label: 'ଓଡ଼ିଆ', dir: 'ltr' },
  { code: 'as', label: 'অসমীয়া', dir: 'ltr' },
  { code: 'ur', label: 'اردو', dir: 'rtl' },
];

export const DEFAULT_LANGUAGE: AppLanguageCode = 'en';

export function isAppLanguageCode(value: string): value is AppLanguageCode {
  return SUPPORTED_LANGUAGES.some((lang) => lang.code === value);
}

export function getLanguageMeta(code: AppLanguageCode): SupportedLanguage {
  return SUPPORTED_LANGUAGES.find((lang) => lang.code === code) ?? SUPPORTED_LANGUAGES[0];
}
