/**
 * Script to verify production users were created correctly in Airtable
 * Fetches all users and profiles via GET endpoints and verifies data integrity
 * 
 * Usage: node backend/scripts/verify-production-users.js
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const N8N_BASE_URL = process.env.N8N_BASE_URL || 'https://fixrrahul.app.n8n.cloud';

// Webhook URLs
const N8N_GET_USER_ACCOUNT_URL = `${N8N_BASE_URL}/webhook/useraccount`;
const N8N_GET_KAM_USERS_URL = `${N8N_BASE_URL}/webhook/kamusers`;
const N8N_GET_CREDIT_TEAM_USER_URL = `${N8N_BASE_URL}/webhook/creditteamuser`;

// Expected users
const expectedUsers = [
  { username: "Sagar", role: "kam", associatedProfile: "Sagar", status: "Active" },
  { username: "Jaishali", role: "kam", associatedProfile: "Jaishali", status: "Active" },
  { username: "Archi", role: "kam", associatedProfile: "Archi", status: "Active" },
  { username: "Basavaraj", role: "credit_team", associatedProfile: "Basavaraj", status: "Active" },
  { username: "Rahul", role: "credit_team", associatedProfile: "Rahul", status: "Active" }
];

/**
 * Helper to get field value from record (handles different formats)
 */
function getField(record, fieldName) {
  if (record.fields && record.fields[fieldName] !== undefined) {
    return record.fields[fieldName];
  }
  if (record[fieldName] !== undefined) {
    return record[fieldName];
  }
  // Try case variations
  const lowerField = fieldName.toLowerCase();
  for (const key in record) {
    if (key.toLowerCase() === lowerField) {
      return record[key];
    }
  }
  if (record.fields) {
    for (const key in record.fields) {
      if (key.toLowerCase() === lowerField) {
        return record.fields[key];
      }
    }
  }
  return null;
}

/**
 * Fetch all user accounts
 */
async function fetchUserAccounts() {
  console.log('\n📥 Fetching user accounts...');
  try {
    const response = await fetch(N8N_GET_USER_ACCOUNT_URL);
    const result = await response.json();
    
    if (response.ok) {
      const records = Array.isArray(result) ? result : (result.records || [result] || []);
      console.log(`   ✅ Fetched ${records.length} user accounts`);
      return records;
    } else {
      console.error(`   ❌ Failed to fetch user accounts: ${response.status} ${response.statusText}`);
      console.error(`   Response:`, JSON.stringify(result, null, 2));
      return [];
    }
  } catch (error) {
    console.error(`   ❌ Error fetching user accounts:`, error.message);
    return [];
  }
}

/**
 * Fetch all KAM users
 */
async function fetchKAMUsers() {
  console.log('\n📥 Fetching KAM users...');
  try {
    const response = await fetch(N8N_GET_KAM_USERS_URL);
    const result = await response.json();
    
    if (response.ok) {
      const records = Array.isArray(result) ? result : (result.records || [result] || []);
      console.log(`   ✅ Fetched ${records.length} KAM users`);
      return records;
    } else {
      console.error(`   ❌ Failed to fetch KAM users: ${response.status} ${response.statusText}`);
      console.error(`   Response:`, JSON.stringify(result, null, 2));
      return [];
    }
  } catch (error) {
    console.error(`   ❌ Error fetching KAM users:`, error.message);
    return [];
  }
}

/**
 * Fetch all Credit Team users
 */
async function fetchCreditTeamUsers() {
  console.log('\n📥 Fetching Credit Team users...');
  try {
    const response = await fetch(N8N_GET_CREDIT_TEAM_USER_URL);
    const result = await response.json();
    
    if (response.ok) {
      const records = Array.isArray(result) ? result : (result.records || [result] || []);
      console.log(`   ✅ Fetched ${records.length} Credit Team users`);
      return records;
    } else {
      console.error(`   ❌ Failed to fetch Credit Team users: ${response.status} ${response.statusText}`);
      console.error(`   Response:`, JSON.stringify(result, null, 2));
      return [];
    }
  } catch (error) {
    console.error(`   ❌ Error fetching Credit Team users:`, error.message);
    return [];
  }
}

/**
 * Verify user account data
 */
function verifyUserAccount(userAccount, expectedUser) {
  const username = getField(userAccount, 'Username');
  const role = getField(userAccount, 'Role');
  const associatedProfile = getField(userAccount, 'Associated Profile');
  const accountStatus = getField(userAccount, 'Account Status');
  const email = getField(userAccount, 'Email');
  const phone = getField(userAccount, 'Phone');
  
  const issues = [];
  
  if (username !== expectedUser.username) {
    issues.push(`Username mismatch: expected "${expectedUser.username}", got "${username}"`);
  }
  
  if (role !== expectedUser.role) {
    issues.push(`Role mismatch: expected "${expectedUser.role}", got "${role}"`);
  }
  
  if (associatedProfile !== expectedUser.associatedProfile) {
    issues.push(`Associated Profile mismatch: expected "${expectedUser.associatedProfile}", got "${associatedProfile}"`);
  }
  
  if (accountStatus !== expectedUser.status) {
    issues.push(`Account Status mismatch: expected "${expectedUser.status}", got "${accountStatus}"`);
  }
  
  // Email and Phone should be blank
  if (email && email.trim() !== '') {
    issues.push(`Email should be blank, but got "${email}"`);
  }
  
  if (phone && phone.trim() !== '') {
    issues.push(`Phone should be blank, but got "${phone}"`);
  }
  
  return {
    valid: issues.length === 0,
    issues,
    data: {
      username,
      role,
      associatedProfile,
      accountStatus,
      email,
      phone,
    }
  };
}

/**
 * Verify KAM profile data
 */
function verifyKAMProfile(profile, expectedUser) {
  const name = getField(profile, 'Name');
  const email = getField(profile, 'Email');
  const role = getField(profile, 'Role');
  const status = getField(profile, 'Status');
  
  const issues = [];
  
  if (name !== expectedUser.associatedProfile) {
    issues.push(`Name mismatch: expected "${expectedUser.associatedProfile}", got "${name}"`);
  }
  
  if (email !== expectedUser.associatedProfile) {
    issues.push(`Email mismatch: expected "${expectedUser.associatedProfile}", got "${email}"`);
  }
  
  if (role !== 'kam') {
    issues.push(`Role mismatch: expected "kam", got "${role}"`);
  }
  
  if (status !== expectedUser.status) {
    issues.push(`Status mismatch: expected "${expectedUser.status}", got "${status}"`);
  }
  
  return {
    valid: issues.length === 0,
    issues,
    data: {
      name,
      email,
      role,
      status,
    }
  };
}

/**
 * Verify Credit Team profile data
 */
function verifyCreditTeamProfile(profile, expectedUser) {
  const name = getField(profile, 'Name');
  const email = getField(profile, 'Email');
  const role = getField(profile, 'Role');
  const status = getField(profile, 'Status');
  
  const issues = [];
  
  if (name !== expectedUser.associatedProfile) {
    issues.push(`Name mismatch: expected "${expectedUser.associatedProfile}", got "${name}"`);
  }
  
  if (email !== expectedUser.associatedProfile) {
    issues.push(`Email mismatch: expected "${expectedUser.associatedProfile}", got "${email}"`);
  }
  
  if (role !== 'credit_team' && role !== 'Credit') {
    issues.push(`Role mismatch: expected "credit_team" or "Credit", got "${role}"`);
  }
  
  if (status !== expectedUser.status) {
    issues.push(`Status mismatch: expected "${expectedUser.status}", got "${status}"`);
  }
  
  return {
    valid: issues.length === 0,
    issues,
    data: {
      name,
      email,
      role,
      status,
    }
  };
}

/**
 * Main verification function
 */
async function main() {
  console.log('🔍 Starting production user verification...\n');
  console.log(`📡 Using n8n base URL: ${N8N_BASE_URL}\n`);
  
  // Fetch all data
  const userAccounts = await fetchUserAccounts();
  const kamUsers = await fetchKAMUsers();
  const creditTeamUsers = await fetchCreditTeamUsers();
  
  console.log(`\n${'='.repeat(60)}`);
  console.log('VERIFICATION RESULTS');
  console.log(`${'='.repeat(60)}\n`);
  
  const verificationResults = {
    passed: [],
    failed: [],
    missing: [],
  };
  
  // Verify each expected user
  for (const expectedUser of expectedUsers) {
    console.log(`\n${'-'.repeat(60)}`);
    console.log(`Verifying: ${expectedUser.username} (${expectedUser.role})`);
    console.log(`${'-'.repeat(60)}`);
    
    // Find user account
    const userAccount = userAccounts.find(ua => {
      const username = getField(ua, 'Username');
      return username === expectedUser.username;
    });
    
    if (!userAccount) {
      console.log(`   ❌ User account NOT FOUND: ${expectedUser.username}`);
      verificationResults.missing.push({
        username: expectedUser.username,
        role: expectedUser.role,
        missing: 'user_account',
      });
      continue;
    }
    
    // Verify user account
    const accountVerification = verifyUserAccount(userAccount, expectedUser);
    console.log(`\n   📋 User Account Verification:`);
    console.log(`      Username: ${accountVerification.data.username}`);
    console.log(`      Role: ${accountVerification.data.role}`);
    console.log(`      Associated Profile: ${accountVerification.data.associatedProfile}`);
    console.log(`      Account Status: ${accountVerification.data.accountStatus}`);
    console.log(`      Email: ${accountVerification.data.email || '(blank)'}`);
    console.log(`      Phone: ${accountVerification.data.phone || '(blank)'}`);
    
    if (accountVerification.valid) {
      console.log(`      ✅ User account data is correct`);
    } else {
      console.log(`      ❌ User account data has issues:`);
      accountVerification.issues.forEach(issue => {
        console.log(`         - ${issue}`);
      });
    }
    
    // Find and verify profile
    let profileVerification = null;
    if (expectedUser.role === 'kam') {
      // Find active profile (filter out disabled records)
      const profile = kamUsers.find(p => {
        const name = getField(p, 'Name');
        const status = getField(p, 'Status');
        return name === expectedUser.associatedProfile && status === 'Active';
      });
      
      if (!profile) {
        console.log(`\n   ❌ KAM profile NOT FOUND: ${expectedUser.associatedProfile}`);
        verificationResults.missing.push({
          username: expectedUser.username,
          role: expectedUser.role,
          missing: 'kam_profile',
        });
        continue;
      }
      
      profileVerification = verifyKAMProfile(profile, expectedUser);
      console.log(`\n   📋 KAM Profile Verification:`);
      console.log(`      Name: ${profileVerification.data.name}`);
      console.log(`      Email: ${profileVerification.data.email}`);
      console.log(`      Role: ${profileVerification.data.role}`);
      console.log(`      Status: ${profileVerification.data.status}`);
      
      if (profileVerification.valid) {
        console.log(`      ✅ KAM profile data is correct`);
      } else {
        console.log(`      ❌ KAM profile data has issues:`);
        profileVerification.issues.forEach(issue => {
          console.log(`         - ${issue}`);
        });
      }
    } else if (expectedUser.role === 'credit_team') {
      // Find active profile (filter out disabled records)
      const profile = creditTeamUsers.find(p => {
        const name = getField(p, 'Name');
        const status = getField(p, 'Status');
        return name === expectedUser.associatedProfile && status === 'Active';
      });
      
      if (!profile) {
        console.log(`\n   ❌ Credit Team profile NOT FOUND: ${expectedUser.associatedProfile}`);
        verificationResults.missing.push({
          username: expectedUser.username,
          role: expectedUser.role,
          missing: 'credit_team_profile',
        });
        continue;
      }
      
      profileVerification = verifyCreditTeamProfile(profile, expectedUser);
      console.log(`\n   📋 Credit Team Profile Verification:`);
      console.log(`      Name: ${profileVerification.data.name}`);
      console.log(`      Email: ${profileVerification.data.email}`);
      console.log(`      Role: ${profileVerification.data.role}`);
      console.log(`      Status: ${profileVerification.data.status}`);
      
      if (profileVerification.valid) {
        console.log(`      ✅ Credit Team profile data is correct`);
      } else {
        console.log(`      ❌ Credit Team profile data has issues:`);
        profileVerification.issues.forEach(issue => {
          console.log(`         - ${issue}`);
        });
      }
    }
    
    // Overall result for this user
    if (accountVerification.valid && profileVerification && profileVerification.valid) {
      console.log(`\n   ✅ ${expectedUser.username}: ALL CHECKS PASSED`);
      verificationResults.passed.push({
        username: expectedUser.username,
        role: expectedUser.role,
      });
    } else {
      console.log(`\n   ❌ ${expectedUser.username}: VERIFICATION FAILED`);
      verificationResults.failed.push({
        username: expectedUser.username,
        role: expectedUser.role,
        accountIssues: accountVerification.issues,
        profileIssues: profileVerification?.issues || [],
      });
    }
  }
  
  // Summary
  console.log(`\n\n${'='.repeat(60)}`);
  console.log('VERIFICATION SUMMARY');
  console.log(`${'='.repeat(60)}\n`);
  
  console.log(`✅ Passed: ${verificationResults.passed.length} users`);
  verificationResults.passed.forEach(r => {
    console.log(`   - ${r.username} (${r.role})`);
  });
  
  if (verificationResults.failed.length > 0) {
    console.log(`\n❌ Failed: ${verificationResults.failed.length} users`);
    verificationResults.failed.forEach(r => {
      console.log(`   - ${r.username} (${r.role})`);
      if (r.accountIssues.length > 0) {
        console.log(`     Account issues: ${r.accountIssues.join('; ')}`);
      }
      if (r.profileIssues.length > 0) {
        console.log(`     Profile issues: ${r.profileIssues.join('; ')}`);
      }
    });
  }
  
  if (verificationResults.missing.length > 0) {
    console.log(`\n⚠️  Missing: ${verificationResults.missing.length} records`);
    verificationResults.missing.forEach(r => {
      console.log(`   - ${r.username} (${r.role}): Missing ${r.missing}`);
    });
  }
  
  console.log(`\n${'='.repeat(60)}\n`);
  
  // Exit code
  if (verificationResults.failed.length > 0 || verificationResults.missing.length > 0) {
    console.log('⚠️  Some verifications failed. Please review the details above.');
    process.exit(1);
  } else {
    console.log('✅ All verifications passed! All data is correct.');
    process.exit(0);
  }
}

// Run the script
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});

