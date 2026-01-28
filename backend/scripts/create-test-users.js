/**
 * Script to create test users in Airtable via n8n webhooks
 * 
 * WARNING: This script should ONLY be used in development/test environments.
 * Test users should NEVER be created in production.
 * 
 * To use this script, set environment variables:
 * - E2E_CLIENT_USERNAME (default: client@test.local)
 * - E2E_CLIENT_PASSWORD (default: test123)
 * - E2E_KAM_USERNAME (default: kam@test.local)
 * - E2E_KAM_PASSWORD (default: test123)
 * - E2E_CREDIT_USERNAME (default: credit@test.local)
 * - E2E_CREDIT_PASSWORD (default: test123)
 * - E2E_NBFC_USERNAME (default: nbfc@test.local)
 * - E2E_NBFC_PASSWORD (default: test123)
 */

import fetch from 'node-fetch';

const N8N_ADD_USER_URL = process.env.N8N_POST_ADD_USER_URL || 'https://fixrrahul.app.n8n.cloud/webhook/adduser';
const N8N_POST_CLIENT_URL = process.env.N8N_POST_CLIENT_URL || 'https://fixrrahul.app.n8n.cloud/webhook/Client';

// Use environment variables for test users - NEVER hardcode credentials
const testUsers = [
  { 
    email: process.env.E2E_CLIENT_USERNAME || 'client@test.local', 
    password: process.env.E2E_CLIENT_PASSWORD || 'test123', 
    role: 'client', 
    name: 'Test Client' 
  },
  { 
    email: process.env.E2E_KAM_USERNAME || 'kam@test.local', 
    password: process.env.E2E_KAM_PASSWORD || 'test123', 
    role: 'kam', 
    name: 'Test KAM' 
  },
  { 
    email: process.env.E2E_CREDIT_USERNAME || 'credit@test.local', 
    password: process.env.E2E_CREDIT_PASSWORD || 'test123', 
    role: 'credit_team', 
    name: 'Test Credit' 
  },
  { 
    email: process.env.E2E_NBFC_USERNAME || 'nbfc@test.local', 
    password: process.env.E2E_NBFC_PASSWORD || 'test123', 
    role: 'nbfc', 
    name: 'Test NBFC' 
  },
];

async function createUserAccount(user) {
  const userId = `USER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const userAccountData = {
    id: userId,
    Username: user.email,
    Password: user.password, // Plaintext - backend will handle hashing if needed
    Role: user.role,
    'Associated Profile': user.name,
    'Last Login': '',
    'Account Status': 'Active',
  };

  console.log(`Creating user account: ${user.email}...`);
  
  try {
    const response = await fetch(N8N_ADD_USER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userAccountData),
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log(`✅ Created user account: ${user.email}`);
      return userId;
    } else {
      console.error(`❌ Failed to create user account: ${user.email}`, result);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error creating user account: ${user.email}`, error.message);
    return null;
  }
}

async function createClientProfile(userId, user) {
  if (user.role !== 'client') return;

  const clientData = {
    id: userId, // Link to user account
    'Client ID': userId,
    'Client Name': user.name,
    'Primary Contact Name': user.name,
    'Contact Email / Phone': user.email,
    'Assigned KAM': '',
    'Enabled Modules': '',
    'Commission Rate': '1.5',
    'Status': 'Active',
    'Form Categories': '',
  };

  console.log(`Creating client profile: ${user.email}...`);
  
  try {
    const response = await fetch(N8N_POST_CLIENT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(clientData),
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log(`✅ Created client profile: ${user.email}`);
    } else {
      console.error(`❌ Failed to create client profile: ${user.email}`, result);
    }
  } catch (error) {
    console.error(`❌ Error creating client profile: ${user.email}`, error.message);
  }
}

async function main() {
  console.log('🚀 Creating test users...\n');

  for (const user of testUsers) {
    const userId = await createUserAccount(user);
    
    if (userId && user.role === 'client') {
      await createClientProfile(userId, user);
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n✅ Test user creation complete!');
  console.log('\n⚠️  WARNING: These are test users. Do NOT use in production!');
  console.log('\nTest user credentials (from environment variables):');
  testUsers.forEach(user => {
    console.log(`  ${user.email} / ${user.password} (${user.role})`);
  });
  console.log('\nTo use different credentials, set environment variables:');
  console.log('  E2E_CLIENT_USERNAME, E2E_CLIENT_PASSWORD');
  console.log('  E2E_KAM_USERNAME, E2E_KAM_PASSWORD');
  console.log('  E2E_CREDIT_USERNAME, E2E_CREDIT_PASSWORD');
  console.log('  E2E_NBFC_USERNAME, E2E_NBFC_PASSWORD');
}

main().catch(console.error);

