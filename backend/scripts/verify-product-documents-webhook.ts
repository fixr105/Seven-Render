#!/usr/bin/env tsx
function requiredN8nOrigin(name) {
  const raw = String(process.env[name] || '').trim().replace(/\/+$/, '').replace(/\/webhook$/i, '');
  if (!raw) {
    console.error(name + ' is required. Refusing to fall back to the old n8n host.');
    process.exit(1);
  }
  return raw;
}

/**
 * Verify Product Documents webhook is reachable.
 * Run after tech person creates the n8n workflow.
 *
 * Usage: npx tsx scripts/verify-product-documents-webhook.ts
 */
import 'dotenv/config';

const BASE = requiredN8nOrigin('N8N_LMS_BASE_URL');
const URL = `${BASE}/webhook/productdocument`;

async function main() {
  console.log('\nVerifying Product Documents webhook:', URL);

  try {
    const res = await fetch(URL, { method: 'GET' });
    const status = res.status;
    const text = await res.text();

    if (status === 200) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
      const count = Array.isArray(parsed) ? parsed.length : '?';
      console.log('OK - HTTP 200');
      console.log('Response:', Array.isArray(parsed) ? `Array of ${count} record(s)` : typeof parsed);
      if (Array.isArray(parsed) && parsed.length > 0) {
        console.log('Sample record keys:', Object.keys((parsed as any[])[0]).slice(0, 8).join(', '));
      }
      process.exit(0);
    } else {
      console.error('FAIL - HTTP', status);
      console.error('Response:', text.slice(0, 200));
      process.exit(1);
    }
  } catch (e: any) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}

main();
