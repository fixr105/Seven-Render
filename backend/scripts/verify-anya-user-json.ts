#!/usr/bin/env tsx
/**
 * Fetch actual JSON for anyaaa@gmail.com from User Accounts and Clients.
 * Run: cd backend && npx tsx scripts/verify-anya-user-json.ts
 */

import 'dotenv/config';
import { n8nClient } from '../src/services/airtable/n8nClient.js';

const EMAIL = 'anyaaa@gmail.com';

async function main() {
  console.log(`\nFetching actual data for ${EMAIL}...\n`);

  try {
    const [userAccounts, clients] = await Promise.all([
      n8nClient.getUserAccounts(15000),
      n8nClient.fetchTable('Clients', false, undefined, 15000),
    ]);

    const user = userAccounts.find(
      (u) => (u.Username || '').trim().toLowerCase() === EMAIL.toLowerCase()
    );

    const matchingClients = clients.filter((c: any) => {
      const contact = (c['Contact Email / Phone'] || c.contactEmailPhone || '').toString().toLowerCase();
      return contact && contact.includes(EMAIL.toLowerCase());
    });

    console.log('=== User Accounts record (raw JSON) ===');
    if (user) {
      console.log(JSON.stringify(user, null, 2));
      console.log('\n--- Key fields ---');
      console.log('  Username:', user.Username);
      console.log('  Role:', user.Role, '(type:', typeof user.Role, ')');
      console.log('  Account Status:', user['Account Status']);
    } else {
      console.log('NOT FOUND');
    }

    console.log('\n=== Clients records matching email ===');
    if (matchingClients.length > 0) {
      matchingClients.forEach((c: any, i) => {
        console.log(`\n--- Client ${i + 1} ---`);
        console.log(JSON.stringify(c, null, 2));
      });
    } else {
      console.log('NONE');
    }

    console.log('\n=== Summary ===');
    console.log('  User Account found:', !!user);
    console.log('  User Role:', user?.Role ?? 'N/A');
    console.log('  Clients with matching email:', matchingClients.length);
  } catch (err: any) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
