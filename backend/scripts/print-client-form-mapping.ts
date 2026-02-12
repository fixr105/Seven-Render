#!/usr/bin/env tsx
/**
 * GET Client Form Mapping table and report rows with Client + Product ID.
 *
 * Used to verify: products show as "Available" for a client only when there is
 * at least one Client Form Mapping row with that client's id in Client and that
 * product's id in Product ID. Otherwise the product shows as "Not Available".
 * KAM adds/fixes rows via Form Configuration (client + loan product + modules → Save).
 *
 * Usage:
 *   npm run debug:client-form-mapping
 */

import 'dotenv/config';
import { n8nClient } from '../src/services/airtable/n8nClient.js';

async function main() {
  try {
    const mappings = await n8nClient.fetchTable(
      'Client Form Mapping',
      false,
      undefined,
      15000
    );

    if (!mappings?.length) {
      console.log('No Client Form Mapping records found.');
      return;
    }

    const withClient = mappings.filter(
      (r: any) => (r.Client || r['Client ID'] || '').toString().trim() !== ''
    );
    const withProductId = mappings.filter((r: any) => {
      const p = (r['Product ID'] || r.productId || '').toString().trim();
      return p !== '';
    });
    const withBoth = mappings.filter((r: any) => {
      const c = (r.Client || r['Client ID'] || '').toString().trim();
      const p = (r['Product ID'] || r.productId || '').toString().trim();
      return c !== '' && p !== '';
    });

    console.log('Client Form Mapping (GET) summary');
    console.log('================================');
    console.log('Total rows:', mappings.length);
    console.log('Rows with Client:', withClient.length);
    console.log('Rows with Product ID:', withProductId.length);
    console.log('Rows with BOTH Client and Product ID:', withBoth.length);
    console.log('');

    if (withBoth.length > 0) {
      console.log('Rows with both Client and Product ID (product “Available” for that client):');
      console.table(
        withBoth.map((r: any) => ({
          id: r.id,
          Client: r.Client || r['Client ID'],
          'Product ID': r['Product ID'] || r.productId,
          Category: (r.Category || '').slice(0, 24) + (r.Category?.length > 24 ? '…' : ''),
        }))
      );
    }

    const uniqueClients = [
      ...new Set(
        mappings.map((r: any) => (r.Client || r['Client ID'] || '').toString().trim()).filter(Boolean)
      ),
    ];
    const uniqueProductIds = [
      ...new Set(
        mappings.map((r: any) => (r['Product ID'] || r.productId || '').toString().trim()).filter(Boolean)
      ),
    ];
    console.log('Unique Client values (count:', uniqueClients.length + '):', uniqueClients.slice(0, 20));
    if (uniqueClients.length > 20) console.log('  ... and', uniqueClients.length - 20, 'more');
    console.log('Unique Product ID values:', uniqueProductIds.length ? uniqueProductIds : '(none)');
  } catch (error: any) {
    console.error('Failed to fetch Client Form Mapping:', error?.message || error);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
