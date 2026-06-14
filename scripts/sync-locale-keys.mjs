#!/usr/bin/env node
/**
 * Adds missing keys from en/translation.json to all locale maps (English fallback).
 * Run before generate-locales.mjs when adding new translation keys.
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

const enFlat = flatten(JSON.parse(fs.readFileSync(EN_PATH, 'utf8')));

for (const lang of LANGS) {
  const mapPath = path.join(MAPS_DIR, `${lang}.json`);
  const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  let added = 0;
  for (const [key, value] of Object.entries(enFlat)) {
    if (typeof map[key] !== 'string') {
      map[key] = value;
      added++;
    }
  }
  const sorted = Object.fromEntries(Object.keys(map).sort().map((k) => [k, map[k]]));
  fs.writeFileSync(mapPath, JSON.stringify(sorted, null, 2) + '\n');
  console.log(`${lang}: added ${added} keys (${Object.keys(sorted).length} total)`);
}

console.log('Done syncing locale maps.');
