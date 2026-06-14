#!/usr/bin/env node
/**
 * Generates src/locales/{lang}/translation.json from English master + flat locale maps.
 * Run: node scripts/generate-locales.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const EN_PATH = path.join(ROOT, 'src/locales/en/translation.json');
const MAPS_DIR = path.join(__dirname, 'locale-maps');

const LANGS = ['hi', 'bn', 'te', 'mr', 'ta', 'gu', 'kn', 'ml', 'pa', 'or', 'as', 'ur'];

function flatten(obj, prefix = '', result = {}) {
  for (const [key, value] of Object.entries(obj)) {
    const pathKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      result[pathKey] = value;
    } else {
      flatten(value, pathKey, result);
    }
  }
  return result;
}

function unflatten(flat) {
  const result = {};
  for (const [pathKey, value] of Object.entries(flat)) {
    const parts = pathKey.split('.');
    let current = result;
    for (let i = 0; i < parts.length - 1; i++) {
      current[parts[i]] = current[parts[i]] ?? {};
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;
  }
  return result;
}

const en = JSON.parse(fs.readFileSync(EN_PATH, 'utf8'));
const enFlat = flatten(en);
const enKeys = Object.keys(enFlat);

for (const lang of LANGS) {
  const mapPath = path.join(MAPS_DIR, `${lang}.json`);
  if (!fs.existsSync(mapPath)) {
    console.error(`Missing locale map: ${mapPath}`);
    process.exit(1);
  }
  const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  const outFlat = {};
  const missing = [];
  for (const key of enKeys) {
    if (typeof map[key] === 'string') {
      outFlat[key] = map[key];
    } else {
      missing.push(key);
      outFlat[key] = enFlat[key];
    }
  }
  if (missing.length > 0) {
    console.error(`${lang}: missing ${missing.length} keys (using English fallback):`, missing.slice(0, 5).join(', '));
    process.exit(1);
  }
  const outDir = path.join(ROOT, 'src/locales', lang);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'translation.json'),
    JSON.stringify(unflatten(outFlat), null, 2) + '\n'
  );
  console.log(`Wrote ${lang} (${enKeys.length} keys)`);
}

console.log('Done.');
