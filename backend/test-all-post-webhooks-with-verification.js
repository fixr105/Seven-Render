/**
 * Complete POST Webhook Test Suite with GET Verification
 * Tests all POST webhooks, then verifies data retrieval via GET
 * Ensures exact field matching between POST and GET
 */

import fetch from 'node-fetch';

const BASE_URL = 'https://fixrrahul.app.n8n.cloud/webhook';
const GET_URL = 'https://fixrrahul.app.n8n.cloud/webhook/46a2b46b-3288-4970-bd13-99c2ba08d52';

// Test configurations - each with exact fields from n8n schema
const webhookTests = [
  {
    name: '1. POSTLOG (Admin Activity Log)',
    url: `${BASE_URL}/POSTLOG`,
    table: 'Admin Activity log',
    data: {
      id: 'TEST-POSTLOG-' + Date.now(),
      'Activity ID': 'ACT-TEST-' + Date.now(),
      'Timestamp': new Date().toISOString(),
      'Performed By': 'Macha Test User',
      'Action Type': 'Test Action',
      'Description/Details': 'Macha test execution',
      'Target Entity': 'Test Entity'
    },
    fieldsToVerify: ['id', 'Activity ID', 'Timestamp', 'Performed By', 'Action Type', 'Description/Details', 'Target Entity']
  },
  {
    name: '2. POSTCLIENTFORMMAPPING (Client Form Mapping)',
    url: `${BASE_URL}/POSTCLIENTFORMMAPPING`,
    table: 'Client Form Mapping',
    data: {
      id: 'MAP-TEST-' + Date.now(),
      'Mapping ID': 'MAP-TEST-' + Date.now(),
      'Client': 'Test Corporation Pvt Ltd',
      'Category': 'Personal Information',
      'Is Required': 'True',
      'Display Order': '1'
    },
    fieldsToVerify: ['id', 'Mapping ID', 'Client', 'Category', 'Is Required', 'Display Order']
  },
  {
    name: '3. COMISSIONLEDGER (Commission Ledger)',
    url: `${BASE_URL}/COMISSIONLEDGER`,
    table: 'Commission Ledger',
    data: {
      id: 'LEDGER-TEST-' + Date.now(),
      'Ledger Entry ID': 'LEDGER-TEST-' + Date.now(),
      'Client': 'Test Corporation Pvt Ltd',
      'Loan File': 'SF20250101001',
      'Date': new Date().toISOString().split('T')[0],
      'Disbursed Amount': '5000000',
      'Commission Rate': '1.5',
      'Payout Amount': '75000',
      'Description': 'Commission for loan disbursement - Test entry',
      'Dispute Status': 'None',
      'Payout Request': 'False'
    },
    fieldsToVerify: ['id', 'Ledger Entry ID', 'Client', 'Loan File', 'Date', 'Disbursed Amount', 'Commission Rate', 'Payout Amount', 'Description', 'Dispute Status', 'Payout Request']
  },
  {
    name: '4. CREDITTEAMUSERS (Credit Team Users)',
    url: `${BASE_URL}/CREDITTEAMUSERS`,
    table: 'Credit Team Users',
    data: {
      id: 'CREDIT-TEST-' + Date.now(),
      'Credit User ID': 'CREDIT-TEST-' + Date.now(),
      'Name': 'John Credit Analyst',
      'Email': `credit.analyst.${Date.now()}@test.com`,
      'Phone': '+91 9876543212',
      'Role': 'credit_team',
      'Status': 'Active'
    },
    fieldsToVerify: ['id', 'Credit User ID', 'Name', 'Email', 'Phone', 'Role', 'Status']
  },
  {
    name: '5. DAILYSUMMARY (Daily Summary Reports)',
    url: `${BASE_URL}/DAILYSUMMARY`,
    table: 'Daily summary Reports',
    data: {
      id: 'SUMMARY-' + new Date().toISOString().split('T')[0].replace(/-/g, ''),
      'Report Date': new Date().toISOString().split('T')[0],
      'Summary Content': 'Daily summary report test - Total applications: 25. Approved: 8.',
      'Generated Timestamp': new Date().toISOString(),
      'Delivered To': 'credit_team, kam'
    },
    fieldsToVerify: ['id', 'Report Date', 'Summary Content', 'Generated Timestamp', 'Delivered To']
  },
  {
    name: '6. FILEAUDITLOGGING (File Audit Log)',
    url: `${BASE_URL}/FILEAUDITLOGGING`,
    table: 'File Auditing Log',
    data: {
      id: 'AUDIT-TEST-' + Date.now(),
      'Log Entry ID': 'AUDIT-TEST-' + Date.now(),
      'File': 'SF20250115001',
      'Timestamp': new Date().toISOString(),
      'Actor': 'KAM User - John Doe',
      'Action/Event Type': 'status_change',
      'Details/Message': 'Status changed from pending_kam_review to forwarded_to_credit',
      'Target User/Role': 'credit_team',
      'Resolved': 'False'
    },
    fieldsToVerify: ['id', 'Log Entry ID', 'File', 'Timestamp', 'Actor', 'Action/Event Type', 'Details/Message', 'Target User/Role', 'Resolved']
  },
  {
    name: '7. FormCategory (Form Categories)',
    url: `${BASE_URL}/FormCategory`,
    table: 'Form Categories',
    data: {
      id: 'CAT-TEST-' + Date.now(),
      'Category ID': 'CAT-TEST-' + Date.now(),
      'Category Name': 'Test Category - ' + new Date().toISOString(),
      'Description': 'Category for personal information fields',
      'Display Order': '1',
      'Active': 'True'
    },
    fieldsToVerify: ['id', 'Category ID', 'Category Name', 'Description', 'Display Order', 'Active']
  },
  {
    name: '8. FormFields (Form Fields)',
    url: `${BASE_URL}/FormFields`,
    table: 'Form Fields',
    data: {
      id: 'FIELD-TEST-' + Date.now(),
      'Field ID': 'FIELD-TEST-' + Date.now(),
      'Category': 'Personal Information',
      'Field Label': 'Full Name',
      'Field Type': 'text',
      'Field Placeholder': 'Enter your full name',
      'Field Options': '',
      'Is Mandatory': 'True',
      'Display Order': '1',
      'Active': 'True'
    },
    fieldsToVerify: ['id', 'Field ID', 'Category', 'Field Label', 'Field Type', 'Field Placeholder', 'Field Options', 'Is Mandatory', 'Display Order', 'Active']
  },
  {
    name: '9. KAMusers (KAM Users)',
    url: `${BASE_URL}/KAMusers`,
    table: 'KAM Users',
    data: {
      id: 'KAM-TEST-' + Date.now(),
      'KAM ID': 'KAM-TEST-' + Date.now(),
      'Name': 'John KAM Manager',
      'Email': `kam.manager.${Date.now()}@test.com`,
      'Phone': '+91 9876543211',
      'Managed Clients': 'Test Corporation Pvt Ltd, ABC Industries',
      'Role': 'kam',
      'Status': 'Active'
    },
    fieldsToVerify: ['id', 'KAM ID', 'Name', 'Email', 'Phone', 'Managed Clients', 'Role', 'Status']
  },
  {
    name: '10. applications (Loan Applications)',
    url: `${BASE_URL}/applications`,
    table: 'Loan Applications',
    data: {
      id: 'APP-TEST-' + Date.now(),
      'File ID': 'SF' + new Date().getFullYear() + String(Date.now()).slice(-6),
      'Client': 'Test Corporation Pvt Ltd',
      'Applicant Name': 'John Doe',
      'Loan Product': 'Home Loan',
      'Requested Loan Amount': '5000000',
      'Documents': 'Aadhar, PAN, Salary Slip',
      'Status': 'draft',
      'Assigned Credit Analyst': '',
      'Assigned NBFC': '',
      'Lender Decision Status': '',
      'Lender Decision Date': '',
      'Lender Decision Remarks': '',
      'Approved Loan Amount': '',
      'AI File Summary': 'Applicant has good credit history and stable income',
      'Form Data': JSON.stringify({
        property_type: 'Residential',
        property_value: 7000000
      }),
      'Creation Date': new Date().toISOString().split('T')[0],
      'Submitted Date': '',
      'Last Updated': new Date().toISOString()
    },
    fieldsToVerify: ['id', 'File ID', 'Client', 'Applicant Name', 'Loan Product', 'Requested Loan Amount', 'Documents', 'Status', 'Assigned Credit Analyst', 'Assigned NBFC', 'Lender Decision Status', 'Lender Decision Date', 'Lender Decision Remarks', 'Approved Loan Amount', 'AI File Summary', 'Form Data', 'Creation Date', 'Submitted Date', 'Last Updated']
  },
  {
    name: '11. adduser (User Accounts)',
    url: `${BASE_URL}/adduser`,
    table: 'User Accounts',
    data: {
      id: 'USER-TEST-' + Date.now(),
      'Username': `testuser.${Date.now()}@example.com`,
      'Password': 'Test@123456',
      'Role': 'client',
      'Associated Profile': 'Test Corporation Pvt Ltd',
      'Last Login': new Date().toISOString(),
      'Account Status': 'Active'
    },
    fieldsToVerify: ['id', 'Username', 'Password', 'Role', 'Associated Profile', 'Last Login', 'Account Status']
  },
  {
    name: '12. loadprod (Loan Products)',
    url: `${BASE_URL}/loadprod`,
    table: 'Loan Products',
    data: {
      id: 'PROD-TEST-' + Date.now(),
      'Product ID': 'PROD-TEST-' + Date.now(),
      'Product Name': 'Test Loan Product',
      'Description': 'A short description of the test loan product.',
      'Active': 'True',
      'Required Documents/Fields': 'PAN, Aadhar, Bank Statement'
    },
    fieldsToVerify: ['id', 'Product ID', 'Product Name', 'Description', 'Active', 'Required Documents/Fields']
  },
  {
    name: '13. NBFC (NBFC Partners)',
    url: `${BASE_URL}/NBFC`,
    table: 'NBFC Partners',
    data: {
      id: 'NBFC-TEST-' + Date.now(),
      'Lender ID': 'NBFC-TEST-' + Date.now(),
      'Lender Name': 'Test NBFC Bank',
      'Contact Person': 'Jane Smith',
      'Contact Email/Phone': 'nbfc@test.com / +91 9876543212',
      'Address/Region': 'Mumbai, Maharashtra',
      'Active': 'True'
    },
    fieldsToVerify: ['id', 'Lender ID', 'Lender Name', 'Contact Person', 'Contact Email/Phone', 'Address/Region', 'Active']
  }
];

const testResults = [];
let postedRecords = {}; // Store posted data by table name

async function testWebhook(test) {
  try {
    console.log(`\n🧪 Testing: ${test.name}`);
    console.log(`   URL: ${test.url}`);
    
    const response = await fetch(test.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(test.data),
    });

    const responseText = await response.text();
    
    if (!response.ok) {
      console.log(`   ❌ Failed: ${response.status} ${response.statusText}`);
      console.log(`   Response: ${responseText}`);
      return { 
        name: test.name,
        success: false, 
        status: response.status,
        error: responseText,
        postedData: test.data
      };
    }

    let result;
    if (responseText.trim() === '') {
      result = { success: true, message: 'Empty response' };
    } else {
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        result = { message: responseText };
      }
    }

    console.log(`   ✅ POST SUCCESS (${response.status})`);
    if (result.id) {
      console.log(`   Record ID: ${result.id}`);
    }
    
    // Store posted data for verification
    postedRecords[test.table] = {
      ...test.data,
      airtableId: result.id || test.data.id
    };
    
    return { 
      name: test.name,
      success: true, 
      status: response.status,
      result,
      postedData: test.data,
      table: test.table
    };
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return { 
      name: test.name,
      success: false, 
      error: error.message,
      postedData: test.data
    };
  }
}

function normalizeValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  return String(value);
}

function verifyFieldMatch(postedValue, retrievedValue, fieldName) {
  const normalizedPosted = normalizeValue(postedValue);
  const normalizedRetrieved = normalizeValue(retrievedValue);
  
  // Special handling for empty strings vs null/undefined
  if (normalizedPosted === '' && (normalizedRetrieved === '' || normalizedRetrieved === null || normalizedRetrieved === undefined)) {
    return true;
  }
  
  return normalizedPosted === normalizedRetrieved;
}

async function verifyRetrievedData() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 VERIFYING RETRIEVED DATA VIA GET');
  console.log('='.repeat(80));
  
  try {
    const response = await fetch(GET_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const responseText = await response.text();
    
    if (!response.ok) {
      console.log(`❌ GET Failed: ${response.status} ${response.statusText}`);
      console.log(`Response: ${responseText}`);
      return null;
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.log('❌ Failed to parse GET response as JSON');
      console.log('Response:', responseText.substring(0, 500));
      return null;
    }

    console.log(`✅ GET Success (${response.status})`);
    
    // Verify each posted record
    let verificationResults = [];
    
    for (const test of webhookTests) {
      if (!testResults.find(r => r.name === test.name && r.success)) {
        continue; // Skip failed POSTs
      }
      
      const postedData = postedRecords[test.table];
      if (!postedData) continue;
      
      console.log(`\n📋 Verifying: ${test.name}`);
      console.log(`   Table: ${test.table}`);
      console.log(`   Posted ID: ${postedData.id || postedData.airtableId}`);
      
      // GET response might be a single record or an array of records
      // Or it might be structured by table name
      let tableData = null;
      
      // Try structured format first (by table name)
      if (data[test.table] && Array.isArray(data[test.table])) {
        tableData = data[test.table];
      } 
      // Try if data is directly an array
      else if (Array.isArray(data)) {
        tableData = data;
      }
      // Try if data is a single record object
      else if (data && typeof data === 'object' && data.id) {
        tableData = [data];
      }
      // Try alternative table name formats
      else {
        // Try different table name variations
        const altNames = [
          test.table,
          test.table.toLowerCase(),
          test.table.replace(/\s+/g, ''),
          test.table.replace(/\s+/g, '_'),
        ];
        
        for (const altName of altNames) {
          if (data[altName] && Array.isArray(data[altName])) {
            tableData = data[altName];
            break;
          }
        }
      }
      
      if (!tableData || !Array.isArray(tableData)) {
        console.log(`   ❌ Table "${test.table}" not found in GET response`);
        console.log(`   Available keys: ${Object.keys(data).slice(0, 10).join(', ')}...`);
        verificationResults.push({
          test: test.name,
          table: test.table,
          success: false,
          error: 'Table not found in GET response',
          availableKeys: Object.keys(data)
        });
        continue;
      }
      
      // Find the record by ID (try both our ID and Airtable record ID)
      const record = tableData.find(r => {
        const recordId = r.id || r['id'];
        const activityId = r['Activity ID'] || r['activityId'];
        const mappingId = r['Mapping ID'] || r['mappingId'];
        const ledgerId = r['Ledger Entry ID'] || r['ledgerEntryId'];
        const creditUserId = r['Credit User ID'] || r['creditUserId'];
        const kamId = r['KAM ID'] || r['kamId'];
        const productId = r['Product ID'] || r['productId'];
        const lenderId = r['Lender ID'] || r['lenderId'];
        const fieldId = r['Field ID'] || r['fieldId'];
        const categoryId = r['Category ID'] || r['categoryId'];
        const fileId = r['File ID'] || r['fileId'];
        const username = r['Username'] || r['username'];
        
        // Match by various ID fields
        return recordId === postedData.id || 
               recordId === postedData.airtableId ||
               activityId === postedData['Activity ID'] ||
               mappingId === postedData['Mapping ID'] ||
               ledgerId === postedData['Ledger Entry ID'] ||
               creditUserId === postedData['Credit User ID'] ||
               kamId === postedData['KAM ID'] ||
               productId === postedData['Product ID'] ||
               lenderId === postedData['Lender ID'] ||
               fieldId === postedData['Field ID'] ||
               categoryId === postedData['Category ID'] ||
               fileId === postedData['File ID'] ||
               username === postedData['Username'];
      });
      
      if (!record) {
        console.log(`   ❌ Record not found in GET response`);
        console.log(`   Searched for ID: ${postedData.id || postedData.airtableId}`);
        verificationResults.push({
          test: test.name,
          table: test.table,
          success: false,
          error: 'Record not found in GET response'
        });
        continue;
      }
      
      console.log(`   ✅ Record found: ${record.id || record['id']}`);
      
      // Verify each field
      let allFieldsMatch = true;
      let fieldMismatches = [];
      
      for (const fieldName of test.fieldsToVerify) {
        const postedValue = postedData[fieldName];
        const retrievedValue = record[fieldName];
        
        const matches = verifyFieldMatch(postedValue, retrievedValue, fieldName);
        
        if (!matches) {
          allFieldsMatch = false;
          fieldMismatches.push({
            field: fieldName,
            posted: postedValue,
            retrieved: retrievedValue
          });
        }
      }
      
      if (allFieldsMatch) {
        console.log(`   ✅ All ${test.fieldsToVerify.length} fields match!`);
        verificationResults.push({
          test: test.name,
          table: test.table,
          success: true,
          fieldsVerified: test.fieldsToVerify.length
        });
      } else {
        console.log(`   ❌ Field mismatches found:`);
        fieldMismatches.forEach(m => {
          console.log(`      - ${m.field}:`);
          console.log(`        Posted: "${m.posted}"`);
          console.log(`        Retrieved: "${m.retrieved}"`);
        });
        verificationResults.push({
          test: test.name,
          table: test.table,
          success: false,
          fieldMismatches
        });
      }
    }
    
    return {
      data,
      verificationResults
    };
  } catch (error) {
    console.error(`❌ GET Error: ${error.message}`);
    return null;
  }
}

async function runAllTests() {
  console.log('🚀 Starting Complete POST Webhook Test Suite with GET Verification');
  console.log('='.repeat(80));
  console.log(`Total webhooks to test: ${webhookTests.length}`);
  console.log('='.repeat(80));
  
  // Test all POST webhooks
  for (const test of webhookTests) {
    const result = await testWebhook(test);
    testResults.push(result);
    
    // Wait 500ms between tests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 POST TESTS SUMMARY');
  console.log('='.repeat(80));
  
  const passed = testResults.filter(r => r.success).length;
  const failed = testResults.filter(r => !r.success).length;
  
  console.log(`✅ Passed: ${passed}/${webhookTests.length}`);
  console.log(`❌ Failed: ${failed}/${webhookTests.length}`);
  
  // Wait before GET verification
  console.log('\n' + '='.repeat(80));
  console.log('⏳ Waiting 3 seconds before GET verification...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Verify with GET
  const verification = await verifyRetrievedData();
  
  // Final summary
  console.log('\n' + '='.repeat(80));
  console.log('🎯 FINAL SUMMARY');
  console.log('='.repeat(80));
  console.log(`POST Tests: ${passed}/${webhookTests.length} passed`);
  
  if (verification && verification.verificationResults) {
    const verified = verification.verificationResults.filter(r => r.success).length;
    const totalVerified = verification.verificationResults.length;
    console.log(`GET Verification: ${verified}/${totalVerified} records verified`);
    
    if (verified === totalVerified) {
      console.log('✅ All posted data successfully retrieved and verified!');
    } else {
      console.log('⚠️ Some records could not be verified');
    }
  } else {
    console.log('GET Verification: ❌ Failed');
  }
  
  console.log('='.repeat(80));
  
  return {
    postResults: testResults,
    verification,
    summary: {
      total: webhookTests.length,
      passed,
      failed
    }
  };
}

// Run tests
runAllTests()
  .then((results) => {
    console.log('\n✅ Test suite completed!');
    process.exit(results.summary.failed > 0 ? 1 : 0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

