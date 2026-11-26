/**
 * Fail if the old n8n host appears in runtime code, config, or env examples.
 * Usage: node scripts/check-n8n.js
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const HOST = 'fixrrahul';
const SKIP_DIRS = new Set(['node_modules', 'dist', 'coverage', '.git', '.next', 'build', 'n8n-export']);
const SKIP_FILES = new Set([
  'check-n8n.js',
  'SEVEN-DASHBOARD(2).json',
  'get-webhook-test-results.json',
  'n8n-useraccount-webhook-UPDATED.json',
  'n8n-useraccount-webhook-FIXED.json',
]);
const CODE_EXT = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.sh', '.yml', '.yaml', '.toml', '.json',
]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

const violations = [];

for (const path of walk(ROOT)) {
  const rel = relative(ROOT, path);
  if (rel.endsWith('.md') || SKIP_FILES.has(rel.split('/').pop() ?? rel)) continue;
  const ext = path.slice(path.lastIndexOf('.'));
  if (!CODE_EXT.has(ext) && !rel.startsWith('.env')) continue;
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    continue;
  }
  if (!text.includes(HOST)) continue;
  const lines = text.split('\n');
  lines.forEach((line, index) => {
    if (!line.includes(HOST)) return;
    violations.push(`${rel}:${index + 1}: ${line.trim().slice(0, 180)}`);
  });
}

if (violations.length) {
  console.error('Old n8n host is still hardcoded:\n' + violations.join('\n'));
  process.exit(1);
}

console.log('check-n8n: old n8n host is not in runtime code.');
