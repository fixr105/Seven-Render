/**
 * Fix password for test@rxil.com using backend's n8nClient.postUserAccount.
 * Uses same flow as reset-password (PIN field, cache invalidation).
 *
 * Run: cd backend && npx tsx scripts/fix-test-rxil-password.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import { n8nClient } from '../src/services/airtable/n8nClient.js';
import { authService } from '../src/auth/auth.service.js';

const EMAIL = process.env.NBFC_EMAIL || 'test@rxil.com';
const PASSWORD = process.env.NBFC_PASSWORD || 'pass@123';

async function main() {
  console.log('Fixing password for', EMAIL, '...\n');

  const accounts = await n8nClient.getUserAccounts(10000);
  const user = accounts.find(
    (u) => (u.Username || '').trim().toLowerCase() === EMAIL.toLowerCase()
  );

  if (!user) {
    console.error('User not found:', EMAIL);
    process.exit(1);
  }

  const hashedPassword = await authService.hashPassword(PASSWORD);

  await n8nClient.postUserAccount({
    id: user.id,
    Username: EMAIL.toLowerCase(),
    Password: hashedPassword,
    Role: user.Role || 'nbfc',
    'Associated Profile': user['Associated Profile'] || 'RXIL',
    'Account Status': user['Account Status'] || 'Active',
    'Last Login': user['Last Login'] || '',
  });

  console.log('Password updated via postUserAccount (PIN field).');
  console.log('Login:', EMAIL, '/', PASSWORD);
  console.log('\nBackend cache cleared. Try logging in.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
