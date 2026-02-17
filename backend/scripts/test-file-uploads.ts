#!/usr/bin/env tsx
/**
 * Test File Upload Functionality
 * Verifies that file upload endpoints are working correctly
 */

import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';
import FormData from 'form-data';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001/api';
const N8N_BASE_URL = process.env.N8N_BASE_URL || 'https://fixrrahul.app.n8n.cloud';

async function login(username: string, passcode: string): Promise<string | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, passcode }),
    });
    
    if (response.status === 200) {
      const data = await response.json();
      return data.token;
    }
    return null;
  } catch (error) {
    console.error(`Login failed:`, error);
    return null;
  }
}

async function testUploadConfiguration() {
  console.log('\n=== Test 3.1: Upload Endpoint Configuration ===\n');
  
  const onedriveUrl = process.env.ONEDRIVE_UPLOAD_URL;
  
  if (!onedriveUrl) {
    console.log('❌ ONEDRIVE_UPLOAD_URL environment variable is not set');
    console.log('   Set it in your environment or .env file');
    return false;
  }
  
  console.log(`✅ ONEDRIVE_UPLOAD_URL is set: ${onedriveUrl.substring(0, 50)}...`);
  
  // Test if webhook URL is accessible (just check if it's a valid URL)
  try {
    new URL(onedriveUrl);
    console.log('✅ Webhook URL format is valid');
    return true;
  } catch (error) {
    console.log('❌ Webhook URL format is invalid');
    return false;
  }
}

async function testUploadEndpoint(token: string) {
  console.log('\n=== Test 3.2: Upload Endpoint Availability ===\n');
  
  try {
    // Test without file (should return 400)
    const response = await fetch(`${API_BASE_URL}/documents/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    const status = response.status;
    const data = await response.json().catch(() => ({}));
    
    if (status === 400) {
      console.log('✅ Upload endpoint is accessible');
      console.log(`   Expected error (no file): ${data.error || 'No file provided'}`);
      return true;
    } else if (status === 401) {
      console.log('⚠️  Upload endpoint requires authentication (expected)');
      return true;
    } else if (status === 500) {
      console.log('❌ Upload endpoint has server error');
      console.log(`   Error: ${data.error || 'Unknown error'}`);
      return false;
    } else {
      console.log(`⚠️  Unexpected status: ${status}`);
      return false;
    }
  } catch (error: any) {
    console.log(`❌ Failed to test upload endpoint: ${error.message}`);
    return false;
  }
}

async function testSingleFileUpload(token: string) {
  console.log('\n=== Test 3.3: Single File Upload ===\n');
  
  // Create a test file
  const testFileContent = 'This is a test file for upload verification';
  const testFilePath = path.join(process.cwd(), 'test-upload-file.txt');
  
  try {
    fs.writeFileSync(testFilePath, testFileContent);
    console.log('✅ Test file created');
    
    // Create form data
    const form = new FormData();
    form.append('file', fs.createReadStream(testFilePath), {
      filename: 'test-upload-file.txt',
      contentType: 'text/plain',
    });
    form.append('fileName', 'test-upload-file.txt');
    form.append('fieldId', 'test-field-id');
    
    const response = await fetch(`${API_BASE_URL}/documents/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        ...form.getHeaders(),
      },
      body: form,
    });
    
    const status = response.status;
    const data = await response.json().catch(() => ({}));
    
    // Clean up test file
    fs.unlinkSync(testFilePath);
    
    if (status === 200 && data.success && data.data?.shareLink) {
      console.log('✅ File upload successful');
      console.log(`   Share Link: ${data.data.shareLink.substring(0, 50)}...`);
      console.log(`   File ID: ${data.data.fileId}`);
      return true;
    } else {
      console.log(`❌ File upload failed: Status ${status}`);
      console.log(`   Response: ${JSON.stringify(data, null, 2)}`);
      return false;
    }
  } catch (error: any) {
    // Clean up test file if it exists
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
    console.log(`❌ File upload test error: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🧪 Testing File Upload Functionality\n');
  
  // Test configuration
  const configPassed = await testUploadConfiguration();
  
  if (!configPassed) {
    console.log('\n⚠️  Skipping upload tests - configuration not set');
    process.exit(1);
  }
  
  // Login to get token (use env: E2E_CLIENT_USERNAME, E2E_CLIENT_PASSWORD - matches Airtable User Accounts Username)
  const username = process.env.E2E_CLIENT_USERNAME || 'Sagar@gmail.com';
  const passcode = process.env.E2E_CLIENT_PASSWORD || 'pass@123';
  console.log('\nLogging in...');
  const token = await login(username, passcode);
  
  if (!token) {
    console.log('❌ Failed to login - cannot test upload endpoints');
    process.exit(1);
  }
  
  console.log('✅ Login successful\n');
  
  // Test endpoints
  const endpointPassed = await testUploadEndpoint(token);
  const uploadPassed = await testSingleFileUpload(token);
  
  // Summary
  console.log('\n=== Summary ===');
  console.log(`Configuration: ${configPassed ? '✅' : '❌'}`);
  console.log(`Endpoint: ${endpointPassed ? '✅' : '❌'}`);
  console.log(`Upload: ${uploadPassed ? '✅' : '❌'}`);
  
  const allPassed = configPassed && endpointPassed && uploadPassed;
  console.log(allPassed ? '\n✅ All upload tests passed' : '\n❌ Some upload tests failed');
  
  process.exit(allPassed ? 0 : 1);
}

main();
