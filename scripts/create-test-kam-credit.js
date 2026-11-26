function requiredN8nOrigin(name) {
  const raw = String(process.env[name] || '').trim().replace(/\/+$/, '').replace(/\/webhook$/i, '');
  if (!raw) {
    console.error(name + ' is required. Refusing to fall back to the old n8n host.');
    process.exit(1);
  }
  return raw;
}

/**
 * Script to create a KAM user and Credit Team user in the database
 * Run this to set up test users for client onboarding testing
 */

import fetch from 'node-fetch';

// Webhook URLs
const KAM_USERS_WEBHOOK = `${requiredN8nOrigin('N8N_LMS_BASE_URL')}/webhook/KAMusers`;
const CREDIT_TEAM_USERS_WEBHOOK = `${requiredN8nOrigin('N8N_LMS_BASE_URL')}/webhook/CREDITTEAMUSERS`;
const USER_ACCOUNTS_WEBHOOK = `${requiredN8nOrigin('N8N_LMS_BASE_URL')}/webhook/adduser`;

// KAM User Data
const kamUserData = {
  id: `KAM-${Date.now()}`,
  'KAM ID': `KAM-${Date.now()}`,
  'Name': 'Test KAM Manager',
  'Email': 'testkam@test.com',
  'Phone': '+91 9876543210',
  'Managed Clients': '',
  'Role': 'kam',
  'Status': 'Active',
};

// Credit Team User Data
const creditUserData = {
  id: `CREDIT-${Date.now()}`,
  'Credit Team User ID': `CREDIT-${Date.now()}`,
  'Name': 'Test Credit Analyst',
  'Email': 'testcredit@test.com',
  'Phone': '+91 9876543211',
  'Role': 'credit_team',
  'Status': 'Active',
  'Department': 'Credit Analysis',
};

// User Account for KAM - using proper bcrypt hash for "password123"
const kamUserAccount = {
  id: `USER-KAM-${Date.now()}`,
  'Username': 'testkam@test.com',
  'Password': '$2a$10$AGx/v0wib026HtsXOQtr.uHMyfhu0bG8cYi2XYcxkdYlIpY74QtgO', // Hashed password for "password123"
  'Role': 'kam',
  'Associated Profile': 'Test KAM Manager',
  'Account Status': 'Active',
  'Last Login': '',
};

// User Account for Credit Team - using proper bcrypt hash for "password123"
const creditUserAccount = {
  id: `USER-CREDIT-${Date.now()}`,
  'Username': 'testcredit@test.com',
  'Password': '$2a$10$AGx/v0wib026HtsXOQtr.uHMyfhu0bG8cYi2XYcxkdYlIpY74QtgO', // Hashed password for "password123"
  'Role': 'credit_team',
  'Associated Profile': 'Test Credit Analyst',
  'Account Status': 'Active',
  'Last Login': '',
};

async function createUser(type, data, webhookUrl) {
  console.log(`\n📤 Creating ${type}...`);
  console.log(`Webhook: ${webhookUrl}`);
  console.log(`Data:`, JSON.stringify(data, null, 2));
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const result = await response.text();
    
    if (response.ok || response.status === 200) {
      console.log(`✅ Successfully created ${type}`);
      return { success: true, data: result };
    } else {
      console.error(`❌ Failed to create ${type}:`, result);
      return { success: false, error: result };
    }
  } catch (error) {
    console.error(`❌ Error creating ${type}:`, error.message);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🚀 Creating Test KAM and Credit Team Users...\n');
  console.log('='.repeat(60));

  // Create KAM User
  const kamResult = await createUser('KAM User', kamUserData, KAM_USERS_WEBHOOK);
  await new Promise(resolve => setTimeout(resolve, 500));

  // Create KAM User Account
  const kamAccountResult = await createUser('KAM User Account', kamUserAccount, USER_ACCOUNTS_WEBHOOK);
  await new Promise(resolve => setTimeout(resolve, 500));

  // Create Credit Team User
  const creditResult = await createUser('Credit Team User', creditUserData, CREDIT_TEAM_USERS_WEBHOOK);
  await new Promise(resolve => setTimeout(resolve, 500));

  // Create Credit Team User Account
  const creditAccountResult = await createUser('Credit Team User Account', creditUserAccount, USER_ACCOUNTS_WEBHOOK);

  console.log('\n' + '='.repeat(60));
  console.log('📋 Summary:');
  console.log('='.repeat(60));
  
  if (kamResult.success) {
    console.log(`✅ KAM User Created:`);
    console.log(`   - ID: ${kamUserData['KAM ID']}`);
    console.log(`   - Name: ${kamUserData.Name}`);
    console.log(`   - Email: ${kamUserData.Email}`);
  } else {
    console.log(`❌ KAM User Creation Failed: ${kamResult.error}`);
  }

  if (kamAccountResult.success) {
    console.log(`✅ KAM User Account Created`);
    console.log(`   - Username: ${kamUserAccount.Username}`);
    console.log(`   - Password: password123`);
  } else {
    console.log(`❌ KAM User Account Creation Failed: ${kamAccountResult.error}`);
  }

  if (creditResult.success) {
    console.log(`✅ Credit Team User Created:`);
    console.log(`   - ID: ${creditUserData['Credit Team User ID']}`);
    console.log(`   - Name: ${creditUserData.Name}`);
    console.log(`   - Email: ${creditUserData.Email}`);
  } else {
    console.log(`❌ Credit Team User Creation Failed: ${creditResult.error}`);
  }

  if (creditAccountResult.success) {
    console.log(`✅ Credit Team User Account Created`);
    console.log(`   - Username: ${creditAccountResult.Username || creditUserAccount.Username}`);
    console.log(`   - Password: password123`);
  } else {
    console.log(`❌ Credit Team User Account Creation Failed: ${creditAccountResult.error}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('💡 Test Credentials:');
  console.log('='.repeat(60));
  console.log('KAM User:');
  console.log(`  Email: ${kamUserData.Email}`);
  console.log(`  Password: password123`);
  console.log(`  KAM ID: ${kamUserData['KAM ID']}`);
  console.log('');
  console.log('Credit Team User:');
  console.log(`  Email: ${creditUserData.Email}`);
  console.log(`  Password: password123`);
  console.log(`  Credit Team User ID: ${creditUserData['Credit Team User ID']}`);
  console.log('');
  console.log('📝 Next Steps:');
  console.log('  1. Login with KAM credentials: testkam@test.com / password123');
  console.log('  2. Onboard a new client');
  console.log('  3. Check that the client\'s "Assigned KAM" field is set to the KAM ID');
  console.log('  4. Try to configure forms for that client');
  console.log('='.repeat(60));
}

main().catch(console.error);

