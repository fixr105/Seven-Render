/**
 * Script to create production users in Airtable via n8n webhooks
 * Creates user accounts and corresponding profile records (KAM Users or Credit Team Users)
 * 
 * Usage: node backend/scripts/create-production-users.js
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const N8N_BASE_URL = process.env.N8N_BASE_URL || 'https://fixrrahul.app.n8n.cloud';

// Webhook URLs
const N8N_ADD_USER_URL = `${N8N_BASE_URL}/webhook/adduser`;
const N8N_POST_KAM_USERS_URL = `${N8N_BASE_URL}/webhook/KAMusers`;
const N8N_POST_CREDIT_TEAM_USERS_URL = `${N8N_BASE_URL}/webhook/CREDITTEAMUSERS`;
const N8N_GET_USER_ACCOUNT_URL = `${N8N_BASE_URL}/webhook/useraccount`;
const N8N_GET_KAM_USERS_URL = `${N8N_BASE_URL}/webhook/kamusers`;
const N8N_GET_CREDIT_TEAM_USER_URL = `${N8N_BASE_URL}/webhook/creditteamuser`;

// Users to create
const users = [
  { username: "Sagar", password: "pass@123", role: "kam", associatedProfile: "Sagar", status: "Active" },
  { username: "Jaishali", password: "pass@123", role: "kam", associatedProfile: "Jaishali", status: "Active" },
  { username: "Archi", password: "pass@123", role: "kam", associatedProfile: "Archi", status: "Active" },
  { username: "Basavaraj", password: "pass@123", role: "credit_team", associatedProfile: "Basavaraj", status: "Active" },
  { username: "Rahul", password: "pass@123", role: "credit_team", associatedProfile: "Rahul", status: "Active" }
];

/**
 * Create a user account in User Accounts table
 */
async function createUserAccount(user) {
  const userId = `USER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const userAccountData = {
    id: userId,
    Username: user.username,
    Password: user.password, // Plaintext - n8n/Airtable will handle hashing if needed
    Role: user.role,
    'Associated Profile': user.associatedProfile,
    'Last Login': '',
    'Account Status': user.status,
    // Email and Phone left blank as requested
    Email: '',
    Phone: '',
  };

  console.log(`\n📝 Creating user account: ${user.username} (${user.role})...`);
  console.log(`   Request body:`, JSON.stringify(userAccountData, null, 2));
  
  try {
    const response = await fetch(N8N_ADD_USER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userAccountData),
    });

    const result = await response.json();
    
    console.log(`   Response status: ${response.status} ${response.statusText}`);
    console.log(`   Response body:`, JSON.stringify(result, null, 2));
    
    if (response.ok) {
      console.log(`   ✅ Created user account: ${user.username}`);
      return { success: true, userId, result };
    } else {
      console.error(`   ❌ Failed to create user account: ${user.username}`);
      return { success: false, userId: null, error: result };
    }
  } catch (error) {
    console.error(`   ❌ Error creating user account: ${user.username}`, error.message);
    return { success: false, userId: null, error: error.message };
  }
}

/**
 * Create KAM profile record
 */
async function createKAMProfile(userId, user) {
  const kamData = {
    id: userId,
    'KAM ID': userId,
    'Name': user.associatedProfile, // Use associatedProfile as Name
    'Email': user.associatedProfile, // Use associatedProfile as Email (as requested)
    'Phone': '',
    'Managed Clients': '',
    'Role': 'kam',
    'Status': user.status,
  };

  console.log(`\n📝 Creating KAM profile: ${user.associatedProfile}...`);
  console.log(`   Request body:`, JSON.stringify(kamData, null, 2));
  
  try {
    const response = await fetch(N8N_POST_KAM_USERS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(kamData),
    });

    const result = await response.json();
    
    console.log(`   Response status: ${response.status} ${response.statusText}`);
    console.log(`   Response body:`, JSON.stringify(result, null, 2));
    
    if (response.ok) {
      console.log(`   ✅ Created KAM profile: ${user.associatedProfile}`);
      return { success: true, result };
    } else {
      console.error(`   ❌ Failed to create KAM profile: ${user.associatedProfile}`);
      return { success: false, error: result };
    }
  } catch (error) {
    console.error(`   ❌ Error creating KAM profile: ${user.associatedProfile}`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Create Credit Team profile record
 */
async function createCreditTeamProfile(userId, user) {
  const creditData = {
    id: userId,
    'Credit User ID': userId,
    'Name': user.associatedProfile, // Use associatedProfile as Name
    'Email': user.associatedProfile, // Use associatedProfile as Email (as requested)
    'Phone': '',
    'Role': 'credit_team',
    'Status': user.status,
  };

  console.log(`\n📝 Creating Credit Team profile: ${user.associatedProfile}...`);
  console.log(`   Request body:`, JSON.stringify(creditData, null, 2));
  
  try {
    const response = await fetch(N8N_POST_CREDIT_TEAM_USERS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(creditData),
    });

    const result = await response.json();
    
    console.log(`   Response status: ${response.status} ${response.statusText}`);
    console.log(`   Response body:`, JSON.stringify(result, null, 2));
    
    if (response.ok) {
      console.log(`   ✅ Created Credit Team profile: ${user.associatedProfile}`);
      return { success: true, result };
    } else {
      console.error(`   ❌ Failed to create Credit Team profile: ${user.associatedProfile}`);
      return { success: false, error: result };
    }
  } catch (error) {
    console.error(`   ❌ Error creating Credit Team profile: ${user.associatedProfile}`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Verify user account exists
 */
async function verifyUserAccount(username) {
  console.log(`\n🔍 Verifying user account: ${username}...`);
  
  try {
    const response = await fetch(N8N_GET_USER_ACCOUNT_URL);
    const result = await response.json();
    
    if (response.ok && Array.isArray(result)) {
      const user = result.find(u => {
        const usernameField = u.Username || u.username || u['Username'];
        return usernameField === username;
      });
      
      if (user) {
        console.log(`   ✅ Found user account: ${username}`);
        console.log(`   Role: ${user.Role || user.role || user['Role']}`);
        console.log(`   Status: ${user['Account Status'] || user.accountStatus || user['Account Status']}`);
        return { found: true, user };
      } else {
        console.log(`   ⚠️  User account not found: ${username}`);
        return { found: false };
      }
    } else {
      console.error(`   ❌ Failed to fetch user accounts`);
      return { found: false, error: result };
    }
  } catch (error) {
    console.error(`   ❌ Error verifying user account: ${username}`, error.message);
    return { found: false, error: error.message };
  }
}

/**
 * Verify KAM profile exists
 */
async function verifyKAMProfile(name) {
  console.log(`\n🔍 Verifying KAM profile: ${name}...`);
  
  try {
    const response = await fetch(N8N_GET_KAM_USERS_URL);
    const result = await response.json();
    
    if (response.ok && Array.isArray(result)) {
      const profile = result.find(p => {
        const nameField = p.Name || p.name || p['Name'];
        return nameField === name;
      });
      
      if (profile) {
        console.log(`   ✅ Found KAM profile: ${name}`);
        console.log(`   Role: ${profile.Role || profile.role || profile['Role']}`);
        console.log(`   Status: ${profile.Status || profile.status || profile['Status']}`);
        return { found: true, profile };
      } else {
        console.log(`   ⚠️  KAM profile not found: ${name}`);
        return { found: false };
      }
    } else {
      console.error(`   ❌ Failed to fetch KAM users`);
      return { found: false, error: result };
    }
  } catch (error) {
    console.error(`   ❌ Error verifying KAM profile: ${name}`, error.message);
    return { found: false, error: error.message };
  }
}

/**
 * Verify Credit Team profile exists
 */
async function verifyCreditTeamProfile(name) {
  console.log(`\n🔍 Verifying Credit Team profile: ${name}...`);
  
  try {
    const response = await fetch(N8N_GET_CREDIT_TEAM_USER_URL);
    const result = await response.json();
    
    if (response.ok && Array.isArray(result)) {
      const profile = result.find(p => {
        const nameField = p.Name || p.name || p['Name'];
        return nameField === name;
      });
      
      if (profile) {
        console.log(`   ✅ Found Credit Team profile: ${name}`);
        console.log(`   Role: ${profile.Role || profile.role || profile['Role']}`);
        console.log(`   Status: ${profile.Status || profile.status || profile['Status']}`);
        return { found: true, profile };
      } else {
        console.log(`   ⚠️  Credit Team profile not found: ${name}`);
        return { found: false };
      }
    } else {
      console.error(`   ❌ Failed to fetch Credit Team users`);
      return { found: false, error: result };
    }
  } catch (error) {
    console.error(`   ❌ Error verifying Credit Team profile: ${name}`, error.message);
    return { found: false, error: error.message };
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log('🚀 Starting production user creation script...\n');
  console.log(`📡 Using n8n base URL: ${N8N_BASE_URL}\n`);
  console.log(`📋 Users to create: ${users.length}\n`);
  
  const results = {
    successful: [],
    failed: [],
  };

  // Step 1: Create user accounts and profiles
  for (const user of users) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Processing: ${user.username} (${user.role})`);
    console.log(`${'='.repeat(60)}`);
    
    // Create user account
    const accountResult = await createUserAccount(user);
    
    if (!accountResult.success) {
      results.failed.push({
        username: user.username,
        role: user.role,
        step: 'user_account',
        error: accountResult.error,
      });
      continue;
    }
    
    // Create profile based on role
    let profileResult;
    if (user.role === 'kam') {
      profileResult = await createKAMProfile(accountResult.userId, user);
    } else if (user.role === 'credit_team') {
      profileResult = await createCreditTeamProfile(accountResult.userId, user);
    }
    
    if (!profileResult || !profileResult.success) {
      results.failed.push({
        username: user.username,
        role: user.role,
        step: 'profile',
        error: profileResult?.error || 'Unknown error',
      });
      continue;
    }
    
    results.successful.push({
      username: user.username,
      role: user.role,
      userId: accountResult.userId,
    });
    
    // Small delay between users to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Step 2: Verify all creations
  console.log(`\n\n${'='.repeat(60)}`);
  console.log('VERIFICATION PHASE');
  console.log(`${'='.repeat(60)}\n`);
  
  const verificationResults = {
    verified: [],
    notFound: [],
  };

  for (const user of users) {
    // Verify user account
    const accountVerification = await verifyUserAccount(user.username);
    
    // Verify profile
    let profileVerification;
    if (user.role === 'kam') {
      profileVerification = await verifyKAMProfile(user.associatedProfile);
    } else if (user.role === 'credit_team') {
      profileVerification = await verifyCreditTeamProfile(user.associatedProfile);
    }
    
    if (accountVerification.found && profileVerification?.found) {
      verificationResults.verified.push({
        username: user.username,
        role: user.role,
      });
    } else {
      verificationResults.notFound.push({
        username: user.username,
        role: user.role,
        accountFound: accountVerification.found,
        profileFound: profileVerification?.found,
      });
    }
    
    // Small delay between verifications
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Step 3: Print summary
  console.log(`\n\n${'='.repeat(60)}`);
  console.log('SUMMARY');
  console.log(`${'='.repeat(60)}\n`);
  
  console.log(`✅ Successfully created: ${results.successful.length} users`);
  results.successful.forEach(r => {
    console.log(`   - ${r.username} (${r.role})`);
  });
  
  if (results.failed.length > 0) {
    console.log(`\n❌ Failed to create: ${results.failed.length} users`);
    results.failed.forEach(r => {
      console.log(`   - ${r.username} (${r.role}) - Failed at: ${r.step}`);
      console.log(`     Error: ${JSON.stringify(r.error)}`);
    });
  }
  
  console.log(`\n🔍 Verification Results:`);
  console.log(`   ✅ Verified: ${verificationResults.verified.length} users`);
  verificationResults.verified.forEach(r => {
    console.log(`      - ${r.username} (${r.role})`);
  });
  
  if (verificationResults.notFound.length > 0) {
    console.log(`   ⚠️  Not found: ${verificationResults.notFound.length} users`);
    verificationResults.notFound.forEach(r => {
      console.log(`      - ${r.username} (${r.role})`);
      console.log(`        Account found: ${r.accountFound}, Profile found: ${r.profileFound}`);
    });
  }
  
  console.log(`\n${'='.repeat(60)}\n`);
  
  // Exit with appropriate code
  if (results.failed.length > 0 || verificationResults.notFound.length > 0) {
    console.log('⚠️  Some operations failed or could not be verified. Please check the logs above.');
    process.exit(1);
  } else {
    console.log('✅ All users created and verified successfully!');
    process.exit(0);
  }
}

// Run the script
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});

