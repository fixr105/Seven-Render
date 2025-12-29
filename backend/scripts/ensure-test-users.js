/**
 * Startup script to ensure test users exist in Airtable
 * 
 * This script checks if test users exist and creates them if missing.
 * Run this before starting the server to ensure test users are available.
 * 
 * Usage:
 *   node scripts/ensure-test-users.js
 * 
 * Or set AUTO_CREATE_TEST_USERS=true in .env to run automatically on startup
 */

import fetch from 'node-fetch';
import { n8nClient } from '../src/services/airtable/n8nClient.js';

const N8N_ADD_USER_URL = process.env.N8N_POST_ADD_USER_URL || 'https://fixrrahul.app.n8n.cloud/webhook/adduser';
const N8N_POST_CLIENT_URL = process.env.N8N_POST_CLIENT_URL || 'https://fixrrahul.app.n8n.cloud/webhook/Client';

// Test users that should exist
const requiredTestUsers = [
  {
    email: 'client@test.com',
    password: 'Test@123',
    role: 'client',
    name: 'Test Client',
  },
  {
    email: 'kam@test.com',
    password: 'Test@123',
    role: 'kam',
    name: 'Test KAM',
  },
  {
    email: 'credit@test.com',
    password: 'Test@123',
    role: 'credit_team',
    name: 'Test Credit',
  },
  {
    email: 'nbfc@test.com',
    password: 'Test@123',
    role: 'nbfc',
    name: 'Test NBFC',
  },
];

/**
 * Check if a user exists in Airtable
 */
async function userExists(email) {
  try {
    const userAccounts = await n8nClient.getUserAccounts();
    return userAccounts.some(
      (u) => u.Username && u.Username.toLowerCase() === email.toLowerCase()
    );
  } catch (error) {
    console.error(`Error checking if user exists: ${error.message}`);
    return false;
  }
}

/**
 * Create a user account in Airtable via n8n webhook
 */
async function createUserAccount(user) {
  const userId = `USER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const userAccountData = {
    id: userId,
    Username: user.email,
    Password: user.password, // Plaintext - backend handles hashing if needed
    Role: user.role,
    'Associated Profile': user.name,
    'Last Login': '',
    'Account Status': 'Active',
  };

  console.log(`  Creating user account: ${user.email}...`);
  
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
      console.log(`  ✅ Created user account: ${user.email}`);
      return userId;
    } else {
      console.error(`  ❌ Failed to create user account: ${user.email}`, result);
      return null;
    }
  } catch (error) {
    console.error(`  ❌ Error creating user account: ${user.email}`, error.message);
    return null;
  }
}

/**
 * Create client profile for client users
 */
async function createClientProfile(userId, user) {
  if (user.role !== 'client') return;

  const clientData = {
    id: userId,
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

  console.log(`  Creating client profile: ${user.email}...`);
  
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
      console.log(`  ✅ Created client profile: ${user.email}`);
    } else {
      console.error(`  ❌ Failed to create client profile: ${user.email}`, result);
    }
  } catch (error) {
    console.error(`  ❌ Error creating client profile: ${user.email}`, error.message);
  }
}

/**
 * Main function to ensure all test users exist
 */
async function ensureTestUsers() {
  console.log('🔍 Checking for test users...\n');

  let createdCount = 0;
  let existingCount = 0;

  for (const user of requiredTestUsers) {
    const exists = await userExists(user.email);
    
    if (exists) {
      console.log(`✅ User already exists: ${user.email}`);
      existingCount++;
    } else {
      console.log(`⚠️  User missing: ${user.email}`);
      const userId = await createUserAccount(user);
      
      if (userId && user.role === 'client') {
        await createClientProfile(userId, user);
      }
      
      if (userId) {
        createdCount++;
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log('\n📊 Summary:');
  console.log(`  ✅ Existing users: ${existingCount}`);
  console.log(`  🆕 Created users: ${createdCount}`);
  console.log(`  📝 Total required: ${requiredTestUsers.length}`);

  if (createdCount > 0) {
    console.log('\n✅ Test users are now ready!');
    console.log('\nYou can login with:');
    requiredTestUsers.forEach(user => {
      console.log(`  ${user.email} / ${user.password} (${user.role})`);
    });
  } else if (existingCount === requiredTestUsers.length) {
    console.log('\n✅ All test users already exist!');
  } else {
    console.log('\n⚠️  Some users could not be created. Check n8n webhook configuration.');
  }
}

// Run if called directly
// Check if this is the main module (not imported)
const isMainModule = process.argv[1] && process.argv[1].includes('ensure-test-users.js');

if (isMainModule) {
  ensureTestUsers().catch((error) => {
    console.error('❌ Error ensuring test users:', error);
    process.exit(1);
  });
}

export { ensureTestUsers };

