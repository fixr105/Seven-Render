/**
 * Asana Integration Service
 * 
 * Handles creating and updating Asana tasks for loan applications
 */

import fetch from 'node-fetch';
import { n8nClient } from '../airtable/n8nClient.js';

const ASANA_API_BASE = 'https://app.asana.com/api/1.0';

/**
 * Get Asana authentication token
 * Supports both PAT (Personal Access Token) and OAuth
 * Priority: PAT > OAuth Access Token
 */
function getAsanaAuthToken(): string {
  // Try PAT first (simpler for server-to-server)
  const pat = process.env.ASANA_PAT;
  if (pat) {
    return pat;
  }
  
  // Try OAuth access token (if OAuth flow was completed)
  const oauthToken = process.env.ASANA_OAUTH_ACCESS_TOKEN;
  if (oauthToken) {
    return oauthToken;
  }
  
  // Warn if neither is set
  console.warn('[AsanaService] ASANA_PAT or ASANA_OAUTH_ACCESS_TOKEN not set. Asana integration will be disabled.');
  console.warn('[AsanaService] To enable: Set ASANA_PAT in .env (recommended for server-to-server)');
  return '';
}

/**
 * Get Asana OAuth credentials (for OAuth flow if needed)
 */
function getAsanaOAuthCredentials(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.ASANA_CLIENT_ID;
  const clientSecret = process.env.ASANA_CLIENT_SECRET;
  
  if (clientId && clientSecret) {
    return { clientId, clientSecret };
  }
  
  return null;
}

/**
 * Loan Product to Asana Project mapping
 */
const LOAN_PRODUCT_TO_ASANA_PROJECT: Record<string, string> = {
  'Revenue Based Finance for EV': '1211908004694493',
  'HL / LAP': '1211887051020596',
  'Porter': '1211908004694478',
  'Rapido': '1212391754448240',
  'Money Multiplier': '1211908004694490',
  'Numerous': '1211908004853949',
  // Add more mappings as needed
  'LP009': '1211908004694493', // Revenue Based Finance for EV
  'LP010': '1211908004694490', // Money Multiplier (assuming)
  'LP011': '1211908004694490', // Money Multiplier
  'LP012': '1211887051020596', // HL / LAP (assuming)
  'LP013': '1211887051020596', // LAP
  'LP014': '1211908004694490', // Term Loan (default to Money Multiplier)
  'LP015': '1211908004853949', // Fundraise for NBFC (default to Numerous)
};

/**
 * Get Asana Project ID for a loan product
 */
function getAsanaProjectId(loanProductId: string, loanProductName?: string): string | null {
  // Try by product name first
  if (loanProductName) {
    const projectId = LOAN_PRODUCT_TO_ASANA_PROJECT[loanProductName];
    if (projectId) {
      return projectId;
    }
  }
  
  // Try by product ID
  const projectId = LOAN_PRODUCT_TO_ASANA_PROJECT[loanProductId];
  if (projectId) {
    return projectId;
  }
  
  return null;
}

/**
 * Format loan amount for display
 */
function formatLoanAmount(amount: string | number): string {
  if (!amount) return '₹0';
  const numAmount = typeof amount === 'string' ? parseFloat(amount.replace(/[^\d.-]/g, '')) : amount;
  if (isNaN(numAmount)) return '₹0';
  return `₹${numAmount.toLocaleString('en-IN')}`;
}

/**
 * Create Asana task for loan application
 */
export async function createAsanaTask(options: {
  fileId: string;
  clientName: string;
  loanProductId: string;
  loanProductName?: string;
  loanAmount: string | number;
  submittedBy: string;
  clientCode?: string;
  kamId?: string;
}): Promise<{ taskId: string; taskLink: string } | null> {
  try {
    const asanaAuthToken = getAsanaAuthToken();
    if (!asanaAuthToken) {
      console.warn('[AsanaService] Asana authentication not configured, skipping Asana task creation');
      return null;
    }
    
    const { fileId, clientName, loanProductId, loanProductName, loanAmount, submittedBy, clientCode, kamId } = options;
    
    // Get Asana Project ID
    const projectId = getAsanaProjectId(loanProductId, loanProductName);
    if (!projectId) {
      console.warn(`[AsanaService] No Asana project mapping found for loan product: ${loanProductId} (${loanProductName})`);
      return null;
    }
    
    // Format task name
    const formattedAmount = formatLoanAmount(loanAmount);
    const taskName = `Loan – ${clientName} – ${formattedAmount}`;
    
    // Format task notes
    const submissionDate = new Date().toLocaleDateString('en-IN', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
    const productInfo = loanProductName || loanProductId;
    const clientCodeInfo = clientCode ? ` (${clientCode})` : '';
    const notes = `Submitted on ${submissionDate} by ${submittedBy}.\nProduct: ${productInfo}${clientCodeInfo}\nFile ID: ${fileId}`;
    
    // Prepare task data
    const taskData: any = {
      name: taskName,
      notes: notes,
      projects: [projectId],
    };
    
    // Assign to KAM if known (or use "me" for current user)
    if (kamId) {
      // Try to get KAM's Asana user ID (would need to be stored in KAM Users table)
      // For now, use "me" or leave unassigned
      taskData.assignee = 'me';
    } else {
      taskData.assignee = 'me';
    }
    
    console.log(`[AsanaService] Creating Asana task: ${taskName} in project ${projectId}`);
    
    // Create task via Asana API
    const response = await fetch(`${ASANA_API_BASE}/tasks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${asanaAuthToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: taskData,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[AsanaService] Failed to create Asana task: ${response.status} ${response.statusText}`, errorText);
      return null;
    }
    
    const result = await response.json() as any;
    const taskId = result.data?.gid || result.data?.id;
    
    if (!taskId) {
      console.error('[AsanaService] Asana API response missing task ID:', result);
      return null;
    }
    
    // Construct task link
    const taskLink = `https://app.asana.com/0/${projectId}/${taskId}`;
    
    console.log(`[AsanaService] ✅ Created Asana task: ${taskId} - ${taskLink}`);
    
    return {
      taskId,
      taskLink,
    };
  } catch (error: any) {
    console.error('[AsanaService] Error creating Asana task:', error.message);
    return null;
  }
}

/**
 * Update loan application with Asana task ID
 */
export async function updateLoanApplicationWithAsanaTask(
  applicationId: string,
  fileId: string,
  asanaTaskId: string,
  asanaTaskLink: string
): Promise<boolean> {
  try {
    const updateData = {
      id: applicationId,
      'File ID': fileId,
      'Asana Task ID': asanaTaskId,
      'Asana Task Link': asanaTaskLink,
    };
    
    await n8nClient.postLoanApplication(updateData);
    
    console.log(`[AsanaService] ✅ Updated loan application ${fileId} with Asana task ${asanaTaskId}`);
    return true;
  } catch (error: any) {
    console.error(`[AsanaService] Failed to update loan application with Asana task:`, error.message);
    return false;
  }
}

/**
 * Get user name from user ID or username
 * 
 * Supports:
 * - userId as Airtable record ID
 * - userId as Username (email)
 * - Fetches via /webhook/useraccount?username={userId} if userId looks like an email
 */
export async function getUserName(userId: string): Promise<string> {
  try {
    // If userId looks like an email/username, try query parameter first
    if (userId.includes('@') || userId.includes('.')) {
      try {
        const { n8nEndpoints } = await import('../airtable/n8nEndpoints.js');
        if (!process.env.N8N_BASE_URL) {
          throw new Error('N8N_BASE_URL environment variable is required. Please set it in your environment configuration.');
        }
        const userAccountUrl = `${process.env.N8N_BASE_URL}/webhook/useraccount?username=${encodeURIComponent(userId)}`;
        
        const response = await fetch(userAccountUrl);
        if (response.ok) {
          const text = await response.text();
          if (text && text.trim()) {
            const result = JSON.parse(text);
            const users = Array.isArray(result) ? result : (result.records || []);
            
            if (users.length > 0) {
              const user = users[0];
              const name = user['Name'] || user['Username'] || user['Email'] || userId;
              console.log(`[AsanaService] Found user by username query: ${name}`);
              return name;
            }
          }
        }
      } catch (queryError: any) {
        console.warn(`[AsanaService] Username query failed, falling back to full fetch:`, queryError.message);
      }
    }
    
    // Fallback: Fetch all users and search
    const users = await n8nClient.fetchTable('User Accounts');
    
    // Try to find by ID first
    let user = users.find((u: any) => u.id === userId || u['User ID'] === userId);
    
    // If not found and userId looks like username/email, search by Username
    if (!user && (userId.includes('@') || userId.includes('.'))) {
      user = users.find((u: any) => {
        const username = u['Username'] || u['Email'] || '';
        return username.toLowerCase() === userId.toLowerCase();
      });
    }
    
    if (user) {
      // Return Name field if available, otherwise Username/Email
      return user['Name'] || user['Username'] || user['Email'] || userId;
    }
    
    return userId;
  } catch (error: any) {
    console.warn(`[AsanaService] Failed to fetch user name for ${userId}:`, error.message);
    return userId;
  }
}

/**
 * Get client name and code from client ID
 */
export async function getClientInfo(clientId: string): Promise<{ name: string; code?: string }> {
  try {
    const clients = await n8nClient.fetchTable('Clients');
    const client = clients.find((c: any) => c.id === clientId || c['Client ID'] === clientId);
    
    if (client) {
      return {
        name: client['Client Name'] || client['Name'] || clientId,
        code: client['Client ID'] || client['Client Code'],
      };
    }
    
    return { name: clientId };
  } catch (error: any) {
    console.warn(`[AsanaService] Failed to fetch client info for ${clientId}:`, error.message);
    return { name: clientId };
  }
}

/**
 * Get loan product name from product ID
 */
export async function getLoanProductName(productId: string): Promise<string | undefined> {
  try {
    const products = await n8nClient.fetchTable('Loan Products');
    const product = products.find((p: any) => p.id === productId || p['Loan Product ID'] === productId || p['Product ID'] === productId);
    
    if (product) {
      return product['Loan Name'] || product['Product Name'] || product['Name'];
    }
    
    return undefined;
  } catch (error: any) {
    console.warn(`[AsanaService] Failed to fetch loan product name for ${productId}:`, error.message);
    return undefined;
  }
}

/**
 * Create Asana task for a loan application (complete flow)
 */
export async function createAsanaTaskForLoan(application: any): Promise<{ taskId: string; taskLink: string } | null> {
  try {
    const fileId = application['File ID'] || application.fileId;
    const clientId = application.Client || application.clientId;
    const loanProductId = application['Loan Product'] || application.loanProductId;
    const loanAmount = application['Requested Loan Amount'] || application.requestedLoanAmount || application['Approved Loan Amount'] || application.approvedLoanAmount;
    const submittedBy = application['Submitted By'] || application.submittedBy || application['Created By'] || application.createdBy;
    const kamId = application['KAM Assigned'] || application.kamId;
    
    if (!fileId || !clientId || !loanProductId) {
      console.warn('[AsanaService] Missing required fields for Asana task creation:', { fileId, clientId, loanProductId });
      return null;
    }
    
    // Fetch additional data
    const [clientInfo, loanProductName, submittedByName] = await Promise.all([
      getClientInfo(clientId),
      getLoanProductName(loanProductId),
      submittedBy ? getUserName(submittedBy) : Promise.resolve('Unknown'),
    ]);
    
    // Create Asana task
    const asanaTask = await createAsanaTask({
      fileId,
      clientName: clientInfo.name,
      loanProductId,
      loanProductName,
      loanAmount,
      submittedBy: submittedByName,
      clientCode: clientInfo.code,
      kamId,
    });
    
    if (!asanaTask) {
      return null;
    }
    
    // Update loan application with Asana task info
    await updateLoanApplicationWithAsanaTask(
      application.id || application['Application ID'],
      fileId,
      asanaTask.taskId,
      asanaTask.taskLink
    );
    
    return asanaTask;
  } catch (error: any) {
    console.error('[AsanaService] Error creating Asana task for loan:', error.message);
    return null;
  }
}

