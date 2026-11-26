/**
 * Export every workflow from the old and Hostinger n8n instances.
 * Reads scripts/.n8n-migrate.env. Never prints API keys.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, 'scripts', '.n8n-migrate.env');
const envText = await import('node:fs').then((fs) => fs.readFileSync(envPath, 'utf8'));
const env = Object.fromEntries(
  envText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i), line.slice(i + 1)];
    }),
);

function slug(name) {
  return String(name || 'workflow')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'workflow';
}

async function api(base, key, apiPath) {
  const url = `${base.replace(/\/+$/, '')}${apiPath}`;
  const response = await fetch(url, {
    headers: { 'X-N8N-API-KEY': key, Accept: 'application/json' },
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text.slice(0, 400) };
  }
  return { status: response.status, body };
}

async function listAll(base, key) {
  const rows = [];
  let cursor = '';
  for (let page = 0; page < 40; page += 1) {
    const query = cursor
      ? `/api/v1/workflows?limit=250&cursor=${encodeURIComponent(cursor)}`
      : '/api/v1/workflows?limit=250';
    const result = await api(base, key, query);
    if (result.status === 401 || result.status === 403) {
      return { blocked: true, status: result.status, message: JSON.stringify(result.body).slice(0, 300) };
    }
    if (result.status >= 400) {
      return { blocked: true, status: result.status, message: JSON.stringify(result.body).slice(0, 500) };
    }
    const data = Array.isArray(result.body?.data) ? result.body.data : [];
    rows.push(...data);
    cursor = result.body?.nextCursor || '';
    if (!cursor) break;
  }
  return { blocked: false, rows };
}

async function exportSide(label, base, key, dir) {
  await mkdir(dir, { recursive: true });
  const listed = await listAll(base, key);
  if (listed.blocked) {
    console.log(`${label} LIST status=${listed.status} ${listed.message}`);
    return listed;
  }
  console.log(`${label} listed ${listed.rows.length} workflows`);
  let saved = 0;
  for (const row of listed.rows) {
    const full = await api(base, key, `/api/v1/workflows/${row.id}`);
    if (full.status >= 400) {
      console.log(`${label} GET ${row.id} status=${full.status}`);
      continue;
    }
    const workflow = full.body?.data || full.body;
    const file = path.join(dir, `${row.id}-${slug(workflow.name || row.name)}.json`);
    await writeFile(file, JSON.stringify(workflow, null, 2));
    saved += 1;
  }
  console.log(`${label} saved ${saved} files`);
  return { blocked: false, count: saved };
}

const oldDir = path.join(root, 'scripts', 'n8n-export', 'old');
const newDir = path.join(root, 'scripts', 'n8n-export', 'new');
const oldResult = await exportSide('OLD', env.OLD_N8N_URL, env.OLD_N8N_API_KEY, oldDir);
if (oldResult.blocked) {
  process.exit(2);
}
const newResult = await exportSide('NEW', env.NEW_N8N_URL, env.NEW_N8N_API_KEY, newDir);
if (newResult.blocked) {
  process.exit(3);
}
