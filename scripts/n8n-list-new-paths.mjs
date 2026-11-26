import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const index = JSON.parse(await readFile(path.join(root, 'scripts/n8n-export/webhook-index.json'), 'utf8'));
const active = index.new.filter((row) => row.active);
const map = new Map();
for (const row of active) {
  const key = `${row.method} ${row.path}`;
  const list = map.get(key) || [];
  list.push(`${row.id} ${row.name}`);
  map.set(key, list);
}
const lines = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
for (const [key, owners] of lines) {
  console.log(`${key} <= ${owners.join(' | ')}`);
}
