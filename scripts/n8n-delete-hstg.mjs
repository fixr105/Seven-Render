/**
 * Back up and delete inactive [HSTG] workflows. Never prints API keys.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envText = await readFile(path.join(root, 'scripts', '.n8n-migrate.env'), 'utf8');
const env = Object.fromEntries(
  envText.split('\n').filter((line) => line.includes('=')).map((line) => {
    const i = line.indexOf('=');
    return [line.slice(0, i), line.slice(i + 1)];
  }),
);
const base = env.NEW_N8N_URL.replace(/\/+$/, '');
const headers = { 'X-N8N-API-KEY': env.NEW_N8N_API_KEY, Accept: 'application/json' };

async function api(method, apiPath, body) {
  const response = await fetch(`${base}${apiPath}`, {
    method,
    headers: body ? { ...headers, 'Content-Type': 'application/json' } : headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let parsed = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = { message: text.slice(0, 300) }; }
  return { status: response.status, body: parsed };
}

const listed = await api('GET', '/api/v1/workflows?limit=250');
if (listed.status >= 400) {
  console.log(`LIST status=${listed.status}`);
  process.exit(1);
}
const rows = listed.body?.data || [];
const hstg = rows.filter((row) => String(row.name || '').startsWith('[HSTG]'));
console.log(`found ${hstg.length} [HSTG] workflows`);
const backupDir = path.join(root, 'scripts', 'n8n-export', 'hstg-backup');
await mkdir(backupDir, { recursive: true });
const deleted = [];
for (const row of hstg) {
  const full = await api('GET', `/api/v1/workflows/${row.id}`);
  if (full.status >= 400) {
    console.log(`BACKUP FAIL ${row.id} status=${full.status}`);
    continue;
  }
  const workflow = full.body?.data || full.body;
  await writeFile(path.join(backupDir, `${row.id}.json`), JSON.stringify(workflow, null, 2));
  const removed = await api('DELETE', `/api/v1/workflows/${row.id}`);
  console.log(`DELETE ${row.id} ${row.name} status=${removed.status} active=${row.active}`);
  if (removed.status < 300) deleted.push({ id: row.id, name: row.name });
}
await writeFile(path.join(backupDir, 'deleted.json'), JSON.stringify(deleted, null, 2));
console.log(`deleted ${deleted.length}`);
