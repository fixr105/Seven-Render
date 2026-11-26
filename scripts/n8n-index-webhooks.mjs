/**
 * Index webhook path + method from exported n8n workflows. No secrets.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exportRoot = path.join(root, 'scripts', 'n8n-export');

async function indexDir(dir) {
  const files = (await readdir(dir)).filter((name) => name.endsWith('.json'));
  const rows = [];
  for (const file of files) {
    const workflow = JSON.parse(await readFile(path.join(dir, file), 'utf8'));
    const nodes = Array.isArray(workflow.nodes) ? workflow.nodes : [];
    for (const node of nodes) {
      const type = String(node.type || '');
      if (!type.includes('webhook')) continue;
      const params = node.parameters || {};
      const webhookPath = params.path || '';
      const method = String(params.httpMethod || params.method || 'GET').toUpperCase();
      rows.push({
        file,
        id: workflow.id,
        name: workflow.name,
        active: Boolean(workflow.active),
        node: node.name,
        type,
        method,
        path: webhookPath,
        webhookId: node.webhookId || '',
      });
    }
  }
  return rows;
}

const oldRows = await indexDir(path.join(exportRoot, 'old'));
const newRows = await indexDir(path.join(exportRoot, 'new'));
const out = { old: oldRows, new: newRows };
await writeFile(path.join(exportRoot, 'webhook-index.json'), JSON.stringify(out, null, 2));
console.log(`old webhooks ${oldRows.length} new webhooks ${newRows.length}`);

const needed = [
  ['POST', 'qualify'],
  ['POST', 'airtable_get'],
  ['POST', 'airtable_write'],
  ['POST', 'urllink'],
  ['POST', 'POSTfull1'],
  ['POST', 'POSTfull2'],
  ['POST', 'POSTfull3'],
  ['POST', 'postMMfrontPAN'],
  ['GET', 'getmatrix'],
  ['GET', 'getlink0'],
  ['GET', 'clientkyc'],
  ['POST', 'clientkyc'],
  ['POST', 'UPL1'],
  ['POST', 'UPL2'],
  ['POST', 'UPL3'],
  ['POST', 'big-brain-bro'],
  ['POST', 'big-brain-bro-1'],
  ['POST', 'get-raad'],
  ['GET', 'get-raad'],
  ['POST', 'get-pager'],
  ['GET', 'get-pager'],
  ['POST', 'loanproducts1'],
  ['DELETE', 'loanproducts'],
  ['POST', 'NBFCPartners'],
  ['GET', 'formlink'],
  ['POST', 'formlink'],
  ['POST', 'Formlink'],
  ['PATCH', 'formlink'],
  ['DELETE', 'formlink'],
  ['GET', 'Recordtitle'],
  ['POST', 'Recordtitle'],
  ['PATCH', 'Recordtitle'],
  ['DELETE', 'Recordtitle'],
  ['GET', 'formcategories'],
  ['POST', 'FormCategory'],
  ['GET', 'formfields'],
  ['POST', 'FormFields'],
  ['GET', 'clientformmapping'],
  ['POST', 'POSTCLIENTFORMMAPPING'],
  ['POST', 'email'],
  ['POST', '3212b705-b54a-4d4e-9648-e7a6bfb06d2b'],
  ['POST', '85af8f18-a251-45a3-b95e-ad593070fd0e'],
  ['POST', 'upload-pager'],
  ['POST', 'validate'],
  ['POST', 'pan_verification'],
];

function find(rows, method, webhookPath) {
  return rows.filter((row) => row.path === webhookPath && (row.method === method || row.method === '' || method === 'ANY'));
}

for (const [method, webhookPath] of needed) {
  const hits = find(oldRows, method, webhookPath);
  const label = hits.length
    ? hits.map((hit) => `${hit.active ? 'active' : 'off'} ${hit.id} ${hit.name} :: ${hit.node}`).join(' | ')
    : 'MISSING';
  console.log(`${method} ${webhookPath} => ${label}`);
}
