#!/usr/bin/env node
/**
 * Test script to verify the User Accounts webhook is working
 * This uses the same code path as the backend login
 */

require('dotenv').config();

async function testWebhook() {
  console.log('🧪 Testing User Accounts Webhook...\n');
  
  // Check environment variable
  const n8nBaseUrl = process.env.N8N_BASE_URL;
  if (!n8nBaseUrl) {
    console.error('❌ N8N_BASE_URL environment variable is not set!');
    console.error('   Please set it in your .env file or environment');
    process.exit(1);
  }
  
  console.log(`✅ N8N_BASE_URL: ${n8nBaseUrl}`);
  
  // Construct the webhook URL (same as backend)
  const webhookUrl = `${n8nBaseUrl}/webhook/useraccount`;
  console.log(`📡 Webhook URL: ${webhookUrl}\n`);
  
  try {
    console.log('🔄 Making GET request...');
    const startTime = Date.now();
    
    const response = await fetch(webhookUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const fetchTime = Date.now() - startTime;
    console.log(`⏱️  Fetch completed in ${fetchTime}ms`);
    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    console.log(`📋 Content-Type: ${response.headers.get('content-type')}`);
    console.log(`📏 Content-Length: ${response.headers.get('content-length') || 'unknown'}\n`);
    
    if (!response.ok) {
      const text = await response.text();
      console.error(`❌ Error response (${response.status}):`);
      console.error(text.substring(0, 500));
      process.exit(1);
    }
    
    // Read as text first (same as backend)
    const text = await response.text();
    console.log(`📄 Response body length: ${text.length} characters`);
    
    if (!text || text.trim().length === 0) {
      console.error('❌ Response body is empty!');
      process.exit(1);
    }
    
    // Check if HTML
    const looksLikeHtml = /^\s*</.test(text.trim()) || text.trim().toLowerCase().startsWith('<!');
    if (looksLikeHtml) {
      console.error('❌ Response looks like HTML (error page):');
      console.error(text.substring(0, 500));
      process.exit(1);
    }
    
    // Parse JSON
    let data;
    try {
      data = JSON.parse(text);
      console.log('✅ JSON parsed successfully');
    } catch (parseErr) {
      console.error('❌ JSON parsing failed:');
      console.error(parseErr.message);
      console.error('\n📄 Response preview:');
      console.error(text.substring(0, 500));
      process.exit(1);
    }
    
    // Validate response format
    if (!Array.isArray(data)) {
      console.error('❌ Response is not an array!');
      console.error('Response type:', typeof data);
      console.error('Response:', JSON.stringify(data, null, 2).substring(0, 500));
      process.exit(1);
    }
    
    console.log(`✅ Response is valid JSON array with ${data.length} records\n`);
    
    // Check for valid records
    const validRecords = data.filter(record => {
      return record && 
             typeof record === 'object' && 
             record.id && 
             (record.Username || (record.fields && record.fields.Username));
    });
    
    console.log(`📊 Valid records: ${validRecords.length}/${data.length}`);
    
    if (validRecords.length === 0) {
      console.error('❌ No valid records found!');
      process.exit(1);
    }
    
    // Show sample record
    console.log('\n📋 Sample record:');
    const sample = validRecords[0];
    console.log(JSON.stringify({
      id: sample.id,
      Username: sample.Username || sample.fields?.Username,
      Role: sample.Role || sample.fields?.Role,
      'Account Status': sample['Account Status'] || sample.fields?.['Account Status'],
    }, null, 2));
    
    console.log('\n✅ Webhook test PASSED!');
    console.log(`   Total records: ${data.length}`);
    console.log(`   Valid records: ${validRecords.length}`);
    console.log(`   Fetch time: ${fetchTime}ms`);
    
  } catch (error) {
    console.error('\n❌ Test FAILED:');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testWebhook();
