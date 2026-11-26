/**
 * Add LMS routes to workflow U41wWEvV5Stn6Dzr. Does not edit existing nodes.
 * Never prints API keys.
 */
import { readFile, readdir, writeFile } from 'node:fs/promises';
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
const OUTLOOK = { id: 'SSz9gfxuvjaIDD5K', name: 'Hello@sevenfincorp.email' };
const BASE_ID = 'appzbyi8q7pJRl1cd';

const exportDir = path.join(root, 'scripts', 'n8n-export');
const backups = (await readdir(exportDir)).filter((name) => name.startsWith('lms-backup-') && name.endsWith('.json')).sort();
const lms = JSON.parse(await readFile(path.join(exportDir, backups.at(-1)), 'utf8'));
const existingNames = new Set(lms.nodes.map((node) => node.name));
const existingPaths = new Set(
  lms.nodes.filter((node) => node.type === 'n8n-nodes-base.webhook').map((node) => `${node.parameters.httpMethod || 'GET'} ${node.parameters.path}`),
);

let y = 8200;
const x = 9800;
const nodes = [];
const connections = {};

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
function webhook(method, webhookPath, name) {
  const key = `${method} ${webhookPath}`;
  if (existingPaths.has(key)) throw new Error(`path clash ${key}`);
  existingPaths.add(key);
  return add({
    parameters: { httpMethod: method, path: webhookPath, responseMode: 'responseNode', options: {} },
    type: 'n8n-nodes-base.webhook',
    typeVersion: 2.1,
    position: [x, y],
    id: randomUUID(),
    name,
    webhookId: randomUUID(),
  });
}
function http(name, parameters, extra = {}) {
  y += 160;
  return add({
    parameters,
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [x + 280, y],
    id: randomUUID(),
    name,
    onError: 'continueRegularOutput',
    ...extra,
  });
}
function code(name, jsCode) {
  y += 160;
  return add({
    parameters: { jsCode },
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [x + 560, y],
    id: randomUUID(),
    name,
  });
}
function respond(name, status = 200) {
  y += 160;
  return add({
    parameters: { respondWith: 'json', responseBody: '={{ JSON.stringify($json) }}', options: { responseCode: status } },
    type: 'n8n-nodes-base.respondToWebhook',
    typeVersion: 1.4,
    position: [x + 840, y],
    id: randomUUID(),
    name,
  });
}
function sticky(title, method, webhookPath, request, response) {
  add({
    parameters: {
      content: `## ${title}\n\n**Webhook:** ${method} ${base}/webhook/${webhookPath}\n\n**Request Payload:**\n${request}\n\n**Response Payload:**\n${response}`,
      height: 280,
      width: 520,
      color: 4,
    },
    type: 'n8n-nodes-base.stickyNote',
    typeVersion: 1,
    position: [x - 560, y],
    id: randomUUID(),
    name: `## ${title}`,
  });
}
function airtableHttp(name, method, urlExpr, { jsonBody, retry } = {}) {
  const parameters = {
    method,
    url: urlExpr,
    authentication: 'predefinedCredentialType',
    nodeCredentialType: 'airtableTokenApi',
    sendHeaders: true,
    headerParameters: { parameters: [{ name: 'Content-Type', value: 'application/json' }] },
    options: { response: { response: { neverError: true } }, timeout: 20000 },
  };
  if (jsonBody) {
    parameters.sendBody = true;
    parameters.specifyBody = 'json';
    parameters.jsonBody = jsonBody;
  }
  return http(name, parameters, {
    retryOnFail: Boolean(retry),
    maxTries: retry ? 3 : 1,
    waitBetweenTries: retry ? 1000 : 0,
    credentials: { airtableTokenApi: AIRTABLE },
  });
}

function toolPost(name, toolPath, jsonBody) {
  return http(name, {
    method: 'POST',
    url: `${base}/webhook/${toolPath}`,
    sendBody: true,
    specifyBody: 'json',
    jsonBody,
    options: { response: { response: { neverError: true } }, timeout: 120000 },
  }, { retryOnFail: false, maxTries: 1 });
}

// PAN verify — maps pan_verification into the profile keys the app already reads.
y = 8200;
sticky(
  'PAN Verify',
  'POST',
  'postMMfrontPAN',
  'JSON `{ Mobile_Number, PAN_Number, Full_Name, recipient_email }`',
  'Success: `{ first_name, last_name, customer_name, gender, date_of_birth, pan_card, mobile_number, email, "address Line 1", pincode, state }`.\nError: `{ ok:false, error }`',
);
const panHook = webhook('POST', 'postMMfrontPAN', 'POST postMMfrontPAN | Webhook');
const panTool = toolPost(
  'POST postMMfrontPAN | pan_verification',
  'pan_verification',
  '={{ JSON.stringify({ PAN_Number: $json.body.PAN_Number, Concent: "Y" }) }}',
);
const panCode = code('POST postMMfrontPAN | Map profile', `const tool = $input.first().json.body || $input.first().json;
const req = $('POST postMMfrontPAN | Webhook').first().json.body || {};
if (!tool || tool.ok !== true || !tool.result) {
  return [{ json: { ok: false, error: (tool && tool.error_message) || 'Could not verify PAN' } }];
}
const result = tool.result;
const name = result.name || {};
const address = result.address || {};
const line1 = [address.address_line_1, address.address_line_2, address.address_line_3].filter(Boolean).join(', ');
return [{ json: {
  first_name: name.first_name || '',
  last_name: name.last_name || '',
  customer_name: result.full_name || '',
  gender: result.gender || '',
  date_of_birth: result.dob || '',
  pan_card: result.pan || req.PAN_Number || '',
  mobile_number: req.Mobile_Number || '',
  email: req.recipient_email || '',
  'address Line 1': line1,
  pincode: address.pincode || '',
  state: address.state || '',
  'village/City': address.address_line_4 || '',
  ref_id: tool.ref_id || '',
} }];`);
const panRespond = respond('POST postMMfrontPAN | Respond');
link(panHook, panTool);
link(panTool, panCode);
link(panCode, panRespond);

// Qualify — one Experian pull, no retry. Response keeps ok/pass/score/bureau_ref/applicant.
y += 280;
sticky(
  'Qualify',
  'POST',
  'qualify',
  'JSON `{ Full_Name, Mobile_Number, PAN_Number, consent_bureau_at, application_id, requested_amount, base_id }`',
  'Success: `{ ok, pass, score, bureau_ref, is_ntc, applicant, cached:false }`.\nError: `{ ok:false, pass:false, error, state:"BUREAU_ERROR" }`',
);
const qHook = webhook('POST', 'qualify', 'POST qualify | Webhook');
const qTool = toolPost(
  'POST qualify | experian_report',
  'experian_report',
  '={{ JSON.stringify({ Full_Name: $json.body.Full_Name, Mobile_Number: $json.body.Mobile_Number, PAN_Number: $json.body.PAN_Number, Concent: "Y" }) }}',
);
const qCode = code('POST qualify | Map result', `const tool = $input.first().json.body || $input.first().json;
const req = $('POST qualify | Webhook').first().json.body || {};
if (!tool || tool.ok !== true) {
  return [{ json: { ok: false, pass: false, state: 'BUREAU_ERROR', error: (tool && tool.error_message) || 'Could not verify right now.', bureau_ref: (tool && tool.ref_id) || '' } }];
}
const result = tool.result || {};
const name = result.name || {};
const scoreRaw = result.score ?? result.credit_score ?? result.cibil_score ?? null;
const score = scoreRaw == null || scoreRaw === '' ? null : Number(scoreRaw);
return [{ json: {
  ok: true,
  pass: true,
  score: Number.isFinite(score) ? score : null,
  bureau_ref: tool.ref_id || '',
  is_ntc: result.is_ntc === true,
  cached: false,
  applicant: {
    first_name: name.first_name || result.first_name || '',
    last_name: name.last_name || result.last_name || '',
    customer_name: result.full_name || req.Full_Name || '',
    pan_card: result.pan || req.PAN_Number || '',
    mobile_number: req.Mobile_Number || '',
    gender: result.gender || '',
    date_of_birth: result.dob || result.date_of_birth || '',
  },
} }];`);
const qRespond = respond('POST qualify | Respond');
link(qHook, qTool);
link(qTool, qCode);
link(qCode, qRespond);

function airtableRead(title, method, webhookPath, urlExpr) {
  y += 280;
  sticky(title, method, webhookPath, 'See the LMS app caller.', 'Airtable records, or `{ ok:true, count, records }` for airtable_get.');
  const hook = webhook(method, webhookPath, `${method} ${webhookPath} | Webhook`);
  const call = airtableHttp(`${method} ${webhookPath} | Airtable`, 'GET', urlExpr, { retry: true });
  const shape = code(`${method} ${webhookPath} | Shape`, `const raw = $input.first().json;
const data = raw.body || raw;
if (data.error) return [{ json: { ok: false, error: data.error.message || data.error.type || 'Airtable read failed' } }];
const records = Array.isArray(data.records) ? data.records : [];
const flat = records.map((row) => ({ id: row.id, createdTime: row.createdTime, ...(row.fields || {}) }));
if (${JSON.stringify(webhookPath)} === 'airtable_get') {
  return [{ json: { ok: true, count: flat.length, records: flat } }];
}
return records.map((row) => ({ json: row }));`);
  const done = respond(`${method} ${webhookPath} | Respond`);
  link(hook, call);
  link(call, shape);
  link(shape, done);
}

function airtableWrite(title, method, webhookPath, tableName) {
  y += 280;
  sticky(
    title,
    method,
    webhookPath,
    'JSON field object. Include `id` (rec…) to update.',
    '`{ ok:true, id, fields }` or `{ ok:false, error }`.',
  );
  const hook = webhook(method, webhookPath, `${method} ${webhookPath} | Webhook`);
  const table = encodeURIComponent(tableName);
  const call = airtableHttp(
    `${method} ${webhookPath} | Airtable`,
    'POST',
    `={{ (() => { const id = $json.body && $json.body.id; const base = 'https://api.airtable.com/v0/${BASE_ID}/${table}'; if (${JSON.stringify(method)} === 'DELETE') return base + '/' + encodeURIComponent(id || ''); if (id && String(id).startsWith('rec') && ${JSON.stringify(method)} !== 'POST') return base + '/' + encodeURIComponent(id); if (id && String(id).startsWith('rec')) return base + '/' + encodeURIComponent(id); return base; })() }}`,
    {
      jsonBody: `={{ JSON.stringify((() => { const body = $json.body || {}; const fields = { ...body }; delete fields.id; delete fields.base_id; if (${JSON.stringify(method)} === 'DELETE') return {}; const id = body.id; if (id && String(id).startsWith('rec')) return { fields }; return { fields, typecast: true }; })()) }}`,
    },
  );
  // Method override is awkward inside one node. Use a code-less approach: POST create, and a second path is not worth a broken formula.
  const shape = code(`${method} ${webhookPath} | Shape`, `const raw = $input.first().json;
const data = raw.body || raw;
if (data.error) return [{ json: { ok: false, error: data.error.message || 'Airtable write failed' } }];
const row = data.records ? data.records[0] : data;
return [{ json: { ok: true, id: row && row.id, fields: (row && row.fields) || {} } }];`);
  const done = respond(`${method} ${webhookPath} | Respond`);
  link(hook, call);
  link(call, shape);
  link(shape, done);
}

y += 200;
sticky(
  'Airtable Get',
  'POST',
  'airtable_get',
  'JSON `{ base_id, table, filter_formula, max }`',
  '`{ ok:true, count, records:[{ id, ...fields }] }` or `{ ok:false, error }`',
);
{
  const hook = webhook('POST', 'airtable_get', 'POST airtable_get | Webhook');
  const call = airtableHttp(
    'POST airtable_get | Airtable',
    'GET',
    `={{ 'https://api.airtable.com/v0/${BASE_ID}/' + encodeURIComponent($json.body.table || '') + '?filterByFormula=' + encodeURIComponent($json.body.filter_formula || '') + '&maxRecords=' + encodeURIComponent(String($json.body.max || 100)) }}`,
    { retry: true },
  );
  const shape = code('POST airtable_get | Shape', `const raw = $input.first().json;
const data = raw.body || raw;
if (data.error) return [{ json: { ok: false, error: data.error.message || data.error.type || 'Airtable get failed' } }];
const records = (data.records || []).map((row) => ({ id: row.id, createdTime: row.createdTime, ...(row.fields || {}) }));
return [{ json: { ok: true, count: records.length, records } }];`);
  const done = respond('POST airtable_get | Respond');
  link(hook, call);
  link(call, shape);
  link(shape, done);
}

y += 200;
sticky(
  'Airtable Write',
  'POST',
  'airtable_write',
  'JSON `{ base_id, table, record_id?, fields }`',
  '`{ ok:true, id, fields }` or `{ ok:false, error }`',
);
{
  const hook = webhook('POST', 'airtable_write', 'POST airtable_write | Webhook');
  const call = airtableHttp(
    'POST airtable_write | Airtable',
    'POST',
    `={{ 'https://api.airtable.com/v0/${BASE_ID}/' + encodeURIComponent($json.body.table || '') + ($json.body.record_id ? '/' + encodeURIComponent($json.body.record_id) : '') }}`,
    { jsonBody: '={{ JSON.stringify($json.body.record_id ? { fields: $json.body.fields || {} } : { fields: $json.body.fields || {}, typecast: true }) }}' },
  );
  const shape = code('POST airtable_write | Shape', `const raw = $input.first().json;
const data = raw.body || raw;
if (data.error) return [{ json: { ok: false, error: data.error.message || 'Airtable write failed' } }];
return [{ json: { ok: true, id: data.id, fields: data.fields || {} } }];`);
  const done = respond('POST airtable_write | Respond');
  link(hook, call);
  link(call, shape);
  link(shape, done);
}

// PATCH when record_id is present: Airtable update is PATCH. The node above always POSTs.
// A code node cannot change the HTTP method. Use PATCH when record_id exists by splitting... 
// Fix: replace the single write call with an expression method.
const writeNode = nodes.find((node) => node.name === 'POST airtable_write | Airtable');
writeNode.parameters.method = '={{ $json.body.record_id ? "PATCH" : "POST" }}';

y += 220;
sticky(
  'File Upload',
  'POST',
  'urllink',
  'multipart field `data` (PDF).',
  '`{ ok:true, url }` or `{ ok:false, error }`',
);
{
  const hook = webhook('POST', 'urllink', 'POST urllink | Webhook');
  const call = http('POST urllink | file-to-url', {
    method: 'POST',
    url: `${base}/webhook/file-to-url`,
    sendBody: true,
    contentType: 'multipart-form-data',
    bodyParameters: { parameters: [{ parameterType: 'formBinaryData', name: 'file1', inputDataFieldName: 'data' }] },
    options: { response: { response: { neverError: true } }, timeout: 120000 },
  }, { retryOnFail: false, maxTries: 1 });
  const shape = code('POST urllink | Shape', `const raw = $input.first().json.body || $input.first().json;
const url = (raw.urls && raw.urls[0]) || '';
if (raw.ok === true && url) return [{ json: { ok: true, url } }];
return [{ json: { ok: false, error: raw.error_message || 'File upload failed' } }];`);
  const done = respond('POST urllink | Respond');
  link(hook, call);
  link(call, shape);
  link(shape, done);
}

for (const slot of ['UPL1', 'UPL2', 'UPL3']) {
  y += 200;
  sticky(slot, 'POST', slot, 'multipart field `file`, plus fieldId, fileName.', '`{ status:"success", url, fileName }`');
  const hook = webhook('POST', slot, `POST ${slot} | Webhook`);
  const shape = code(`POST ${slot} | Not a PDF`, `return [{ json: { status: 'error', error: 'Geo photo storage is not available yet. file-to-url accepts PDFs only, and no Airtable attachment table exists.' } }];`);
  const done = respond(`POST ${slot} | Respond`);
  link(hook, shape);
  link(shape, done);
}

y += 200;
sticky('CIBIL matrix', 'GET', 'getmatrix', 'No body.', 'Airtable record array with fields.start_cibil. Empty array uses the app default band.');
{
  const hook = webhook('GET', 'getmatrix', 'GET getmatrix | Webhook');
  const done = add({
    parameters: { respondWith: 'text', responseBody: '[]', options: { responseCode: 200 } },
    type: 'n8n-nodes-base.respondToWebhook',
    typeVersion: 1.4,
    position: [x + 280, y + 160],
    id: randomUUID(),
    name: 'GET getmatrix | Respond',
  });
  link(hook, done);
}

y += 200;
sticky('Email', 'POST', 'email', 'JSON `{ to, subject, html, text }`', '`{ ok:true }` or `{ ok:false, error }`');
{
  const hook = webhook('POST', 'email', 'POST email | Webhook');
  y += 160;
  const send = add({
    parameters: {
      toRecipients: '={{ $json.body.to }}',
      subject: '={{ $json.body.subject }}',
      bodyContent: '={{ $json.body.html || $json.body.text || "" }}',
      additionalFields: { bodyContentType: 'html' },
    },
    type: 'n8n-nodes-base.microsoftOutlook',
    typeVersion: 2,
    position: [x + 280, y],
    id: randomUUID(),
    name: 'POST email | Outlook',
    credentials: { microsoftOutlookOAuth2Api: OUTLOOK },
    onError: 'continueErrorOutput',
  });
  const ok = respond('POST email | Respond');
  y += 80;
  const bad = code('POST email | Error', 'return [{ json: { ok: false, error: "Email was not sent" } }];');
  const badRespond = respond('POST email | Error respond');
  const marked = code('POST email | Ok', 'return [{ json: { ok: true } }];');
  link(hook, send);
  link(send, marked, 0);
  link(marked, ok);
  link(send, bad, 1);
  link(bad, badRespond);
}

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
  console.log(text.slice(0, 500));
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
