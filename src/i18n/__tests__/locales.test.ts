import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../../..');
const EN_PATH = path.join(ROOT, 'src/locales/en/translation.json');
const LANGS = ['hi', 'bn', 'te', 'mr', 'ta', 'gu', 'kn', 'ml', 'pa', 'or', 'as', 'ur'];

function flatten(obj: Record<string, unknown>, prefix = '', result: Record<string, string> = {}): Record<string, string> {
  for (const [key, value] of Object.entries(obj)) {
    const pathKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      result[pathKey] = value;
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value as Record<string, unknown>, pathKey, result);
    }
  }
  return result;
}

describe('locale parity', () => {
  const enFlat = flatten(JSON.parse(fs.readFileSync(EN_PATH, 'utf8')) as Record<string, unknown>);
  const enKeys = Object.keys(enFlat).sort();

  it('English master has translation keys', () => {
    expect(enKeys.length).toBeGreaterThan(100);
  });

  for (const lang of LANGS) {
    it(`${lang} has identical key set as English`, () => {
      const langPath = path.join(ROOT, 'src/locales', lang, 'translation.json');
      const langFlat = flatten(JSON.parse(fs.readFileSync(langPath, 'utf8')) as Record<string, unknown>);
      const langKeys = Object.keys(langFlat).sort();
      expect(langKeys).toEqual(enKeys);
    });
  }
});
