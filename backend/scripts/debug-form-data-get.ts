/**
 * Debug script: GET Loan Applications and inspect Form Data field.
 * Run: cd backend && npx tsx scripts/debug-form-data-get.ts
 * Env: N8N_BASE_URL must be set (from backend/.env or export).
 *
 * Logs for each application: id, File ID, Form Data key(s), value preview.
 */
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'backend', '.env') });

import { n8nClient } from '../src/services/airtable/n8nClient.js';

function formDataKeys(record: Record<string, unknown>): string[] {
  return Object.keys(record).filter(
    (k) =>
      k.toLowerCase().includes('form') &&
      (k.toLowerCase().includes('data') || k === 'Form Data' || k === 'form_data' || k === 'form data')
  );
}

function getFormDataValue(record: Record<string, unknown>): { key: string; value: unknown } | null {
  const keys = ['Form Data', 'form_data', 'form data', 'formData', 'FormData'];
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) {
      return { key, value: record[key] };
    }
  }
  // Check any key containing 'form' and 'data'
  for (const k of Object.keys(record)) {
    if (k.toLowerCase().includes('form') && k.toLowerCase().includes('data')) {
      return { key: k, value: record[k] };
    }
  }
  return null;
}

async function main(): Promise<void> {
  console.log('Fetching Loan Application table (cache disabled)...\n');

  const applications = await n8nClient.fetchTable('Loan Application', false);
  const apps = applications as Record<string, unknown>[];

  console.log(`Total records: ${apps.length}\n`);

  if (apps.length === 0) {
    console.log('No applications returned. Check N8N_BASE_URL and n8n webhook.');
    return;
  }

  // First record: log ALL top-level keys to see what n8n actually returns
  const first = apps[0];
  console.log('--- First record: all top-level keys ---');
  console.log(Object.keys(first).sort().join(', '));
  console.log('');

  for (let i = 0; i < apps.length; i++) {
    const app = apps[i] as Record<string, unknown>;
    const id = app.id ?? '—';
    const fileId = app['File ID'] ?? app.fileId ?? '—';

    const fd = getFormDataValue(app);
    const formRelatedKeys = formDataKeys(app);

    console.log(`--- Application ${i + 1}: id=${id}, File ID=${fileId} ---`);
    console.log('  Form-related keys:', formRelatedKeys.length ? formRelatedKeys.join(', ') : '(none)');

    if (fd) {
      const raw = fd.value;
      const type = typeof raw;
      if (type === 'string') {
        const s = raw as string;
        const preview = s.length > 200 ? s.slice(0, 200) + '...' : s;
        console.log(`  Form Data source key: "${fd.key}" (string, length=${s.length})`);
        console.log('  Preview:', preview);
        if (s.trim() === '' || s === '{}') {
          console.log('  >>> Value is empty or "{}" - Airtable row may have no Form Data, or column name may differ in n8n.');
        } else {
          try {
            const parsed = JSON.parse(s);
            const keys = typeof parsed === 'object' && parsed !== null ? Object.keys(parsed) : [];
            console.log('  Parsed keys count:', keys.length, keys.length ? `(${keys.slice(0, 5).join(', ')}${keys.length > 5 ? '...' : ''})` : '');
          } catch {
            console.log('  (Not valid JSON)');
          }
        }
      } else {
        console.log(`  Form Data source key: "${fd.key}" (type=${type})`, raw);
      }
    } else {
      console.log('  >>> No Form Data key found on this record. n8n may be returning a different field name.');
    }
    console.log('');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
