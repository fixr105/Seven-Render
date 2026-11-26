/**
 * Append the remaining Airtable LMS routes. Does not edit nodes that were
 * already on the workflow before this script.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
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
const AIRTABLE = { id: 'YSoyaX0M4sZGsfCT', name: 'AIRTABLE MAIN' };
const BASE_ID = 'appzbyi8q7pJRl1cd';

const liveRes = await fetch(`${base}/api/v1/workflows/U41wWEvV5Stn6Dzr`, {
  headers: { 'X-N8N-API-KEY': env.NEW_N8N_API_KEY, Accept: 'application/json' },
});
const liveBody = await liveRes.json();
const lms = liveBody.data || liveBody;
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
await writeFile(path.join(root, 'scripts', 'n8n-export', `lms-backup-${stamp}.json`), JSON.stringify(lms));

const existingNames = new Set(lms.nodes.map((node) => node.name));
const existingPaths = new Set(
  lms.nodes.filter((node) => node.type === 'n8n-nodes-base.webhook').map((node) => `${node.parameters.httpMethod || 'GET'} ${node.parameters.path}`),
);
const nodes = [];
const connections = {};
let y = 17000;
const x = 11000;

function add(node) {
  if (existingNames.has(node.name)) throw new Error(`name clash ${node.name}`);
  nodes.push(node);
  existingNames.add(node.name);
  return node.name;
}
function link(from, to, output = 0) {
  connections[from] ||= { main: [] };
  while (connections[from].main.length <= output) connections[from].main.push([]);
  connections[from].main[output].push({ node: to, type: 'main', index: 0 });
}
function webhook(method, webhookPath) {
  const key = `${method} ${webhookPath}`;
  if (existingPaths.has(key)) throw new Error(`path clash ${key}`);
  existingPaths.add(key);
  return add({
    parameters: { httpMethod: method, path: webhookPath, responseMode: 'responseNode', options: {} },
    type: 'n8n-nodes-base.webhook',
    typeVersion: 2.1,
    position: [x, y],
    id: randomUUID(),
    name: `${method} ${webhookPath} | Webhook`,
    webhookId: randomUUID(),
  });
}
function sticky(title, method, webhookPath, request, response) {
  add({
    parameters: {
      content: `## ${title}\n\n**Webhook:** ${method} ${base}/webhook/${webhookPath}\n\n**Request Payload:**\n${request}\n\n**Response Payload:**\n${response}`,
      height: 260,
      width: 480,
      color: 5,
    },
    type: 'n8n-nodes-base.stickyNote',
    typeVersion: 1,
    position: [x - 520, y],
    id: randomUUID(),
    name: `## ${title} ${webhookPath}`,
  });
}
function tableRef(name, id) {
  return {
    __rl: true,
    value: id,
    mode: 'list',
    cachedResultName: name,
    cachedResultUrl: `https://airtable.com/${BASE_ID}/${id}`,
  };
}
const baseRef = {
  __rl: true,
  value: BASE_ID,
  mode: 'list',
  cachedResultName: 'Seven Dashboard',
  cachedResultUrl: `https://airtable.com/${BASE_ID}`,
};

function listRoute(title, webhookPath, tableName, tableId) {
  y += 320;
  sticky(title, 'GET', webhookPath, 'No body.', 'JSON array of records. Each item has `id` and the Airtable fields at the top level. Empty list is `[]`.');
  const hook = webhook('GET', webhookPath);
  y += 140;
  const search = add({
    parameters: { operation: 'search', base: baseRef, table: tableRef(tableName, tableId), options: {} },
    type: 'n8n-nodes-base.airtable',
    typeVersion: 2.1,
    position: [x + 280, y],
    id: randomUUID(),
    name: `GET ${webhookPath} | Airtable search`,
    credentials: { airtableTokenApi: AIRTABLE },
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 1000,
    alwaysOutputData: true,
    onError: 'continueRegularOutput',
  });
  y += 140;
  const shape = add({
    parameters: {
      jsCode: `const rows = $input.all().map((item) => item.json).filter((row) => row && row.id);
const flat = rows.map((row) => (row.fields ? { id: row.id, createdTime: row.createdTime, ...row.fields } : row));
return [{ json: { body: JSON.stringify(flat) } }];`,
    },
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [x + 560, y],
    id: randomUUID(),
    name: `GET ${webhookPath} | Shape`,
  });
  y += 140;
  const done = add({
    parameters: {
      respondWith: 'text',
      responseBody: '={{ $json.body }}',
      options: { responseCode: 200, responseHeaders: { entries: [{ name: 'Content-Type', value: 'application/json' }] } },
    },
    type: 'n8n-nodes-base.respondToWebhook',
    typeVersion: 1.4,
    position: [x + 840, y],
    id: randomUUID(),
    name: `GET ${webhookPath} | Respond`,
  });
  link(hook, search);
  link(search, shape);
  link(shape, done);
}

function writeRoute(title, method, webhookPath, tableId) {
  y += 320;
  sticky(
    title,
    method,
    webhookPath,
    'JSON object of Airtable field names. Include `id` (rec…) to update. DELETE sends `{ id }`.',
    '`{ success:true, id, fields }` or `{ success:false, error }`.',
  );
  const hook = webhook(method, webhookPath);
  y += 140;
  const prep = add({
    parameters: {
      jsCode: `const body = $json.body || {};
const recordId = typeof body.id === 'string' && body.id.startsWith('rec') ? body.id : '';
const fields = { ...body };
delete fields.id;
delete fields.base_id;
return [{ json: { recordId, fields, method: ${JSON.stringify(method)} } }];`,
    },
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [x + 280, y],
    id: randomUUID(),
    name: `${method} ${webhookPath} | Fields`,
  });
  y += 140;
  const call = add({
    parameters: {
      method: `={{ $json.method === 'DELETE' ? 'DELETE' : ($json.recordId ? 'PATCH' : 'POST') }}`,
      url: `={{ 'https://api.airtable.com/v0/${BASE_ID}/${tableId}' + ($json.method === 'DELETE' || $json.recordId ? '/' + encodeURIComponent($json.recordId) : '') }}`,
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'airtableTokenApi',
      sendHeaders: true,
      headerParameters: { parameters: [{ name: 'Content-Type', value: 'application/json' }] },
      sendBody: `={{ $json.method !== 'DELETE' }}`,
      specifyBody: 'json',
      jsonBody: '={{ JSON.stringify($json.recordId ? { fields: $json.fields } : { fields: $json.fields, typecast: true }) }}',
      options: { response: { response: { neverError: true } }, timeout: 20000 },
    },
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [x + 560, y],
    id: randomUUID(),
    name: `${method} ${webhookPath} | Airtable`,
    credentials: { airtableTokenApi: AIRTABLE },
    retryOnFail: false,
    maxTries: 1,
    onError: 'continueRegularOutput',
  });
  y += 140;
  const shape = add({
    parameters: {
      jsCode: `const raw = $input.first().json;
const data = raw.body || raw;
if (data.error) return [{ json: { success: false, error: data.error.message || 'Airtable write failed' } }];
if (data.deleted === true) return [{ json: { success: true, id: data.id, deleted: true } }];
return [{ json: { success: true, id: data.id, fields: data.fields || {} } }];`,
    },
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [x + 840, y],
    id: randomUUID(),
    name: `${method} ${webhookPath} | Shape`,
  });
  y += 140;
  const done = add({
    parameters: { respondWith: 'json', responseBody: '={{ JSON.stringify($json) }}', options: { responseCode: 200 } },
    type: 'n8n-nodes-base.respondToWebhook',
    typeVersion: 1.4,
    position: [x + 1120, y],
    id: randomUUID(),
    name: `${method} ${webhookPath} | Respond`,
  });
  link(hook, prep);
  link(prep, call);
  link(call, shape);
  link(shape, done);
}

const lists = [
  ['Form Link', 'formlink', 'Form Link', 'tblsqKXEwiIcEhjTj'],
  ['Form Categories', 'formcategories', 'Form Categories', 'tblqCqXV0Hds0t0bH'],
  ['Form Fields', 'formfields', 'Form Fields', 'tbl5oZ6zI0dc5eutw'],
  ['Client Form Mapping', 'clientformmapping', 'Client Form Mapping', 'tbl70C8uPKmoLkOQJ'],
  ['Record Titles', 'Recordtitle', 'Record Titles', 'tblGDtvbgzwKsMtN9'],
];
for (const row of lists) listRoute(...row);

const writes = [
  ['Form Link Create', 'POST', 'Formlink', 'tblsqKXEwiIcEhjTj'],
  ['Form Link Update', 'PATCH', 'formlink', 'tblsqKXEwiIcEhjTj'],
  ['Form Link Delete', 'DELETE', 'formlink', 'tblsqKXEwiIcEhjTj'],
  ['Form Category Create', 'POST', 'FormCategory', 'tblqCqXV0Hds0t0bH'],
  ['Form Fields Create', 'POST', 'FormFields', 'tbl5oZ6zI0dc5eutw'],
  ['Client Form Mapping Create', 'POST', 'POSTCLIENTFORMMAPPING', 'tbl70C8uPKmoLkOQJ'],
  ['Record Title Create', 'POST', 'Recordtitle', 'tblGDtvbgzwKsMtN9'],
  ['Record Title Update', 'PATCH', 'recordtitle', 'tblGDtvbgzwKsMtN9'],
  ['Record Title Delete', 'DELETE', 'recordtitle', 'tblGDtvbgzwKsMtN9'],
  ['Loan Product Create', 'POST', 'loanproducts1', 'tblVukvj8kn5gWBta'],
  ['Loan Product Delete', 'DELETE', 'loanproducts', 'tblVukvj8kn5gWBta'],
  ['NBFC Partner Create', 'POST', 'NBFCPartners', 'tblGvEp8Z1QvahwI0'],
];
for (const row of writes) writeRoute(...row);

// Client KYC uses the table name because the old node stored it that way.
y += 320;
sticky('Client KYC', 'GET', 'clientkyc', 'No body.', 'JSON array. `Dealer PAN` and the other KYC fields are on each item.');
{
  const hook = webhook('GET', 'clientkyc');
  y += 140;
  const search = add({
    parameters: {
      operation: 'search',
      base: baseRef,
      table: { __rl: true, value: 'Client KYC', mode: 'name' },
      options: {},
    },
    type: 'n8n-nodes-base.airtable',
    typeVersion: 2.1,
    position: [x + 280, y],
    id: randomUUID(),
    name: 'GET clientkyc | Airtable search',
    credentials: { airtableTokenApi: AIRTABLE },
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 1000,
    alwaysOutputData: true,
    onError: 'continueRegularOutput',
  });
  y += 140;
  const shape = add({
    parameters: {
      jsCode: `const rows = $input.all().map((item) => item.json).filter((row) => row && row.id);
const flat = rows.map((row) => (row.fields ? { id: row.id, createdTime: row.createdTime, ...row.fields } : row));
return [{ json: { body: JSON.stringify(flat) } }];`,
    },
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [x + 560, y],
    id: randomUUID(),
    name: 'GET clientkyc | Shape',
  });
  y += 140;
  const done = add({
    parameters: {
      respondWith: 'text',
      responseBody: '={{ $json.body }}',
      options: { responseCode: 200, responseHeaders: { entries: [{ name: 'Content-Type', value: 'application/json' }] } },
    },
    type: 'n8n-nodes-base.respondToWebhook',
    typeVersion: 1.4,
    position: [x + 840, y],
    id: randomUUID(),
    name: 'GET clientkyc | Respond',
  });
  link(hook, search);
  link(search, shape);
  link(shape, done);
}

y += 320;
sticky('Client KYC Write', 'POST', 'clientkyc', 'JSON KYC fields. `id` updates an existing row.', '`{ success:true, id, fields }`');
{
  const hook = webhook('POST', 'clientkyc');
  y += 140;
  const prep = add({
    parameters: {
      jsCode: `const body = $json.body || {};
const recordId = typeof body.id === 'string' && body.id.startsWith('rec') ? body.id : '';
const fields = { ...body };
delete fields.id;
return [{ json: { recordId, fields } }];`,
    },
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [x + 280, y],
    id: randomUUID(),
    name: 'POST clientkyc | Fields',
  });
  y += 140;
  const call = add({
    parameters: {
      method: "={{ $json.recordId ? 'PATCH' : 'POST' }}",
      url: "={{ 'https://api.airtable.com/v0/" + BASE_ID + "/' + encodeURIComponent('Client KYC') + ($json.recordId ? '/' + $json.recordId : '') }}",
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'airtableTokenApi',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '={{ JSON.stringify($json.recordId ? { fields: $json.fields } : { fields: $json.fields, typecast: true }) }}',
      options: { response: { response: { neverError: true } }, timeout: 20000 },
    },
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [x + 560, y],
    id: randomUUID(),
    name: 'POST clientkyc | Airtable',
    credentials: { airtableTokenApi: AIRTABLE },
    retryOnFail: false,
    maxTries: 1,
  });
  y += 140;
  const shape = add({
    parameters: {
      jsCode: `const data = $input.first().json.body || $input.first().json;
if (data.error) return [{ json: { success: false, error: data.error.message || 'Airtable write failed' } }];
return [{ json: { success: true, id: data.id, fields: data.fields || {} } }];`,
    },
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [x + 840, y],
    id: randomUUID(),
    name: 'POST clientkyc | Shape',
  });
  y += 140;
  const done = add({
    parameters: { respondWith: 'json', responseBody: '={{ JSON.stringify($json) }}', options: { responseCode: 200 } },
    type: 'n8n-nodes-base.respondToWebhook',
    typeVersion: 1.4,
    position: [x + 1120, y],
    id: randomUUID(),
    name: 'POST clientkyc | Respond',
  });
  link(hook, prep);
  link(prep, call);
  link(call, shape);
  link(shape, done);
}

function textRoute(title, method, webhookPath, request, body) {
  y += 280;
  sticky(title, method, webhookPath, request, body);
  const hook = webhook(method, webhookPath);
  y += 140;
  const done = add({
    parameters: {
      respondWith: 'text',
      responseBody: body.startsWith('=') ? body : body,
      options: { responseCode: 200, responseHeaders: { entries: [{ name: 'Content-Type', value: 'application/json' }] } },
    },
    type: 'n8n-nodes-base.respondToWebhook',
    typeVersion: 1.4,
    position: [x + 280, y],
    id: randomUUID(),
    name: `${method} ${webhookPath} | Respond`,
  });
  link(hook, done);
}

textRoute('Link pool', 'GET', 'getlink0', 'No body.', '[]');
textRoute('Link pool update', 'POST', 'getlink0', 'JSON `{ status, link }`.', '{"success":true}');
textRoute('Share link', 'POST', '3212b705-b54a-4d4e-9648-e7a6bfb06d2b', 'JSON `{ file }`.', '{"success":true}');

const payload = {
  name: lms.name,
  nodes: [...lms.nodes, ...nodes],
  connections: { ...lms.connections, ...connections },
  settings: lms.settings || { executionOrder: 'v1' },
};
if (lms.staticData) payload.staticData = lms.staticData;
const response = await fetch(`${base}/api/v1/workflows/U41wWEvV5Stn6Dzr`, {
  method: 'PUT',
  headers: {
    'X-N8N-API-KEY': env.NEW_N8N_API_KEY,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  body: JSON.stringify(payload),
});
const text = await response.text();
console.log(`PUT status=${response.status} added=${nodes.length}`);
if (response.status >= 400) {
  console.log(text.slice(0, 600));
  process.exit(1);
}
const updated = JSON.parse(text);
const workflow = updated.data || updated;
console.log(`active=${workflow.active} nodes=${workflow.nodes.length}`);
if (workflow.active === false) {
  const turnedOn = await fetch(`${base}/api/v1/workflows/U41wWEvV5Stn6Dzr/activate`, {
    method: 'POST',
    headers: { 'X-N8N-API-KEY': env.NEW_N8N_API_KEY, Accept: 'application/json' },
  });
  console.log(`activate status=${turnedOn.status}`);
}
