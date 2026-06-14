import { AppLanguageCode, getLanguageMeta } from './languages';

export function applyDocumentLanguage(code: AppLanguageCode): void {
  const meta = getLanguageMeta(code);
  document.documentElement.lang = code;
  document.documentElement.dir = meta.dir;
}
