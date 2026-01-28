/**
 * Test Notifications POST Webhook
 * 
 * Tests that notifications are saved to Airtable with all fields
 * 
 * Usage: node test-notifications-webhook.js
 * 
 * Prerequisites:
 * - n8n Notifications webhook must be configured with all 15 field mappings
 * - See N8N_NOTIFICATIONS_WEBHOOK_FIX.md for configuration instructions
 */

const N8N_BASE_URL = process.env.N8N_BASE_URL || 'https://fixrrahul.app.n8n.cloud';

async function testNotificationsWebhook() {
  console.log('🧪 Testing Notifications POST Webhook...\n');

  const testNotification = {
    id: `NOTIF-TEST-${Date.now()}`,
    'Notification ID': `NOTIF-TEST-${Date.now()}`,
    'Recipient User': 'test@example.com',
    'Recipient Role': 'KAM',
    'Related File': 'FILE001',
    'Related Client': 'CL001',
    'Related Ledger Entry': '',
    'Notification Type': 'file_update',
    'Title': 'Test Notification',
    'Message': 'This is a test notification to verify webhook configuration',
    'Channel': 'In-App',
    'Is Read': 'False',
    'Created At': new Date().toISOString(),
    'Read At': '',
    'Action Link': '/files/FILE001'
  };

  console.log('Sending test notification:');
  console.log(JSON.stringify(testNotification, null, 2));
  console.log('\n');

  try {
    const response = await fetch(`${N8N_BASE_URL}/webhook/notification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testNotification)
    });

    const responseText = await response.text();
    console.log('Response Status:', response.status);
    console.log('Response Body:', responseText);
    console.log('\n');

    if (response.status >= 200 && response.status < 300) {
      console.log('✅ PASS: Notification POST succeeded');
      console.log('\n📋 Next Steps:');
      console.log('1. Open Airtable → Notifications table');
      console.log('2. Look for notification with ID:', testNotification.id);
      console.log('3. Verify all 15 fields are populated:');
      console.log('   - Notification ID');
      console.log('   - Recipient User');
      console.log('   - Recipient Role');
      console.log('   - Related File');
      console.log('   - Related Client');
      console.log('   - Related Ledger Entry');
      console.log('   - Notification Type');
      console.log('   - Title');
      console.log('   - Message');
      console.log('   - Channel');
      console.log('   - Is Read');
      console.log('   - Created At');
      console.log('   - Read At');
      console.log('   - Action Link');
      console.log('\n⚠️  If fields are empty, n8n webhook field mappings are not configured correctly.');
      console.log('   See N8N_NOTIFICATIONS_WEBHOOK_FIX.md for configuration instructions.');
    } else {
      console.log('❌ FAIL: Notification POST failed');
      console.log('Status:', response.status);
      console.log('Response:', responseText);
      console.log('\n⚠️  Check n8n workflow execution logs for errors.');
    }
  } catch (error) {
    console.log('❌ ERROR: Request failed');
    console.log('Error:', error.message);
    console.log('\n⚠️  Check that:');
    console.log('1. n8n workflow is active');
    console.log('2. Webhook URL is correct');
    console.log('3. Network connectivity to n8n instance');
  }
}

testNotificationsWebhook().catch(console.error);
