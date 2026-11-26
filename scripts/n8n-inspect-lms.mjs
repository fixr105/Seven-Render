/**
 * Save the live LMS workflow and print tool sticky notes plus a sample node.
 * Never prints secrets.
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

async function getWorkflow(id) {
  const response = await fetch(`${base}/api/v1/workflows/${id}`, {
    headers: { 'X-N8N-API-KEY': env.NEW_N8N_API_KEY, Accept: 'application/json' },
  });
  const body = await response.json();
  if (response.status >= 400) throw new Error(`GET ${id} ${response.status}`);
  return body.data || body;
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const dir = path.join(root, 'scripts', 'n8n-export');
await mkdir(dir, { recursive: true });
const lms = await getWorkflow('U41wWEvV5Stn6Dzr');
await writeFile(path.join(dir, `lms-backup-${stamp}.json`), JSON.stringify(lms));
console.log(`LMS nodes=${lms.nodes.length} active=${lms.active} name=${lms.name}`);

const tools = await getWorkflow('DdSgox48VKjKoCK8');
await writeFile(path.join(dir, 'tools-workflow.json'), JSON.stringify(tools));
const notes = tools.nodes.filter((node) => String(node.type).includes('stickyNote'));
const wanted = /pan_verification|file-to-url|cibil_report|experian_report|pdf-merge|url-to-pdf/;
for (const note of notes) {
  const text = String(note.parameters?.content || '');
  if (!wanted.test(text)) continue;
  console.log('\n----- STICKY', note.name, '-----');
  console.log(text.slice(0, 2500));
}

const sample = lms.nodes.find((node) => node.type === 'n8n-nodes-base.webhook');
const air = lms.nodes.find((node) => node.type === 'n8n-nodes-base.airtable');
const respond = lms.nodes.find((node) => node.type === 'n8n-nodes-base.respondToWebhook');
const positions = lms.nodes.map((node) => node.position || [0, 0]);
const maxX = Math.max(...positions.map((p) => p[0]));
const maxY = Math.max(...positions.map((p) => p[1]));
console.log('\nBOUNDS', { maxX, maxY, webhooks: lms.nodes.filter((n) => n.type === 'n8n-nodes-base.webhook').length });
await writeFile(path.join(dir, 'lms-node-samples.json'), JSON.stringify({
  webhook: sample,
  airtable: air ? { type: air.type, typeVersion: air.typeVersion, parameters: air.parameters, credentials: air.credentials } : null,
  respond: respond ? { type: respond.type, typeVersion: respond.typeVersion, parameters: respond.parameters } : null,
}, null, 2));
console.log('samples written');
