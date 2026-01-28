/**
 * List all users in User Accounts table
 */

import { n8nClient } from '../src/services/airtable/n8nClient.js';

async function listAllUsers() {
  console.log('🔍 Fetching all User Accounts...\n');
  
  try {
    const users = await n8nClient.fetchTable('User Accounts', false, undefined, 10000);
    
    console.log(`Found ${users.length} user account(s):\n`);
    console.log('='.repeat(80));
    
    users.forEach((u: any, index: number) => {
      const email = (u.Username || u['Username'] || 'N/A').trim();
      const role = (u.Role || u['Role'] || 'N/A').trim();
      const status = (u['Account Status'] || u.AccountStatus || 'N/A').trim();
      const profile = (u['Associated Profile'] || u.AssociatedProfile || 'N/A').trim();
      const userId = u.id || 'N/A';
      
      const isActive = status.toLowerCase() === 'active';
      const statusIcon = isActive ? '✅' : '❌';
      
      console.log(`${index + 1}. ${statusIcon} ${email}`);
      console.log(`   Role: ${role}`);
      console.log(`   Status: ${status}`);
      console.log(`   Profile: ${profile}`);
      console.log(`   User ID: ${userId}`);
      console.log('');
    });
    
    console.log('='.repeat(80));
    console.log(`\nSummary:`);
    console.log(`  Total: ${users.length}`);
    console.log(`  Active: ${users.filter((u: any) => (u['Account Status'] || '').toLowerCase() === 'active').length}`);
    console.log(`  Inactive: ${users.filter((u: any) => (u['Account Status'] || '').toLowerCase() === 'inactive').length}`);
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

listAllUsers().catch(console.error);
