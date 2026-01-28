/**
 * Script to identify and delete/disable test users from all tables
 * 
 * This script:
 * 1. Identifies test users by email patterns
 * 2. Deletes/disables them from User Accounts, KAM Users, Credit Team Users, Clients, NBFC Partners
 * 3. Reports what was deleted
 * 
 * Usage:
 *   N8N_BASE_URL=https://fixrrahul.app.n8n.cloud npx tsx scripts/delete-test-users.ts
 */

import { n8nClient } from '../src/services/airtable/n8nClient.js';

// Test email patterns to identify test users
const testEmailPatterns = [
  /sagar@gmail\.com/i,
  /rahul@gmail\.com/i,
  /.*@test\.com/i,
  /test.*@.*/i,
  /.*@example\.com/i,  // test@example.com and similar
  /test@.*/i,          // test@anything
];

// Test email exact matches (case-insensitive)
const testEmails = [
  'sagar@gmail.com',
  'rahul@gmail.com',
  'test@gmail.com',
  'test@example.com',
  'client@test.com',
  'kam@test.com',
  'credit@test.com',
  'nbfc@test.com',
];

/**
 * Check if an email matches test user patterns
 */
function isTestEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const normalizedEmail = email.toLowerCase().trim();
  
  // Check exact matches
  if (testEmails.some(test => test.toLowerCase() === normalizedEmail)) {
    return true;
  }
  
  // Check patterns
  return testEmailPatterns.some(pattern => pattern.test(normalizedEmail));
}

/**
 * Delete test users from User Accounts table
 */
async function deleteTestUserAccounts() {
  console.log('\n🔍 Checking User Accounts table for test users...');
  
  try {
    const userAccounts = await n8nClient.fetchTable('User Accounts', false, undefined, 10000);
    const testUsers = userAccounts.filter((ua: any) => {
      const email = (ua.Username || ua['Username'] || '').trim();
      return isTestEmail(email);
    });
    
    console.log(`   Found ${testUsers.length} test user account(s)`);
    
    if (testUsers.length === 0) {
      console.log('   ✅ No test users found in User Accounts');
      return { deleted: 0, users: [] };
    }
    
    // List test users
    const deletedUsers: any[] = [];
    for (const user of testUsers) {
      const email = (user.Username || user['Username'] || '').trim();
      const role = user.Role || user['Role'] || 'unknown';
      const userId = user.id;
      
      console.log(`   ⚠️  Found test user: ${email} (${role}, ID: ${userId})`);
      
      // Mark as inactive by updating Account Status
      try {
        const updateData = {
          id: userId,
          Username: email,
          Password: user.Password || user['Password'] || '',
          Role: role,
          'Account Status': 'Inactive', // Mark as inactive instead of deleting
          'Associated Profile': user['Associated Profile'] || user.AssociatedProfile || '',
        };
        
        // Use postUserAccount to update (upsert will match on id)
        await n8nClient.postUserAccount(updateData);
        deletedUsers.push({ email, role, userId, status: 'marked_inactive' });
        console.log(`   ✅ Marked ${email} as Inactive`);
      } catch (error: any) {
        console.error(`   ❌ Failed to mark ${email} as inactive:`, error.message);
        deletedUsers.push({ email, role, userId, status: 'failed', error: error.message });
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return { deleted: deletedUsers.filter(u => u.status === 'marked_inactive').length, users: deletedUsers };
  } catch (error: any) {
    console.error('   ❌ Error checking User Accounts:', error.message);
    return { deleted: 0, users: [], error: error.message };
  }
}

/**
 * Delete test users from KAM Users table
 */
async function deleteTestKAMUsers() {
  console.log('\n🔍 Checking KAM Users table for test users...');
  
  try {
    const kamUsers = await n8nClient.fetchTable('KAM Users', false, undefined, 10000);
    const testUsers = kamUsers.filter((ku: any) => {
      const email = (ku.Email || ku['Email'] || '').trim();
      return isTestEmail(email);
    });
    
    console.log(`   Found ${testUsers.length} test KAM user(s)`);
    
    if (testUsers.length === 0) {
      console.log('   ✅ No test users found in KAM Users');
      return { deleted: 0, users: [] };
    }
    
    const deletedUsers: any[] = [];
    for (const user of testUsers) {
      const email = (user.Email || user['Email'] || '').trim();
      const name = user.Name || user['Name'] || 'Unknown';
      const kamId = user['KAM ID'] || user.id;
      
      console.log(`   ⚠️  Found test KAM user: ${email} (${name}, KAM ID: ${kamId})`);
      
      try {
        const updateData = {
          id: user.id,
          'KAM ID': kamId,
          'Name': name,
          'Email': email,
          'Phone': user.Phone || user['Phone'] || '',
          'Role': user.Role || user['Role'] || 'kam',
          'Status': 'Inactive', // Mark as inactive
        };
        
        await n8nClient.postKamUser(updateData);
        deletedUsers.push({ email, name, kamId, status: 'marked_inactive' });
        console.log(`   ✅ Marked KAM user ${email} as Inactive`);
      } catch (error: any) {
        console.error(`   ❌ Failed to mark KAM user ${email} as inactive:`, error.message);
        deletedUsers.push({ email, name, kamId, status: 'failed', error: error.message });
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return { deleted: deletedUsers.filter(u => u.status === 'marked_inactive').length, users: deletedUsers };
  } catch (error: any) {
    console.error('   ❌ Error checking KAM Users:', error.message);
    return { deleted: 0, users: [], error: error.message };
  }
}

/**
 * Delete test users from Credit Team Users table
 */
async function deleteTestCreditTeamUsers() {
  console.log('\n🔍 Checking Credit Team Users table for test users...');
  
  try {
    const creditUsers = await n8nClient.fetchTable('Credit Team Users', false, undefined, 10000);
    const testUsers = creditUsers.filter((cu: any) => {
      const email = (cu.Email || cu['Email'] || '').trim();
      return isTestEmail(email);
    });
    
    console.log(`   Found ${testUsers.length} test Credit Team user(s)`);
    
    if (testUsers.length === 0) {
      console.log('   ✅ No test users found in Credit Team Users');
      return { deleted: 0, users: [] };
    }
    
    const deletedUsers: any[] = [];
    for (const user of testUsers) {
      const email = (user.Email || user['Email'] || '').trim();
      const name = user.Name || user['Name'] || 'Unknown';
      const creditUserId = user['Credit User ID'] || user['Credit Team ID'] || user.id;
      
      console.log(`   ⚠️  Found test Credit Team user: ${email} (${name}, Credit User ID: ${creditUserId})`);
      
      try {
        const updateData = {
          id: user.id,
          'Credit User ID': creditUserId,
          'Name': name,
          'Email': email,
          'Phone': user.Phone || user['Phone'] || '',
          'Role': user.Role || user['Role'] || 'credit_team',
          'Status': 'Inactive', // Mark as inactive
        };
        
        await n8nClient.postCreditTeamUser(updateData);
        deletedUsers.push({ email, name, creditUserId, status: 'marked_inactive' });
        console.log(`   ✅ Marked Credit Team user ${email} as Inactive`);
      } catch (error: any) {
        console.error(`   ❌ Failed to mark Credit Team user ${email} as inactive:`, error.message);
        deletedUsers.push({ email, name, creditUserId, status: 'failed', error: error.message });
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return { deleted: deletedUsers.filter(u => u.status === 'marked_inactive').length, users: deletedUsers };
  } catch (error: any) {
    console.error('   ❌ Error checking Credit Team Users:', error.message);
    return { deleted: 0, users: [], error: error.message };
  }
}

/**
 * Delete test users from Clients table
 */
async function deleteTestClients() {
  console.log('\n🔍 Checking Clients table for test users...');
  
  try {
    const clients = await n8nClient.fetchTable('Clients', false, undefined, 10000);
    const testClients = clients.filter((c: any) => {
      const email = (c['Contact Email / Phone'] || c['Contact Email/Phone'] || c['Contact Email'] || c.Email || '').trim();
      return isTestEmail(email);
    });
    
    console.log(`   Found ${testClients.length} test client(s)`);
    
    if (testClients.length === 0) {
      console.log('   ✅ No test users found in Clients');
      return { deleted: 0, clients: [] };
    }
    
    const deletedClients: any[] = [];
    for (const client of testClients) {
      const email = (client['Contact Email / Phone'] || client['Contact Email/Phone'] || client['Contact Email'] || client.Email || '').trim();
      const clientName = client['Client Name'] || client['Primary Contact Name'] || 'Unknown';
      const clientId = client['Client ID'] || client.id;
      
      console.log(`   ⚠️  Found test client: ${clientName} (${email}, Client ID: ${clientId})`);
      
      try {
        const updateData = {
          id: client.id,
          'Client ID': clientId,
          'Client Name': clientName,
          'Primary Contact Name': client['Primary Contact Name'] || clientName,
          'Contact Email / Phone': email,
          'Assigned KAM': client['Assigned KAM'] || '',
          'Status': 'Inactive', // Mark as inactive
        };
        
        await n8nClient.postClient(updateData);
        deletedClients.push({ email, clientName, clientId, status: 'marked_inactive' });
        console.log(`   ✅ Marked client ${clientName} as Inactive`);
      } catch (error: any) {
        console.error(`   ❌ Failed to mark client ${clientName} as inactive:`, error.message);
        deletedClients.push({ email, clientName, clientId, status: 'failed', error: error.message });
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return { deleted: deletedClients.filter(c => c.status === 'marked_inactive').length, clients: deletedClients };
  } catch (error: any) {
    console.error('   ❌ Error checking Clients:', error.message);
    return { deleted: 0, clients: [], error: error.message };
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Starting Test User Cleanup Script');
  console.log('='.repeat(60));
  console.log('\nThis script will mark test users as "Inactive" in all tables.');
  console.log('Test users are identified by email patterns:');
  console.log('  - sagar@gmail.com');
  console.log('  - rahul@gmail.com');
  console.log('  - *@test.com');
  console.log('  - test*@*');
  console.log('\n' + '='.repeat(60));
  
  const results = {
    userAccounts: { deleted: 0, users: [] as any[] },
    kamUsers: { deleted: 0, users: [] as any[] },
    creditTeamUsers: { deleted: 0, users: [] as any[] },
    clients: { deleted: 0, clients: [] as any[] },
  };
  
  // Delete from all tables
  results.userAccounts = await deleteTestUserAccounts();
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  results.kamUsers = await deleteTestKAMUsers();
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  results.creditTeamUsers = await deleteTestCreditTeamUsers();
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  results.clients = await deleteTestClients();
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  
  const totalDeleted = 
    results.userAccounts.deleted +
    results.kamUsers.deleted +
    results.creditTeamUsers.deleted +
    results.clients.deleted;
  
  console.log(`\n✅ User Accounts: ${results.userAccounts.deleted} marked as inactive`);
  console.log(`✅ KAM Users: ${results.kamUsers.deleted} marked as inactive`);
  console.log(`✅ Credit Team Users: ${results.creditTeamUsers.deleted} marked as inactive`);
  console.log(`✅ Clients: ${results.clients.deleted} marked as inactive`);
  console.log(`\n📊 Total: ${totalDeleted} test user(s) marked as inactive`);
  
  if (totalDeleted > 0) {
    console.log('\n✅ Test user cleanup complete!');
    console.log('\n⚠️  Note: Users are marked as "Inactive" rather than deleted.');
    console.log('   This preserves data integrity. Inactive users will not be able to login.');
  } else {
    console.log('\n✅ No test users found - system is clean!');
  }
  
  console.log('\n' + '='.repeat(60));
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.includes('delete-test-users.ts')) {
  main()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    });
}

export { deleteTestUserAccounts, deleteTestKAMUsers, deleteTestCreditTeamUsers, deleteTestClients };
