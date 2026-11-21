/**
 * GET the 17 LMS read paths on N8N_LMS_BASE_URL.
 * Does not call POST, PATCH, or DELETE.
 *
 *   node scripts/check-n8n.js
 */
const BASE = (
  process.env.N8N_LMS_BASE_URL || 'https://n8n-fvmj.srv1499064.hstgr.cloud/webhook'
).replace(/\/+$/, '');

const PATHS = [
  'useraccount',
  'client',
  'kamusers',
  'creditteamuser',
  'loanapplication',
  'loanproducts',
  'nbfcpartners',
  'commisionledger',
  'fileauditinglog',
  'Adminactivity',
  'dailysummaryreport',
  'notifications',
  'productdocument',
  'VehiclesGET1',
  'getclientKYC',
  'lenderbre',
  'lenderbreconfig',
];

function recordCount(body) {
  if (Array.isArray(body)) return body.length;
  if (body && typeof body === 'object') {
    for (const key of ['records', 'data']) {
      if (Array.isArray(body[key])) return body[key].length;
    }
  }
  return 0;
}

let failed = 0;
for (const path of PATHS) {
  const url = `${BASE}/${path}`;
  try {
    const response = await fetch(url, { method: 'GET' });
    const text = await response.text();
    let count = 0;
    try {
      count = recordCount(text.trim() ? JSON.parse(text) : []);
    } catch {
      count = 0;
    }
    console.log(`${path} → ${response.status} → ${count} records`);
    if (response.status !== 200) failed += 1;
  } catch (error) {
    failed += 1;
    console.log(`${path} → ERR → ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failed > 0) {
  process.exitCode = 1;
}
