/**
 * Script to sync existing loan applications to Asana
 * 
 * This script:
 * 1. Fetches all loan applications that don't have Asana Task ID
 * 2. Creates Asana tasks for each application
 * 3. Updates loan applications with Asana Task ID and Link
 * 
 * Usage: 
 *   node backend/scripts/sync-loans-to-asana.js [--status=submitted]
 * 
 * Options:
 *   --status=submitted  Only sync applications with status "under_kam_review" or "pending_credit_review"
 *   --status=all        Sync all applications (default)
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const N8N_BASE_URL = process.env.N8N_BASE_URL || 'https://fixrrahul.app.n8n.cloud';
const ASANA_API_BASE = 'https://app.asana.com/api/1.0';
const ASANA_PAT = process.env.ASANA_PAT || '';

// Webhook URLs
const N8N_GET_LOAN_APPLICATION_URL = `${N8N_BASE_URL}/webhook/loanapplication`;
const N8N_POST_LOAN_APPLICATION_URL = `${N8N_BASE_URL}/webhook/loanapplications`;
const N8N_GET_CLIENTS_URL = `${N8N_BASE_URL}/webhook/client`;
const N8N_GET_LOAN_PRODUCTS_URL = `${N8N_BASE_URL}/webhook/loanproducts`;
const N8N_GET_USER_ACCOUNT_URL = `${N8N_BASE_URL}/webhook/useraccount`;

// Loan Product to Asana Project mapping
const LOAN_PRODUCT_TO_ASANA_PROJECT = {
  'Revenue Based Finance for EV': '1211908004694493',
  'HL / LAP': '1211887051020596',
  'Porter': '1211908004694478',
  'Rapido': '1212391754448240',
  'Money Multiplier': '1211908004694490',
  'Numerous': '1211908004853949',
  'LP009': '1211908004694493',
  'LP010': '1211908004694490',
  'LP011': '1211908004694490',
  'LP012': '1211887051020596',
  'LP013': '1211887051020596',
  'LP014': '1211908004694490',
  'LP015': '1211908004853949',
};

/**
 * Helper to get field value from record
 */
function getField(record, fieldName) {
  if (record.fields && record.fields[fieldName] !== undefined) {
    return record.fields[fieldName];
  }
  if (record[fieldName] !== undefined) {
    return record[fieldName];
  }
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
 * Fetch all loan applications
 */
async function fetchLoanApplications() {
  try {
    const response = await fetch(N8N_GET_LOAN_APPLICATION_URL);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch loan applications: ${response.status}`);
    }
    
    const text = await response.text();
    if (!text || text.trim() === '') {
      return [];
    }
    
    let applications;
    try {
      applications = JSON.parse(text);
    } catch (e) {
      return [];
    }
    
    if (!Array.isArray(applications)) {
      if (applications.records && Array.isArray(applications.records)) {
        applications = applications.records;
      } else {
        return [];
      }
    }
    
    return applications;
  } catch (error) {
    console.error('Error fetching loan applications:', error.message);
    return [];
  }
}

/**
 * Get Asana Project ID for loan product
 */
function getAsanaProjectId(loanProductId, loanProductName) {
  if (loanProductName) {
    const projectId = LOAN_PRODUCT_TO_ASANA_PROJECT[loanProductName];
    if (projectId) return projectId;
  }
  return LOAN_PRODUCT_TO_ASANA_PROJECT[loanProductId] || null;
}

/**
 * Format loan amount
 */
function formatLoanAmount(amount) {
  if (!amount) return '₹0';
  const numAmount = typeof amount === 'string' ? parseFloat(amount.replace(/[^\d.-]/g, '')) : amount;
  if (isNaN(numAmount)) return '₹0';
  return `₹${numAmount.toLocaleString('en-IN')}`;
}

/**
 * Create Asana task
 */
async function createAsanaTask(fileId, clientName, loanProductId, loanProductName, loanAmount, submittedBy, clientCode) {
  if (!ASANA_PAT) {
    console.warn('   ⚠️  ASANA_PAT not configured, skipping');
    return null;
  }
  
  const projectId = getAsanaProjectId(loanProductId, loanProductName);
  if (!projectId) {
    console.warn(`   ⚠️  No Asana project mapping for: ${loanProductId} (${loanProductName})`);
    return null;
  }
  
  const formattedAmount = formatLoanAmount(loanAmount);
  const taskName = `Loan – ${clientName} – ${formattedAmount}`;
  
  const submissionDate = new Date().toLocaleDateString('en-IN', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
  const productInfo = loanProductName || loanProductId;
  const clientCodeInfo = clientCode ? ` (${clientCode})` : '';
  const notes = `Submitted on ${submissionDate} by ${submittedBy}.\nProduct: ${productInfo}${clientCodeInfo}\nFile ID: ${fileId}`;
  
  try {
    const response = await fetch(`${ASANA_API_BASE}/tasks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ASANA_PAT}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          name: taskName,
          notes: notes,
          projects: [projectId],
          assignee: 'me',
        },
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`${response.status} ${response.statusText}: ${errorText}`);
    }
    
    const result = await response.json();
    const taskId = result.data?.gid || result.data?.id;
    
    if (!taskId) {
      throw new Error('Asana API response missing task ID');
    }
    
    const taskLink = `https://app.asana.com/0/${projectId}/${taskId}`;
    
    return { taskId, taskLink };
  } catch (error) {
    console.error(`   ❌ Error creating Asana task:`, error.message);
    return null;
  }
}

/**
 * Update loan application with Asana task info
 */
async function updateLoanApplication(applicationId, fileId, asanaTaskId, asanaTaskLink) {
  try {
    const updateData = {
      id: applicationId,
      'File ID': fileId,
      'Asana Task ID': asanaTaskId,
      'Asana Task Link': asanaTaskLink,
    };
    
    const response = await fetch(N8N_POST_LOAN_APPLICATION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData),
    });
    
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    
    return true;
  } catch (error) {
    console.error(`   ❌ Error updating loan application:`, error.message);
    return false;
  }
}

/**
 * Get client info
 */
async function getClientInfo(clientId) {
  try {
    const response = await fetch(N8N_GET_CLIENTS_URL);
    if (!response.ok) return { name: clientId };
    
    const text = await response.text();
    if (!text) return { name: clientId };
    
    const clients = JSON.parse(text);
    const clientList = Array.isArray(clients) ? clients : (clients.records || []);
    const client = clientList.find(c => c.id === clientId || getField(c, 'Client ID') === clientId);
    
    if (client) {
      return {
        name: getField(client, 'Client Name') || getField(client, 'Name') || clientId,
        code: getField(client, 'Client ID') || getField(client, 'Client Code'),
      };
    }
    
    return { name: clientId };
  } catch (error) {
    return { name: clientId };
  }
}

/**
 * Get loan product name
 */
async function getLoanProductName(productId) {
  try {
    const response = await fetch(N8N_GET_LOAN_PRODUCTS_URL);
    if (!response.ok) return undefined;
    
    const text = await response.text();
    if (!text) return undefined;
    
    const products = JSON.parse(text);
    const productList = Array.isArray(products) ? products : (products.records || []);
    const product = productList.find(p => 
      p.id === productId || 
      getField(p, 'Loan Product ID') === productId || 
      getField(p, 'Product ID') === productId
    );
    
    if (product) {
      return getField(product, 'Loan Name') || getField(product, 'Product Name') || getField(product, 'Name');
    }
    
    return undefined;
  } catch (error) {
    return undefined;
  }
}

/**
 * Get user name from user ID or username
 * Supports query parameter: /webhook/useraccount?username={userId}
 */
async function getUserName(userId) {
  try {
    // If userId looks like an email/username, try query parameter first
    if (userId.includes('@') || userId.includes('.')) {
      try {
        const userAccountUrl = `${N8N_BASE_URL}/webhook/useraccount?username=${encodeURIComponent(userId)}`;
        const response = await fetch(userAccountUrl);
        
        if (response.ok) {
          const text = await response.text();
          if (text && text.trim()) {
            const result = JSON.parse(text);
            const users = Array.isArray(result) ? result : (result.records || []);
            
            if (users.length > 0) {
              const user = users[0];
              const name = getField(user, 'Name') || getField(user, 'Username') || getField(user, 'Email') || userId;
              return name;
            }
          }
        }
      } catch (queryError) {
        // Fall through to full fetch
      }
    }
    
    // Fallback: Fetch all users
    const response = await fetch(N8N_GET_USER_ACCOUNT_URL);
    if (!response.ok) return userId;
    
    const text = await response.text();
    if (!text) return userId;
    
    const users = JSON.parse(text);
    const userList = Array.isArray(users) ? users : (users.records || []);
    
    // Try to find by ID first
    let user = userList.find(u => u.id === userId || getField(u, 'User ID') === userId);
    
    // If not found and userId looks like username/email, search by Username
    if (!user && (userId.includes('@') || userId.includes('.'))) {
      user = userList.find(u => {
        const username = getField(u, 'Username') || getField(u, 'Email') || '';
        return username.toLowerCase() === userId.toLowerCase();
      });
    }
    
    if (user) {
      return getField(user, 'Name') || getField(user, 'Username') || getField(user, 'Email') || userId;
    }
    
    return userId;
  } catch (error) {
    return userId;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Sync Loans to Asana Script');
  console.log('==============================\n');
  
  if (!ASANA_PAT) {
    console.error('❌ ASANA_PAT environment variable not set!');
    console.error('Please set ASANA_PAT in your .env file.');
    process.exit(1);
  }
  
  // Parse command line arguments
  const statusFilter = process.argv.find(arg => arg.startsWith('--status='))?.split('=')[1] || 'all';
  
  console.log(`📋 Fetching loan applications...`);
  const applications = await fetchLoanApplications();
  console.log(`   ✅ Fetched ${applications.length} loan applications`);
  
  // Filter applications
  let filteredApplications = applications;
  
  // Filter out applications that already have Asana Task ID
  filteredApplications = filteredApplications.filter(app => {
    const asanaTaskId = getField(app, 'Asana Task ID');
    return !asanaTaskId;
  });
  
  // Filter by status if specified
  if (statusFilter === 'submitted') {
    filteredApplications = filteredApplications.filter(app => {
      const status = getField(app, 'Status');
      return status === 'under_kam_review' || 
             status === 'pending_credit_review' ||
             status === 'UNDER_KAM_REVIEW' ||
             status === 'PENDING_CREDIT_REVIEW';
    });
  }
  
  console.log(`\n📊 Found ${filteredApplications.length} applications to sync (${statusFilter} status, no Asana Task ID)`);
  
  if (filteredApplications.length === 0) {
    console.log('✨ No applications to sync!\n');
    return;
  }
  
  const results = [];
  
  for (let i = 0; i < filteredApplications.length; i++) {
    const app = filteredApplications[i];
    const fileId = getField(app, 'File ID');
    const clientId = getField(app, 'Client');
    const loanProductId = getField(app, 'Loan Product');
    const loanAmount = getField(app, 'Requested Loan Amount') || getField(app, 'Approved Loan Amount');
    const submittedBy = getField(app, 'Submitted By') || getField(app, 'Created By');
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Processing ${i + 1}/${filteredApplications.length}: ${fileId}`);
    console.log(`   Client: ${clientId}`);
    console.log(`   Product: ${loanProductId}`);
    console.log(`   Amount: ${loanAmount || 'N/A'}`);
    
    if (!fileId || !clientId || !loanProductId) {
      console.log(`   ⚠️  Skipping: Missing required fields`);
      results.push({ success: false, fileId, error: 'Missing required fields' });
      continue;
    }
    
    // Fetch additional data
    const [clientInfo, loanProductName, submittedByName] = await Promise.all([
      getClientInfo(clientId),
      getLoanProductName(loanProductId),
      submittedBy ? getUserName(submittedBy) : Promise.resolve('Unknown'),
    ]);
    
    console.log(`   Client Name: ${clientInfo.name}`);
    console.log(`   Product Name: ${loanProductName || 'N/A'}`);
    console.log(`   Submitted By: ${submittedByName}`);
    
    // Create Asana task
    const asanaTask = await createAsanaTask(
      fileId,
      clientInfo.name,
      loanProductId,
      loanProductName,
      loanAmount,
      submittedByName,
      clientInfo.code
    );
    
    if (!asanaTask) {
      results.push({ success: false, fileId, error: 'Failed to create Asana task' });
      continue;
    }
    
    console.log(`   ✅ Created Asana task: ${asanaTask.taskId}`);
    console.log(`   🔗 Task Link: ${asanaTask.taskLink}`);
    
    // Update loan application
    const updated = await updateLoanApplication(
      app.id || app['Application ID'],
      fileId,
      asanaTask.taskId,
      asanaTask.taskLink
    );
    
    if (updated) {
      console.log(`   ✅ Updated loan application with Asana task info`);
      results.push({ success: true, fileId, taskId: asanaTask.taskId, taskLink: asanaTask.taskLink });
    } else {
      console.log(`   ⚠️  Asana task created but failed to update loan application`);
      results.push({ success: false, fileId, error: 'Failed to update loan application', taskId: asanaTask.taskId });
    }
    
    // Rate limiting: wait 1 second between requests
    if (i < filteredApplications.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`\n✅ Successful: ${successful.length}`);
  successful.forEach(r => {
    console.log(`   - ${r.fileId}: ${r.taskId}`);
  });
  
  if (failed.length > 0) {
    console.log(`\n❌ Failed: ${failed.length}`);
    failed.forEach(r => {
      console.log(`   - ${r.fileId}: ${r.error || 'Unknown error'}`);
    });
  }
  
  console.log(`\n✨ Script completed!\n`);
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});

