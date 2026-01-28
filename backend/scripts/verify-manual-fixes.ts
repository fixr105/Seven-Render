/**
 * Verification Script: Manual Fixes from MANUAL_FIXES_REQUIRED.md
 * 
 * This script verifies that all manual fixes have been successfully applied:
 * 1. KAM Users Email Field - No "Sagar" (non-email) values
 * 2. Credit Team Users Email Field - No "Rahul" (non-email) values
 * 3. User Accounts Matching - Username matches Email from role-specific tables
 * 4. Clients Assigned to KAM - All clients assigned to KAM Sagar
 * 5. Notifications Webhook - Already verified (working)
 * 
 * Usage:
 *   node scripts/verify-manual-fixes.js
 */

import { n8nClient } from '../src/services/airtable/n8nClient.js';

/**
 * Helper: Validate email format
 * Email must contain @ and ., and must not be "Sagar" or "Rahul"
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }
  const emailLower = email.toLowerCase().trim();
  return email.includes('@') && 
         email.includes('.') && 
         emailLower !== 'sagar' && 
         emailLower !== 'rahul';
}

/**
 * Check 1: Verify KAM Users Email Field
 * - All emails must be valid (contain @ and .)
 * - No "Sagar" found in Email fields
 */
async function verifyKAMUsersEmail() {
  console.log('\n🔍 Check 1: KAM Users Email Field');
  console.log('─'.repeat(60));
  
  try {
    const kamUsers = await n8nClient.fetchTable('KAM Users', false, undefined, 10000);
    console.log(`   Found ${kamUsers.length} KAM user(s)`);
    
    const invalidEmails = [];
    const sagarEmails = [];
    
    for (const kamUser of kamUsers) {
      const email = kamUser.Email || kamUser['Email'] || '';
      const name = kamUser.Name || kamUser['Name'] || 'Unknown';
      const kamId = kamUser['KAM ID'] || kamUser.id || 'Unknown';
      
      if (!isValidEmail(email)) {
        if (email.toLowerCase().trim() === 'sagar') {
          sagarEmails.push({ name, email, kamId });
        } else {
          invalidEmails.push({ name, email, kamId });
        }
      }
    }
    
    if (sagarEmails.length > 0) {
      console.log(`   ❌ Found ${sagarEmails.length} record(s) with "Sagar" in Email field:`);
      sagarEmails.forEach(({ name, email, kamId }) => {
        console.log(`      - ${name} (KAM ID: ${kamId}): Email = "${email}"`);
      });
      return { passed: false, invalidCount: sagarEmails.length, invalidEmails: sagarEmails };
    }
    
    if (invalidEmails.length > 0) {
      console.log(`   ⚠️  Found ${invalidEmails.length} record(s) with invalid email format:`);
      invalidEmails.forEach(({ name, email, kamId }) => {
        console.log(`      - ${name} (KAM ID: ${kamId}): Email = "${email}"`);
      });
      return { passed: false, invalidCount: invalidEmails.length, invalidEmails };
    }
    
    console.log(`   ✅ All ${kamUsers.length} KAM user emails are valid`);
    console.log(`   ✅ No "Sagar" found in Email fields`);
    return { passed: true, total: kamUsers.length, invalidCount: 0 };
    
  } catch (error) {
    console.log(`   ❌ Error fetching KAM Users: ${error.message}`);
    return { passed: false, error: error.message };
  }
}

/**
 * Check 2: Verify Credit Team Users Email Field
 * - All emails must be valid (contain @ and .)
 * - No "Rahul" found in Email fields
 */
async function verifyCreditTeamUsersEmail() {
  console.log('\n🔍 Check 2: Credit Team Users Email Field');
  console.log('─'.repeat(60));
  
  try {
    const creditUsers = await n8nClient.fetchTable('Credit Team Users', false, undefined, 10000);
    console.log(`   Found ${creditUsers.length} Credit Team user(s)`);
    
    const invalidEmails = [];
    const rahulEmails = [];
    
    for (const creditUser of creditUsers) {
      const email = creditUser.Email || creditUser['Email'] || '';
      const name = creditUser.Name || creditUser['Name'] || 'Unknown';
      const creditUserId = creditUser['Credit User ID'] || creditUser['Credit Team ID'] || creditUser.id || 'Unknown';
      
      if (!isValidEmail(email)) {
        if (email.toLowerCase().trim() === 'rahul') {
          rahulEmails.push({ name, email, creditUserId });
        } else {
          invalidEmails.push({ name, email, creditUserId });
        }
      }
    }
    
    if (rahulEmails.length > 0) {
      console.log(`   ❌ Found ${rahulEmails.length} record(s) with "Rahul" in Email field:`);
      rahulEmails.forEach(({ name, email, creditUserId }) => {
        console.log(`      - ${name} (Credit User ID: ${creditUserId}): Email = "${email}"`);
      });
      return { passed: false, invalidCount: rahulEmails.length, invalidEmails: rahulEmails };
    }
    
    if (invalidEmails.length > 0) {
      console.log(`   ⚠️  Found ${invalidEmails.length} record(s) with invalid email format:`);
      invalidEmails.forEach(({ name, email, creditUserId }) => {
        console.log(`      - ${name} (Credit User ID: ${creditUserId}): Email = "${email}"`);
      });
      return { passed: false, invalidCount: invalidEmails.length, invalidEmails };
    }
    
    console.log(`   ✅ All ${creditUsers.length} Credit Team user emails are valid`);
    console.log(`   ✅ No "Rahul" found in Email fields`);
    return { passed: true, total: creditUsers.length, invalidCount: 0 };
    
  } catch (error) {
    console.log(`   ❌ Error fetching Credit Team Users: ${error.message}`);
    return { passed: false, error: error.message };
  }
}

/**
 * Check 3: Verify User Accounts Email Matching
 * - For KAM users: User Accounts["Username"] must match KAM Users["Email"] (case-insensitive)
 * - For Credit Team users: User Accounts["Username"] must match Credit Team Users["Email"] (case-insensitive)
 */
async function verifyUserAccountsMatching() {
  console.log('\n🔍 Check 3: User Accounts Email Matching');
  console.log('─'.repeat(60));
  
  try {
    const userAccounts = await n8nClient.fetchTable('User Accounts', false, undefined, 10000);
    const kamUsers = await n8nClient.fetchTable('KAM Users', false, undefined, 10000);
    const creditUsers = await n8nClient.fetchTable('Credit Team Users', false, undefined, 10000);
    
    console.log(`   Found ${userAccounts.length} user account(s)`);
    console.log(`   Found ${kamUsers.length} KAM user(s)`);
    console.log(`   Found ${creditUsers.length} Credit Team user(s)`);
    
    const kamMismatches = [];
    const creditMismatches = [];
    let kamMatched = 0;
    let creditMatched = 0;
    
    // Check KAM users
    const kamUserAccounts = userAccounts.filter(ua => {
      const role = (ua.Role || ua['Role'] || '').toLowerCase();
      return role === 'kam' || role === 'k.a.m';
    });
    
    console.log(`\n   Checking ${kamUserAccounts.length} KAM user account(s)...`);
    for (const userAccount of kamUserAccounts) {
      const username = (userAccount.Username || userAccount['Username'] || '').toLowerCase().trim();
      if (!username) continue;
      
      const matchingKamUser = kamUsers.find(ku => {
        const email = (ku.Email || ku['Email'] || '').toLowerCase().trim();
        return email === username;
      });
      
      if (matchingKamUser) {
        kamMatched++;
      } else {
        const kamUser = kamUsers.find(ku => {
          const email = (ku.Email || ku['Email'] || '').toLowerCase().trim();
          return email.includes(username) || username.includes(email);
        });
        kamMismatches.push({
          username: userAccount.Username || userAccount['Username'],
          role: userAccount.Role || userAccount['Role'],
          expectedEmail: kamUser ? (kamUser.Email || kamUser['Email']) : 'Not found in KAM Users',
        });
      }
    }
    
    // Check Credit Team users
    const creditUserAccounts = userAccounts.filter(ua => {
      const role = (ua.Role || ua['Role'] || '').toLowerCase();
      return role === 'credit_team' || role === 'credit' || role === 'credit team';
    });
    
    console.log(`   Checking ${creditUserAccounts.length} Credit Team user account(s)...`);
    for (const userAccount of creditUserAccounts) {
      const username = (userAccount.Username || userAccount['Username'] || '').toLowerCase().trim();
      if (!username) continue;
      
      const matchingCreditUser = creditUsers.find(cu => {
        const email = (cu.Email || cu['Email'] || '').toLowerCase().trim();
        return email === username;
      });
      
      if (matchingCreditUser) {
        creditMatched++;
      } else {
        const creditUser = creditUsers.find(cu => {
          const email = (cu.Email || cu['Email'] || '').toLowerCase().trim();
          return email.includes(username) || username.includes(email);
        });
        creditMismatches.push({
          username: userAccount.Username || userAccount['Username'],
          role: userAccount.Role || userAccount['Role'],
          expectedEmail: creditUser ? (creditUser.Email || creditUser['Email']) : 'Not found in Credit Team Users',
        });
      }
    }
    
    // Report results
    if (kamMismatches.length > 0) {
      console.log(`\n   ❌ KAM Users: ${kamMatched}/${kamUserAccounts.length} matched`);
      console.log(`   Found ${kamMismatches.length} mismatch(es):`);
      kamMismatches.forEach(({ username, expectedEmail }) => {
        console.log(`      - Username: "${username}" should match Email: "${expectedEmail}"`);
      });
    } else if (kamUserAccounts.length > 0) {
      console.log(`   ✅ KAM Users: ${kamMatched}/${kamUserAccounts.length} matched`);
    }
    
    if (creditMismatches.length > 0) {
      console.log(`\n   ❌ Credit Team Users: ${creditMatched}/${creditUserAccounts.length} matched`);
      console.log(`   Found ${creditMismatches.length} mismatch(es):`);
      creditMismatches.forEach(({ username, expectedEmail }) => {
        console.log(`      - Username: "${username}" should match Email: "${expectedEmail}"`);
      });
    } else if (creditUserAccounts.length > 0) {
      console.log(`   ✅ Credit Team Users: ${creditMatched}/${creditUserAccounts.length} matched`);
    }
    
    const allMatched = kamMismatches.length === 0 && creditMismatches.length === 0;
    return {
      passed: allMatched,
      kamMatched,
      kamTotal: kamUserAccounts.length,
      creditMatched,
      creditTotal: creditUserAccounts.length,
      mismatches: [...kamMismatches, ...creditMismatches],
    };
    
  } catch (error) {
    console.log(`   ❌ Error verifying user accounts matching: ${error.message}`);
    return { passed: false, error: error.message };
  }
}

/**
 * Check 4: Verify Clients Assigned to KAM Sagar
 * - Find KAM Sagar's record (by Name or Email containing "Sagar")
 * - Get KAM Sagar's KAM ID (or record id)
 * - Check all clients have Assigned KAM set to KAM Sagar's ID
 */
async function verifyClientsAssignedToKAM() {
  console.log('\n🔍 Check 4: Clients Assigned to KAM Sagar');
  console.log('─'.repeat(60));
  
  try {
    const clients = await n8nClient.fetchTable('Clients', false, undefined, 10000);
    const kamUsers = await n8nClient.fetchTable('KAM Users', false, undefined, 10000);
    
    console.log(`   Found ${clients.length} client(s)`);
    console.log(`   Found ${kamUsers.length} KAM user(s)`);
    
    // Find KAM Sagar
    const kamSagar = kamUsers.find(ku => {
      const name = (ku.Name || ku['Name'] || '').toLowerCase();
      const email = (ku.Email || ku['Email'] || '').toLowerCase();
      return name.includes('sagar') || email.includes('sagar');
    });
    
    if (!kamSagar) {
      console.log(`   ⚠️  KAM Sagar not found in KAM Users table`);
      console.log(`   Searching for any KAM user with "Sagar" in name or email...`);
      return { passed: false, error: 'KAM Sagar not found' };
    }
    
    const kamSagarId = kamSagar['KAM ID'] || kamSagar.id;
    const kamSagarName = kamSagar.Name || kamSagar['Name'] || 'Unknown';
    const kamSagarEmail = kamSagar.Email || kamSagar['Email'] || 'Unknown';
    
    console.log(`   ✅ Found KAM Sagar:`);
    console.log(`      - Name: ${kamSagarName}`);
    console.log(`      - Email: ${kamSagarEmail}`);
    console.log(`      - KAM ID: ${kamSagarId}`);
    
    // Check clients
    const unassignedClients = [];
    const assignedClients = [];
    
    for (const client of clients) {
      const assignedKAM = client['Assigned KAM'] || client['Assigned KAM ID'] || client['KAM ID'] || '';
      const clientId = client['Client ID'] || client.id || 'Unknown';
      const clientName = client['Client Name'] || client['Primary Contact Name'] || 'Unknown';
      
      // Match by KAM ID or record id
      const isAssigned = assignedKAM === kamSagarId || 
                        assignedKAM === kamSagar.id ||
                        String(assignedKAM) === String(kamSagarId) ||
                        String(assignedKAM) === String(kamSagar.id);
      
      if (isAssigned) {
        assignedClients.push({ clientId, clientName });
      } else {
        unassignedClients.push({ clientId, clientName, assignedKAM });
      }
    }
    
    console.log(`\n   Assignment Status:`);
    console.log(`      - Assigned to KAM Sagar: ${assignedClients.length}/${clients.length}`);
    console.log(`      - Not assigned: ${unassignedClients.length}/${clients.length}`);
    
    if (unassignedClients.length > 0) {
      console.log(`\n   ❌ Found ${unassignedClients.length} client(s) not assigned to KAM Sagar:`);
      unassignedClients.slice(0, 10).forEach(({ clientId, clientName, assignedKAM }) => {
        console.log(`      - ${clientName} (Client ID: ${clientId}): Assigned KAM = "${assignedKAM || 'Empty'}"`);
      });
      if (unassignedClients.length > 10) {
        console.log(`      ... and ${unassignedClients.length - 10} more`);
      }
      return {
        passed: false,
        kamSagarId,
        kamSagarName,
        total: clients.length,
        assigned: assignedClients.length,
        unassigned: unassignedClients.length,
        unassignedClients,
      };
    }
    
    console.log(`   ✅ All ${clients.length} client(s) are assigned to KAM Sagar`);
    return {
      passed: true,
      kamSagarId,
      kamSagarName,
      total: clients.length,
      assigned: assignedClients.length,
    };
    
  } catch (error) {
    console.log(`   ❌ Error verifying clients assignment: ${error.message}`);
    return { passed: false, error: error.message };
  }
}

/**
 * Main verification function
 */
async function verifyAllManualFixes() {
  console.log('🔍 Verifying Manual Fixes from MANUAL_FIXES_REQUIRED.md');
  console.log('='.repeat(60));
  
  const results = {
    check1: null,
    check2: null,
    check3: null,
    check4: null,
  };
  
  // Run all checks
  results.check1 = await verifyKAMUsersEmail();
  await new Promise(resolve => setTimeout(resolve, 500)); // Small delay between requests
  
  results.check2 = await verifyCreditTeamUsersEmail();
  await new Promise(resolve => setTimeout(resolve, 500));
  
  results.check3 = await verifyUserAccountsMatching();
  await new Promise(resolve => setTimeout(resolve, 500));
  
  results.check4 = await verifyClientsAssignedToKAM();
  
  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary Report');
  console.log('='.repeat(60));
  
  const check1Status = results.check1.passed ? '✅' : '❌';
  const check2Status = results.check2.passed ? '✅' : '❌';
  const check3Status = results.check3.passed ? '✅' : '❌';
  const check4Status = results.check4.passed ? '✅' : '❌';
  
  console.log(`\n${check1Status} Check 1: KAM Users Email Field`);
  if (results.check1.passed) {
    console.log(`   All emails are valid (${results.check1.total} users)`);
  } else {
    console.log(`   Found ${results.check1.invalidCount || 0} invalid email(s)`);
  }
  
  console.log(`\n${check2Status} Check 2: Credit Team Users Email Field`);
  if (results.check2.passed) {
    console.log(`   All emails are valid (${results.check2.total} users)`);
  } else {
    console.log(`   Found ${results.check2.invalidCount || 0} invalid email(s)`);
  }
  
  console.log(`\n${check3Status} Check 3: User Accounts Email Matching`);
  if (results.check3.passed) {
    console.log(`   KAM users: ${results.check3.kamMatched}/${results.check3.kamTotal} matched`);
    console.log(`   Credit Team users: ${results.check3.creditMatched}/${results.check3.creditTotal} matched`);
  } else {
    console.log(`   Found ${results.check3.mismatches?.length || 0} mismatch(es)`);
  }
  
  console.log(`\n${check4Status} Check 4: Clients Assigned to KAM Sagar`);
  if (results.check4.passed) {
    console.log(`   All ${results.check4.total} client(s) assigned to ${results.check4.kamSagarName}`);
  } else {
    console.log(`   ${results.check4.unassigned || 0} client(s) not assigned to KAM Sagar`);
  }
  
  // Final verdict
  const allPassed = results.check1.passed && 
                   results.check2.passed && 
                   results.check3.passed && 
                   results.check4.passed;
  
  console.log('\n' + '='.repeat(60));
  if (allPassed) {
    console.log('✅ All manual fixes verified successfully!');
    console.log('\nYou can proceed with testing.');
  } else {
    console.log('⚠️  Some manual fixes are incomplete.');
    console.log('\nPlease review the issues above and complete the manual fixes in Airtable.');
    console.log('See MANUAL_FIXES_REQUIRED.md for detailed instructions.');
  }
  console.log('='.repeat(60));
  
  return allPassed;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.includes('verify-manual-fixes.js')) {
  verifyAllManualFixes()
    .then((allPassed) => {
      process.exit(allPassed ? 0 : 1);
    })
    .catch((error) => {
      console.error('❌ Verification failed:', error);
      process.exit(1);
    });
}

export { verifyAllManualFixes, verifyKAMUsersEmail, verifyCreditTeamUsersEmail, verifyUserAccountsMatching, verifyClientsAssignedToKAM };
