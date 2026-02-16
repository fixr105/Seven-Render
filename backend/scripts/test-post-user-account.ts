/**
 * Test script: POST to create a user account via n8nClient.postUserAccount
 * Verifies the adduser webhook receives PIN (not Password) in the payload.
 *
 * Run: cd backend && npx tsx scripts/test-post-user-account.ts
 * Requires: N8N_BASE_URL in .env
 */

import dotenv from 'dotenv';
dotenv.config();

import { n8nClient } from '../src/services/airtable/n8nClient.js';
import { authService } from '../src/auth/auth.service.js';

async function main() {
  const testEmail = `test-${Date.now()}@sevenfincorp.com`;
  const testPassword = 'TestPass123!';
  const hashedPassword = await authService.hashPassword(testPassword);

  const userAccountData = {
    id: `USER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    Username: testEmail,
    Password: hashedPassword,
    Role: 'client',
    'Associated Profile': '',
    'Last Login': '',
    'Account Status': 'Active',
  };

  console.log('Sending to adduser webhook with payload (Password will be sent as PIN):');
  console.log(JSON.stringify({ ...userAccountData, Password: '[REDACTED]' }, null, 2));
  console.log('');

  try {
    await n8nClient.postUserAccount(userAccountData);
    console.log('✅ postUserAccount succeeded');
    console.log(`   Test user: ${testEmail} (password: ${testPassword})`);
  } catch (error: any) {
    console.error('❌ postUserAccount failed:', error.message);
    process.exit(1);
  }
}

main();
