function requiredN8nOrigin(name) {
  const raw = String(process.env[name] || '').trim().replace(/\/+$/, '').replace(/\/webhook$/i, '');
  if (!raw) {
    console.error(name + ' is required. Refusing to fall back to the old n8n host.');
    process.exit(1);
  }
  return raw;
}

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

const N8N_ADD_USER_URL = process.env.N8N_POST_ADD_USER_URL || `${requiredN8nOrigin('N8N_LMS_BASE_URL')}/webhook/adduser`;
const N8N_POST_CLIENT_URL = process.env.N8N_POST_CLIENT_URL || `${requiredN8nOrigin('N8N_LMS_BASE_URL')}/webhook/Client`;
const N8N_POST_KAM_USERS_URL = process.env.N8N_POST_KAM_USERS_URL || `${requiredN8nOrigin('N8N_LMS_BASE_URL')}/webhook/KAMusers`;
const N8N_POST_CREDIT_TEAM_USERS_URL = process.env.N8N_POST_CREDIT_TEAM_USERS_URL || `${requiredN8nOrigin('N8N_LMS_BASE_URL')}/webhook/CREDITTEAMUSERS`;
const N8N_POST_NBFC_PARTNERS_URL = process.env.N8N_POST_NBFC_PARTNERS_URL || `${requiredN8nOrigin('N8N_LEGACY_BASE_URL')}/webhook/NBFCPartners`;

// Use environment variables for test users - NEVER hardcode credentials
// WARNING: This script should ONLY be used in development/test environments
const requiredTestUsers = [
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
 * Create profile record for user based on role
 */
async function createProfileRecord(userId, user) {
  if (user.role === 'client') {
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
  } else if (user.role === 'kam') {
    const kamData = {
      id: userId,
      'KAM ID': userId,
      'Name': user.name,
      'Email': user.email,
      'Phone': '',
      'Managed Clients': '',
      'Role': 'kam',
      'Status': 'Active',
    };

    console.log(`  Creating KAM profile: ${user.email}...`);
    
    try {
      const response = await fetch(N8N_POST_KAM_USERS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(kamData),
      });

      const result = await response.json();
      
      if (response.ok) {
        console.log(`  ✅ Created KAM profile: ${user.email}`);
      } else {
        console.error(`  ❌ Failed to create KAM profile: ${user.email}`, result);
      }
    } catch (error) {
      console.error(`  ❌ Error creating KAM profile: ${user.email}`, error.message);
    }
  } else if (user.role === 'credit_team') {
    const creditData = {
      id: userId,
      'Credit User ID': userId,
      'Name': user.name,
      'Email': user.email,
      'Phone': '',
      'Role': 'credit_team',
      'Status': 'Active',
    };

    console.log(`  Creating Credit Team profile: ${user.email}...`);
    
    try {
      const response = await fetch(N8N_POST_CREDIT_TEAM_USERS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(creditData),
      });

      const result = await response.json();
      
      if (response.ok) {
        console.log(`  ✅ Created Credit Team profile: ${user.email}`);
      } else {
        console.error(`  ❌ Failed to create Credit Team profile: ${user.email}`, result);
      }
    } catch (error) {
      console.error(`  ❌ Error creating Credit Team profile: ${user.email}`, error.message);
    }
  } else if (user.role === 'nbfc') {
    const nbfcData = {
      id: userId,
      'Lender ID': userId,
      'Lender Name': user.name,
      'Contact Person': user.name,
      'Contact Email/Phone': user.email,
      'Address/Region': '',
      'Active': 'True',
    };

    console.log(`  Creating NBFC profile: ${user.email}...`);
    
    try {
      const response = await fetch(N8N_POST_NBFC_PARTNERS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(nbfcData),
      });

      const result = await response.json();
      
      if (response.ok) {
        console.log(`  ✅ Created NBFC profile: ${user.email}`);
      } else {
        console.error(`  ❌ Failed to create NBFC profile: ${user.email}`, result);
      }
    } catch (error) {
      console.error(`  ❌ Error creating NBFC profile: ${user.email}`, error.message);
    }
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
      
      if (userId) {
        await createProfileRecord(userId, user);
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

