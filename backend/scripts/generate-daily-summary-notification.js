/**
 * Script to generate and send daily summary notifications
 * 
 * This script:
 * 1. Fetches daily loan activity from yesterday
 * 2. Aggregates summary metrics (new applications, approved, rejected, commissions)
 * 3. Formats a summary message
 * 4. Sends notifications to all Admins, KAMs, and Credit team via webhook
 * 5. Optionally sends email notifications
 * 
 * Usage: 
 *   node backend/scripts/generate-daily-summary-notification.js [date]
 * 
 * If no date is provided, it uses yesterday's date.
 * Date format: YYYY-MM-DD (e.g., 2026-01-03)
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

dotenv.config();

const N8N_BASE_URL = process.env.N8N_BASE_URL || 'https://fixrrahul.app.n8n.cloud';

// Webhook URLs
const N8N_GET_LOAN_APPLICATION_URL = `${N8N_BASE_URL}/webhook/loanapplication`;
const N8N_GET_ADMIN_ACTIVITY_LOG_URL = `${N8N_BASE_URL}/webhook/adminactivitylog`;
const N8N_GET_ADMIN_ACTIVITY_LOG_URL_ALT = `${N8N_BASE_URL}/webhook/adminactivity`;
const N8N_GET_COMMISSION_LEDGER_URL = `${N8N_BASE_URL}/webhook/commissionledger`;
const N8N_GET_USER_ACCOUNT_URL = `${N8N_BASE_URL}/webhook/useraccount`;
const N8N_POST_NOTIFICATION_URL = `${N8N_BASE_URL}/webhook/notification`;
const N8N_POST_EMAIL_URL = `${N8N_BASE_URL}/webhook/email`;

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
 * Get yesterday's date in YYYY-MM-DD format
 */
function getYesterdayDate() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split('T')[0];
}

/**
 * Check if a date string matches yesterday (YYYY-MM-DD format)
 */
function isDateInRange(dateStr, targetDate) {
  if (!dateStr) return false;
  
  // Extract date part from ISO string or date string
  const datePart = dateStr.split('T')[0];
  return datePart === targetDate;
}

/**
 * Format date for display (e.g., "Jan 3, 2026")
 */
function formatDateForDisplay(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/**
 * Fetch all loan applications
 */
async function fetchLoanApplications() {
  try {
    const response = await fetch(N8N_GET_LOAN_APPLICATION_URL);
    
    if (!response.ok) {
      console.error(`   ❌ Failed to fetch loan applications: ${response.status} ${response.statusText}`);
      return [];
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
    
    // Handle both array and object with records array
    if (!Array.isArray(applications)) {
      if (applications.records && Array.isArray(applications.records)) {
        applications = applications.records;
      } else {
        return [];
      }
    }
    
    return applications;
  } catch (error) {
    console.error(`   ❌ Error fetching loan applications:`, error.message);
    return [];
  }
}

/**
 * Fetch all Admin Activity Log entries
 */
async function fetchAdminActivityLogs() {
  try {
    let response = await fetch(N8N_GET_ADMIN_ACTIVITY_LOG_URL);
    
    // Try alternate path if first one fails
    if (!response.ok && response.status === 404) {
      response = await fetch(N8N_GET_ADMIN_ACTIVITY_LOG_URL_ALT);
    }
    
    if (!response.ok) {
      console.error(`   ❌ Failed to fetch Admin Activity Log: ${response.status} ${response.statusText}`);
      return [];
    }
    
    const text = await response.text();
    if (!text || text.trim() === '') {
      return [];
    }
    
    let logs;
    try {
      logs = JSON.parse(text);
    } catch (e) {
      return [];
    }
    
    // Handle both array and object with records array
    if (!Array.isArray(logs)) {
      if (logs.records && Array.isArray(logs.records)) {
        logs = logs.records;
      } else {
        return [];
      }
    }
    
    return logs;
  } catch (error) {
    console.error(`   ❌ Error fetching Admin Activity Log:`, error.message);
    return [];
  }
}

/**
 * Fetch all Commission Ledger entries
 */
async function fetchCommissionLedger() {
  try {
    const response = await fetch(N8N_GET_COMMISSION_LEDGER_URL);
    
    if (!response.ok) {
      console.error(`   ❌ Failed to fetch Commission Ledger: ${response.status} ${response.statusText}`);
      return [];
    }
    
    const text = await response.text();
    if (!text || text.trim() === '') {
      return [];
    }
    
    let entries;
    try {
      entries = JSON.parse(text);
    } catch (e) {
      return [];
    }
    
    // Handle both array and object with records array
    if (!Array.isArray(entries)) {
      if (entries.records && Array.isArray(entries.records)) {
        entries = entries.records;
      } else {
        return [];
      }
    }
    
    return entries;
  } catch (error) {
    console.error(`   ❌ Error fetching Commission Ledger:`, error.message);
    return [];
  }
}

/**
 * Fetch all user accounts to get admin/KAM/credit team emails
 */
async function fetchUserAccounts() {
  try {
    const response = await fetch(N8N_GET_USER_ACCOUNT_URL);
    
    if (!response.ok) {
      console.warn(`   ⚠️  Failed to fetch user accounts`);
      return [];
    }
    
    const text = await response.text();
    if (!text || text.trim() === '') {
      return [];
    }
    
    let users;
    try {
      users = JSON.parse(text);
    } catch (e) {
      return [];
    }
    
    // Handle both array and object with records array
    if (!Array.isArray(users)) {
      if (users.records && Array.isArray(users.records)) {
        users = users.records;
      } else {
        return [];
      }
    }
    
    return users;
  } catch (error) {
    console.warn(`   ⚠️  Error fetching user accounts:`, error.message);
    return [];
  }
}

/**
 * Calculate daily summary metrics
 */
function calculateMetrics(applications, adminActivities, ledgerEntries, targetDate) {
  // Filter applications created or updated yesterday
  const yesterdayApplications = applications.filter(app => {
    const creationDate = getField(app, 'Creation Date') || getField(app, 'Submitted Date');
    const lastUpdated = getField(app, 'Last Updated');
    return isDateInRange(creationDate, targetDate) || isDateInRange(lastUpdated, targetDate);
  });
  
  // Count new applications (created yesterday)
  const newApplications = applications.filter(app => {
    const creationDate = getField(app, 'Creation Date') || getField(app, 'Submitted Date');
    return isDateInRange(creationDate, targetDate);
  }).length;
  
  // Filter admin activities from yesterday
  const yesterdayActivities = adminActivities.filter(activity => {
    const timestamp = getField(activity, 'Updated At') || 
                     getField(activity, 'Timestamp') || 
                     getField(activity, 'Created At');
    return isDateInRange(timestamp, targetDate);
  });
  
  // Count approved and rejected
  const approved = yesterdayActivities.filter(activity => {
    const updatedStatus = getField(activity, 'Updated Status');
    return updatedStatus === 'Approved' || updatedStatus === 'APPROVED';
  }).length;
  
  const rejected = yesterdayActivities.filter(activity => {
    const updatedStatus = getField(activity, 'Updated Status');
    return updatedStatus === 'Rejected' || updatedStatus === 'REJECTED';
  }).length;
  
  // Filter commission ledger entries from yesterday
  const yesterdayCommissions = ledgerEntries.filter(entry => {
    const date = getField(entry, 'Date');
    return isDateInRange(date, targetDate);
  });
  
  // Calculate total commissions logged
  const commissionsLogged = yesterdayCommissions.reduce((sum, entry) => {
    const payoutAmount = getField(entry, 'Payout Amount');
    if (payoutAmount) {
      const amount = parseFloat(payoutAmount.toString().replace(/[^\d.-]/g, ''));
      return sum + (isNaN(amount) ? 0 : Math.abs(amount));
    }
    return sum;
  }, 0);
  
  // Calculate pending commissions (entries with Payout Request = 'False' or 'Requested')
  const pendingCommissions = ledgerEntries.filter(entry => {
    const payoutRequest = getField(entry, 'Payout Request');
    return payoutRequest === 'False' || payoutRequest === 'Requested' || payoutRequest === 'REQUESTED';
  }).reduce((sum, entry) => {
    const payoutAmount = getField(entry, 'Payout Amount');
    if (payoutAmount) {
      const amount = parseFloat(payoutAmount.toString().replace(/[^\d.-]/g, ''));
      return sum + (isNaN(amount) ? 0 : Math.abs(amount));
    }
    return sum;
  }, 0);
  
  return {
    newApplications,
    approved,
    rejected,
    commissionsLogged,
    pendingCommissions,
  };
}

/**
 * Format summary message
 */
function formatSummaryMessage(targetDate, metrics) {
  const dateDisplay = formatDateForDisplay(targetDate);
  
  return `🗓️ Daily Summary – ${dateDisplay}

🔹 New Applications: ${metrics.newApplications}
🔸 Approved: ${metrics.approved}
🔻 Rejected: ${metrics.rejected}

💰 Commissions Logged: ₹${metrics.commissionsLogged.toLocaleString('en-IN')}
🧾 Pending Commission: ₹${metrics.pendingCommissions.toLocaleString('en-IN')}

📌 Reminder:
- All teams must update Asana by 8:00 PM
- Weekly admin balance and budget due Monday 11:00 AM`;
}

/**
 * Send notification to all admins, KAMs, and credit team
 */
async function sendNotifications(summaryMessage, targetDate) {
  console.log(`\n📧 Sending notifications...`);
  
  // Fetch user accounts
  const users = await fetchUserAccounts();
  
  // Filter for admins, KAMs, and credit team
  const recipients = users.filter(user => {
    const role = getField(user, 'Role') || getField(user, 'role');
    const status = getField(user, 'Account Status') || getField(user, 'Status');
    return (role === 'admin' || role === 'kam' || role === 'credit_team') && 
           (status === 'Active' || status === 'ACTIVE');
  });
  
  console.log(`   Found ${recipients.length} recipients (admins, KAMs, credit team)`);
  
  const notificationResults = [];
  
  for (const recipient of recipients) {
    const email = getField(recipient, 'Email') || getField(recipient, 'Username');
    const role = getField(recipient, 'Role') || 'user';
    const userId = getField(recipient, 'id') || getField(recipient, 'User ID');
    
    if (!email) {
      console.warn(`   ⚠️  Skipping user ${userId}: no email found`);
      continue;
    }
    
    const notificationId = `NOTIF-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const notificationData = {
      id: notificationId,
      'Notification ID': notificationId,
      'Recipient User': email,
      'Recipient Role': role,
      'Related File': '',
      'Related Client': '',
      'Related Ledger Entry': '',
      'Notification Type': 'daily_summary',
      'Title': `Daily Summary – ${formatDateForDisplay(targetDate)}`,
      'Message': summaryMessage,
      'Channel': 'both', // both email and in-app
      'Is Read': 'False',
      'Created At': new Date().toISOString(),
      'Read At': '',
      'Action Link': '/dashboard',
    };
    
    try {
      const response = await fetch(N8N_POST_NOTIFICATION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(notificationData),
      });
      
      const result = await response.json();
      
      if (response.ok) {
        console.log(`   ✅ Notification sent to ${email} (${role})`);
        notificationResults.push({ success: true, email, role });
      } else {
        console.error(`   ❌ Failed to send notification to ${email}:`, result);
        notificationResults.push({ success: false, email, role, error: result });
      }
    } catch (error) {
      console.error(`   ❌ Error sending notification to ${email}:`, error.message);
      notificationResults.push({ success: false, email, role, error: error.message });
    }
    
    // Rate limiting: wait 500ms between notifications
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return notificationResults;
}

/**
 * Send email notification (optional, if email webhook is configured)
 */
async function sendEmailNotification(summaryMessage, targetDate, recipientEmails) {
  if (!recipientEmails || recipientEmails.length === 0) {
    return;
  }
  
  console.log(`\n📨 Sending email notification to ${recipientEmails.length} recipients...`);
  
  try {
    const emailData = {
      to: recipientEmails.join(', '),
      subject: `Daily Summary – ${formatDateForDisplay(targetDate)}`,
      body: summaryMessage,
    };
    
    const response = await fetch(N8N_POST_EMAIL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailData),
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log(`   ✅ Email notification sent successfully`);
      return { success: true };
    } else {
      console.error(`   ❌ Failed to send email notification:`, result);
      return { success: false, error: result };
    }
  } catch (error) {
    console.error(`   ❌ Error sending email notification:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Daily Summary Notification Script');
  console.log('====================================\n');
  
  // Get target date (yesterday by default, or from command line)
  const targetDate = process.argv[2] || getYesterdayDate();
  
  console.log(`📅 Generating summary for: ${targetDate} (${formatDateForDisplay(targetDate)})`);
  
  // Step 1: Fetch data
  console.log(`\n📊 Fetching data...`);
  
  console.log(`   Fetching loan applications...`);
  const applications = await fetchLoanApplications();
  console.log(`   ✅ Fetched ${applications.length} loan applications`);
  
  console.log(`   Fetching admin activity logs...`);
  const adminActivities = await fetchAdminActivityLogs();
  console.log(`   ✅ Fetched ${adminActivities.length} admin activity log entries`);
  
  console.log(`   Fetching commission ledger...`);
  const ledgerEntries = await fetchCommissionLedger();
  console.log(`   ✅ Fetched ${ledgerEntries.length} commission ledger entries`);
  
  // Step 2: Calculate metrics
  console.log(`\n📈 Calculating metrics...`);
  const metrics = calculateMetrics(applications, adminActivities, ledgerEntries, targetDate);
  
  console.log(`   New Applications: ${metrics.newApplications}`);
  console.log(`   Approved: ${metrics.approved}`);
  console.log(`   Rejected: ${metrics.rejected}`);
  console.log(`   Commissions Logged: ₹${metrics.commissionsLogged.toLocaleString('en-IN')}`);
  console.log(`   Pending Commission: ₹${metrics.pendingCommissions.toLocaleString('en-IN')}`);
  
  // Step 3: Format summary message
  const summaryMessage = formatSummaryMessage(targetDate, metrics);
  
  console.log(`\n📝 Summary Message:`);
  console.log('─'.repeat(60));
  console.log(summaryMessage);
  console.log('─'.repeat(60));
  
  // Step 4: Send notifications
  const notificationResults = await sendNotifications(summaryMessage, targetDate);
  
  // Step 5: Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  
  const successful = notificationResults.filter(r => r.success);
  const failed = notificationResults.filter(r => !r.success);
  
  console.log(`\n✅ Notifications sent successfully: ${successful.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  
  if (failed.length > 0) {
    console.log(`\nFailed recipients:`);
    failed.forEach(r => {
      console.log(`   - ${r.email} (${r.role}): ${r.error || 'Unknown error'}`);
    });
  }
  
  console.log(`\n✨ Script completed!\n`);
}

// Run the script
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});

