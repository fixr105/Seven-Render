#!/usr/bin/env tsx
/**
 * Utility script to print a table of:
 * - Airtable record ID
 * - Business Client ID
 * - Client Name
 *
 * Usage:
 *   npm run debug:clients-table
 */

import 'dotenv/config';
import { n8nClient } from '../src/services/airtable/n8nClient.js';

async function main() {
  try {
    // Fetch Clients table via shared n8n client (uses webhookConfig + N8N_BASE_URL)
    // Use a higher timeout for this ad-hoc diagnostic script to reduce chances of webhook timeout.
    const clients = await n8nClient.fetchTable('Clients', false, undefined, 15000);

    if (!clients || clients.length === 0) {
      console.log('No Clients records found.');
      return;
    }

    const rows = clients.map((c: any) => {
      const recordId = c.id;
      const clientId = c['Client ID'] || c.clientId || recordId;
      const clientName =
        c['Client Name'] ||
        c.clientName ||
        c['Primary Contact Name'] ||
        'Unknown';

      return {
        recordId,
        clientId,
        clientName,
      };
    });

    // Sort by clientId for easier debugging
    rows.sort((a, b) => {
      const aId = String(a.clientId || '');
      const bId = String(b.clientId || '');
      return aId.localeCompare(bId, undefined, { numeric: true, sensitivity: 'base' });
    });

    console.log('Clients table (Record ID ↔ Client ID ↔ Client Name)');
    console.log('====================================================');
    console.table(rows);
  } catch (error: any) {
    console.error('Failed to load Clients table:', error?.message || error);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unexpected error in print-clients-table.ts:', err);
  process.exit(1);
});

