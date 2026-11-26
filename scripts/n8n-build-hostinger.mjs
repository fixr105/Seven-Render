/**
 * Build Hostinger copies of the old workflows the LMS still calls, then import them inactive.
 * Reads scripts/.n8n-migrate.env. Never prints API keys or header secrets.
 */
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exportRoot = path.join(root, 'scripts', 'n8n-export');
const envText = await readFile(path.join(root, 'scripts', '.n8n-migrate.env'), 'utf8');
const env = Object.fromEntries(
  envText.split('\n').filter((line) => line.includes('=')).map((line) => {
    const i = line.indexOf('=');
    return [line.slice(0, i), line.slice(i + 1)];
  }),
);

const WORKFLOW_IDS = [
  'NxErNPikkUfj1lYe',
  'NXoBejYRgapk9PoX',
  'f8d4KGtSwFVGD78O',
  'ggA61icc95F5ACxQ',
  'r7ooKxKZNHmKmQkS',
  'xWTYaD5PgW1izGL7',
  'WffZWuEfeQX1yibf',
  'H57Ag87IdWyNjRWb',
  'TQ5nqlIts4T6x9xY',
  'OaE0ZCy1blSSZuNG',
  'Ek1zpXDkRzVsKNEO',
  'jqyQYN3RNzVe4skr',
];

const DROP_WEBHOOK = new Set([
  'NxErNPikkUfj1lYe|POST|edrafter-events',
  'TQ5nqlIts4T6x9xY|POST|loanapplications1',
  'TQ5nqlIts4T6x9xY|POST|Fileauditinglog1',
  'TQ5nqlIts4T6x9xY|POST|NBFCPartners1',
]);

const CREDS = {
  airtable: { id: 'YSoyaX0M4sZGsfCT', name: 'AIRTABLE MAIN' },
  outlook: { id: 'SSz9gfxuvjaIDD5K', name: 'Hello@sevenfincorp.email' },
  openai: { id: 'jlnPSrvgefvZPDOI', name: 'FFA Chatgpt' },
  pdfco: { id: 'ui9Rb68JCJXRObEh', name: 'PDF.co account main' },
  edrafter: { id: 'vYnK3SwbjxkBn0ct', name: 'EDRAFTER API KEY' },
  openwa: { id: '2BpBOxO5t7ZJjRyS', name: 'OPENWA Credential' },
  uploadHeader: { id: '11DXIaTYnSOE8MhY', name: 'Upload to URL' },
  sheetsFfa: { id: 'tkg67pPpb8pj4P9R', name: 'FFA' },
  sheetsOther: { id: 'nuoF5NddVgVEXjg1', name: 'Google Sheets account' },
  openrouter: { id: 'judt4JP6Uk2mUBCn', name: 'FFA Openrouter 5X' },
};

const m2 = [];
const inlineKeys = [];

function remember(entry) {
  const key = `${entry.type}|${entry.name}|${entry.workflow}|${entry.node}`;
  if (!m2.some((row) => `${row.type}|${row.name}|${row.workflow}|${row.node}` === key)) m2.push(entry);
}

function mapCredential(type, cred, workflowName, nodeName) {
  const name = cred?.name || '';
  if (type === 'airtableTokenApi') return ['airtableTokenApi', CREDS.airtable];
  if (type === 'microsoftOutlookOAuth2Api') return ['microsoftOutlookOAuth2Api', CREDS.outlook];
  if (type === 'openAiApi') return ['openAiApi', CREDS.openai];
  if (type === 'pdfcoApi' || type === 'pdfcoOAuth2Api') return ['pdfcoOAuth2Api', CREDS.pdfco];
  if (type === 'openRouterApi') return ['openRouterApi', CREDS.openrouter];
  if (type === 'googleSheetsOAuth2Api') {
    return ['googleSheetsOAuth2Api', /rishikesh/i.test(name) ? CREDS.sheetsOther : CREDS.sheetsFfa];
  }
  if (type === 'httpHeaderAuth') {
    if (/edrafter/i.test(name)) return ['httpHeaderAuth', CREDS.edrafter];
    if (/openwa/i.test(name)) return ['httpHeaderAuth', CREDS.openwa];
    if (/upload/i.test(name)) return ['httpHeaderAuth', CREDS.uploadHeader];
    remember({
      type: 'httpHeaderAuth',
      name: name || 'HTTP Header Auth',
      workflow: workflowName,
      node: nodeName,
      need: `The same header credential that was named "${name}" on the old n8n.`,
    });
    return null;
  }
  if (type === 'uploadToUrlApi') {
    remember({
      type: 'uploadToUrlApi',
      name: 'Upload to URL account',
      workflow: workflowName,
      node: nodeName,
      need: 'API key for the n8n community node n8n-nodes-uploadtourl (the old credential was named "Upload to URL account"). Used by file upload and geo photos.',
    });
    return null;
  }
  if (type === 'anthropicApi') {
    remember({
      type: 'anthropicApi',
      name: 'Anthropic account',
      workflow: workflowName,
      node: nodeName,
      need: 'Anthropic API key (api.anthropic.com). The old credential was named "Anthropic account 2".',
    });
    return null;
  }
  if (type === 'googleDriveOAuth2Api') {
    remember({
      type: 'googleDriveOAuth2Api',
      name: 'Google Drive account',
      workflow: workflowName,
      node: nodeName,
      need: 'Google Drive OAuth for the account that stores the CIBIL matrix files. The old credential was named "Google Drive account 2".',
    });
    return null;
  }
  remember({
    type,
    name: name || type,
    workflow: workflowName,
    node: nodeName,
    need: `A ${type} credential matching the old one named "${name}".`,
  });
  return null;
}

function noteInline(node, workflowName) {
  const headers = node.parameters?.headerParameters?.parameters;
  if (!Array.isArray(headers)) return;
  for (const header of headers) {
    const value = header?.value;
    if (typeof value === 'string' && value.length > 12 && !value.startsWith('=')) {
      inlineKeys.push({
        workflow: workflowName,
        node: node.name,
        where: `header ${header.name || '(unnamed)'}`,
      });
    }
  }
}

function webhookKey(workflowId, node) {
  const method = String(node.parameters?.httpMethod || 'GET').toUpperCase();
  const webhookPath = node.parameters?.path || '';
  return `${workflowId}|${method}|${webhookPath}`;
}

function cleanWorkflow(workflow, activeNew) {
  const originalName = workflow.name || 'workflow';
  const nodes = [];
  const removed = new Set();
  for (const node of workflow.nodes || []) {
    const isWebhook = String(node.type || '').includes('webhook') && node.parameters?.path;
    if (isWebhook) {
      const key = webhookKey(workflow.id, node);
      const method = String(node.parameters.httpMethod || 'GET').toUpperCase();
      const liveKey = `${method} ${node.parameters.path}`;
      const dropBecauseLive = workflow.id === 'OaE0ZCy1blSSZuNG' && activeNew.has(liveKey);
      if (DROP_WEBHOOK.has(key) || dropBecauseLive) {
        removed.add(node.name);
        continue;
      }
    }
    const copy = structuredClone(node);
    if (String(copy.type || '').includes('webhook')) {
      copy.webhookId = randomUUID();
    }
    if (copy.credentials) {
      const next = {};
      for (const [type, cred] of Object.entries(copy.credentials)) {
        const mapped = mapCredential(type, cred, originalName, copy.name);
        if (mapped) next[mapped[0]] = mapped[1];
      }
      copy.credentials = next;
    }
    noteInline(copy, originalName);
    nodes.push(copy);
  }
  const connections = {};
  for (const [from, outputs] of Object.entries(workflow.connections || {})) {
    if (removed.has(from)) continue;
    const nextOutputs = {};
    for (const [channel, groups] of Object.entries(outputs || {})) {
      nextOutputs[channel] = (groups || []).map((group) =>
        (group || []).filter((link) => link && !removed.has(link.node)),
      );
    }
    connections[from] = nextOutputs;
  }
  const settings = {};
  if (workflow.settings?.executionOrder) settings.executionOrder = workflow.settings.executionOrder;
  if (workflow.settings?.binaryMode) settings.binaryMode = workflow.settings.binaryMode;
  return {
    name: `[HSTG] ${originalName}`.slice(0, 128),
    nodes,
    connections,
    settings,
    oldId: workflow.id,
  };
}

const index = JSON.parse(await readFile(path.join(exportRoot, 'webhook-index.json'), 'utf8'));
const activeNew = new Set(index.new.filter((row) => row.active).map((row) => `${row.method} ${row.path}`));
const oldDir = path.join(exportRoot, 'old');
const outDir = path.join(exportRoot, 'hostinger');
await mkdir(outDir, { recursive: true });
const oldFiles = await readdir(oldDir);

const built = [];
for (const id of WORKFLOW_IDS) {
  const file = oldFiles.find((name) => name.startsWith(`${id}-`) || name.startsWith(id));
  const workflow = JSON.parse(await readFile(path.join(oldDir, file), 'utf8'));
  const cleaned = cleanWorkflow(workflow, activeNew);
  const oldHost = `https://${'fixr'}rahul.app.n8n.cloud`;
  const text = JSON.stringify(cleaned, null, 2).replaceAll(
    oldHost,
    'https://n8n-fvmj.srv1499064.hstgr.cloud',
  );
  if (text.includes(oldHost)) {
    console.log(`OLD HOST STILL IN ${id}`);
  }
  const outName = `${id}.json`;
  await writeFile(path.join(outDir, outName), text);
  built.push(JSON.parse(text));
  console.log(`built ${cleaned.name} nodes=${cleaned.nodes.length}`);
}

await writeFile(path.join(exportRoot, 'm2.json'), JSON.stringify({ m2, inlineKeys }, null, 2));
console.log(`m2 entries ${m2.length} inline key locations ${inlineKeys.length}`);

const idMap = {};
for (const workflow of built) {
  const payload = {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings,
  };
  const response = await fetch(`${env.NEW_N8N_URL.replace(/\/+$/, '')}/api/v1/workflows`, {
    method: 'POST',
    headers: {
      'X-N8N-API-KEY': env.NEW_N8N_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  let body = null;
  try { body = JSON.parse(text); } catch { body = { message: text.slice(0, 300) }; }
  if (response.status >= 400) {
    const message = body?.message || body?.error || text.slice(0, 400);
    console.log(`IMPORT FAIL ${workflow.oldId} status=${response.status} ${String(message).slice(0, 400)}`);
    continue;
  }
  const created = body?.data || body;
  idMap[workflow.oldId] = { id: created.id, name: created.name, active: created.active };
  console.log(`imported ${workflow.oldId} -> ${created.id} active=${created.active}`);
}
await writeFile(path.join(exportRoot, 'id-map.json'), JSON.stringify(idMap, null, 2));
console.log(`imported ${Object.keys(idMap).length} of ${built.length}`);
