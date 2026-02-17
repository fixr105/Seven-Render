#!/usr/bin/env tsx
/**
 * Debug: Check if a client (by email) has form config for a given product.
 * Usage: npx tsx scripts/debug-client-form-for-email.ts [email] [productId]
 * Example: npx tsx scripts/debug-client-form-for-email.ts anyaaa@gmail.com LP011
 */

import 'dotenv/config';
import { n8nClient } from '../src/services/airtable/n8nClient.js';

const email = (process.argv[2] || 'anyaaa@gmail.com').trim().toLowerCase();
const productId = (process.argv[3] || 'LP011').trim();

async function main() {
  try {
    const [clients, mappings, products] = await Promise.all([
      n8nClient.fetchTable('Clients', false, undefined, 15000),
      n8nClient.fetchTable('Client Form Mapping', false, undefined, 15000),
      n8nClient.fetchTable('Loan Products', false, undefined, 15000),
    ]);

    const product = products.find(
      (p: any) =>
        (p['Product ID'] || p.productId || '').toString().trim() === productId
    );
    const productName = product?.['Product Name'] || product?.productName || productId;

    const matchingClients = clients.filter((c: any) => {
      const contact = (c['Contact Email / Phone'] || c.contactEmailPhone || '').toString().toLowerCase();
      return contact && contact.includes(email);
    });

    if (matchingClients.length === 0) {
      console.log(`\nNo Clients record found with Contact Email/Phone containing: ${email}`);
      console.log('The user must have their email in the Clients table "Contact Email / Phone" field.');
      return;
    }

    console.log(`\nClients matching "${email}":`);
    for (const c of matchingClients) {
      const cid = c['Client ID'] || c.clientId || c.id;
      const name = c['Client Name'] || c.clientName || 'Unknown';
      console.log(`  - ${name} | Client ID: ${cid} | Record ID: ${c.id}`);
    }

    const clientIds = new Set<string>();
    matchingClients.forEach((c: any) => {
      clientIds.add(String(c['Client ID'] || c.clientId || c.id).trim());
      clientIds.add(String(c.id).trim());
    });

    const lp011Mappings = mappings.filter((m: any) => {
      const mClient = (m.Client || m['Client ID'] || '').toString().trim();
      const mProduct = (m['Product ID'] || m.productId || '').toString().trim();
      return mProduct === productId && mClient && clientIds.has(mClient);
    });

    console.log(`\n${productName} (${productId}) mappings for these clients: ${lp011Mappings.length}`);
    if (lp011Mappings.length > 0) {
      console.table(
        lp011Mappings.slice(0, 10).map((m: any) => ({
          Client: m.Client || m['Client ID'],
          'Product ID': m['Product ID'] || m.productId,
          Category: (m.Category || '').slice(0, 30) + '…',
        }))
      );
      if (lp011Mappings.length > 10) {
        console.log(`  ... and ${lp011Mappings.length - 10} more`);
      }
      console.log('\nForm config should load. If it does not, check:');
      console.log('  1. Backend getFormConfig receives productId in query');
      console.log('  2. User JWT has clientId matching one of the Client IDs above');
    } else {
      console.log('\nNo form mappings found. The KAM must configure the form for this client + product in Form Configuration.');
    }
  } catch (error: any) {
    console.error('Error:', error?.message || error);
    process.exit(1);
  }
}

main();
