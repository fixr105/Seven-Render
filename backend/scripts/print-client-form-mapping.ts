#!/usr/bin/env tsx
/**
 * GET Product Documents table and report summary.
 *
 * Form config uses Product Documents (product-centric). Products show documents
 * when Product Documents rows exist for that Product ID.
 * Credit Team configures via Form Configuration page.
 *
 * Usage:
 *   npm run debug:client-form-mapping
 */

import 'dotenv/config';
import { n8nClient } from '../src/services/airtable/n8nClient.js';

async function main() {
  try {
    const productDocs = await n8nClient.fetchTable(
      'Product Documents',
      false,
      undefined,
      15000
    );

    if (!productDocs?.length) {
      console.log('No Product Documents records found.');
      return;
    }

    const uniqueProductIds = [
      ...new Set(
        productDocs.map((r: any) => (r['Product ID'] || r.productId || '').toString().trim()).filter(Boolean)
      ),
    ];

    console.log('Product Documents (GET) summary');
    console.log('==============================');
    console.log('Total rows:', productDocs.length);
    console.log('Unique Product IDs:', uniqueProductIds.length);
    console.log('');

    if (uniqueProductIds.length > 0) {
      console.log('Products with documents:');
      for (const pid of uniqueProductIds.slice(0, 20)) {
        const count = productDocs.filter(
          (r: any) => (r['Product ID'] || r.productId || '').toString().trim() === pid
        ).length;
        console.log(`  ${pid}: ${count} document(s)`);
      }
      if (uniqueProductIds.length > 20) {
        console.log(`  ... and ${uniqueProductIds.length - 20} more products`);
      }
    }
  } catch (error: any) {
    console.error('Failed to fetch Product Documents:', error?.message || error);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
