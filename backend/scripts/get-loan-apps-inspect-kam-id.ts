#!/usr/bin/env tsx
/** One-off: GET loan applications and log KAM ID field name/format */
import { n8nClient } from '../src/services/airtable/n8nClient.js';

const apps = await n8nClient.fetchTable('Loan Application', false);
const first = apps[0];
if (!first) {
  console.log('No applications');
  process.exit(1);
}
console.log('Keys:', Object.keys(first).sort().join(', '));
console.log('---');
console.log('KAM ID (raw):', JSON.stringify((first as any)['KAM ID']));
console.log('KAM ID type:', typeof (first as any)['KAM ID']);
console.log('Sample:', {
  id: (first as any).id,
  'File ID': (first as any)['File ID'],
  Client: (first as any)['Client'],
  'KAM ID': (first as any)['KAM ID'],
});
