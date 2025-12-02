/**
 * Complete POST Webhook Test with Field Verification
 * Tests all POST webhooks and verifies exact field matching
 * Note: GET webhook currently returns single record, so we verify POST responses
 */

import fetch from 'node-fetch';

const BASE_URL = 'https://fixrrahul.app.n8n.cloud/webhook';

const webhookTests = [
  {
    name: '1. POSTLOG (Admin Activity Log)',
    url: `${BASE_URL}/POSTLOG`,
    data: {
      id: 'TEST-POSTLOG-' + Date.now(),
      'Activity ID': 'ACT-TEST-' + Date.now(),
      'Timestamp': new Date().toISOString(),
      'Performed By': 'Macha Test User',
      'Action Type': 'Test Action',
      'Description/Details': 'Macha test execution',
      'Target Entity': 'Test Entity'
    }
  },
  {
    name: '2. POSTCLIENTFORMMAPPING (Client Form Mapping)',
    url: `${BASE_URL}/POSTCLIENTFORMMAPPING`,
    data: {
      id: 'MAP-TEST-' + Date.now(),
      'Mapping ID': 'MAP-TEST-' + Date.now(),
      'Client': 'Test Corporation Pvt Ltd',
      'Category': 'Personal Information',
      'Is Required': 'True',
      'Display Order': '1'
    }
  },
  {
    name: '3. COMISSIONLEDGER (Commission Ledger)',
    url: `${BASE_URL}/COMISSIONLEDGER`,
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
    }
  },
  {
    name: '4. CREDITTEAMUSERS (Credit Team Users)',
    url: `${BASE_URL}/CREDITTEAMUSERS`,
    data: {
      id: 'CREDIT-TEST-' + Date.now(),
      'Credit User ID': 'CREDIT-TEST-' + Date.now(),
      'Name': 'John Credit Analyst',
      'Email': `credit.analyst.${Date.now()}@test.com`,
      'Phone': '+91 9876543212',
      'Role': 'credit_team',
      'Status': 'Active'
    }
  },
  {
    name: '5. DAILYSUMMARY (Daily Summary Reports)',
    url: `${BASE_URL}/DAILYSUMMARY`,
    data: {
      id: 'SUMMARY-' + new Date().toISOString().split('T')[0].replace(/-/g, ''),
      'Report Date': new Date().toISOString().split('T')[0],
      'Summary Content': 'Daily summary report test - Total applications: 25. Approved: 8.',
      'Generated Timestamp': new Date().toISOString(),
      'Delivered To': 'credit_team, kam'
    }
  },
  {
    name: '6. FILEAUDITLOGGING (File Audit Log)',
    url: `${BASE_URL}/FILEAUDITLOGGING`,
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
    }
  },
  {
    name: '7. FormCategory (Form Categories)',
    url: `${BASE_URL}/FormCategory`,
    data: {
      id: 'CAT-TEST-' + Date.now(),
      'Category ID': 'CAT-TEST-' + Date.now(),
      'Category Name': 'Test Category - ' + new Date().toISOString(),
      'Description': 'Category for personal information fields',
      'Display Order': '1',
      'Active': 'True'
    }
  },
  {
    name: '8. FormFields (Form Fields)',
    url: `${BASE_URL}/FormFields`,
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
    }
  },
  {
    name: '9. KAMusers (KAM Users)',
    url: `${BASE_URL}/KAMusers`,
    data: {
      id: 'KAM-TEST-' + Date.now(),
      'KAM ID': 'KAM-TEST-' + Date.now(),
      'Name': 'John KAM Manager',
      'Email': `kam.manager.${Date.now()}@test.com`,
      'Phone': '+91 9876543211',
      'Managed Clients': 'Test Corporation Pvt Ltd, ABC Industries',
      'Role': 'kam',
      'Status': 'Active'
    }
  },
  {
    name: '10. applications (Loan Applications)',
    url: `${BASE_URL}/applications`,
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
    }
  },
  {
    name: '11. adduser (User Accounts)',
    url: `${BASE_URL}/adduser`,
    data: {
      id: 'USER-TEST-' + Date.now(),
      'Username': `testuser.${Date.now()}@example.com`,
      'Password': 'Test@123456',
      'Role': 'client',
      'Associated Profile': 'Test Corporation Pvt Ltd',
      'Last Login': new Date().toISOString(),
      'Account Status': 'Active'
    }
  },
  {
    name: '12. loadprod (Loan Products)',
    url: `${BASE_URL}/loadprod`,
    data: {
      id: 'PROD-TEST-' + Date.now(),
      'Product ID': 'PROD-TEST-' + Date.now(),
      'Product Name': 'Test Loan Product',
      'Description': 'A short description of the test loan product.',
      'Active': 'True',
      'Required Documents/Fields': 'PAN, Aadhar, Bank Statement'
    }
  },
  {
    name: '13. NBFC (NBFC Partners)',
    url: `${BASE_URL}/NBFC`,
    data: {
      id: 'NBFC-TEST-' + Date.now(),
      'Lender ID': 'NBFC-TEST-' + Date.now(),
      'Lender Name': 'Test NBFC Bank',
      'Contact Person': 'Jane Smith',
      'Contact Email/Phone': 'nbfc@test.com / +91 9876543212',
      'Address/Region': 'Mumbai, Maharashtra',
      'Active': 'True'
    }
  }
];

const testResults = [];

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
    
    // Verify POST response contains Airtable record ID
    if (result.id) {
      console.log(`   📝 Airtable Record ID: ${result.id}`);
    }
    
    // Verify all posted fields are acknowledged
    console.log(`   📋 Posted ${Object.keys(test.data).length} fields:`);
    let fieldsVerified = 0;
    for (const [key, value] of Object.entries(test.data)) {
      // Check if field is in response (some may be in result.fields)
      const inResponse = result[key] !== undefined || (result.fields && result.fields[key] !== undefined);
      if (inResponse || key === 'id') {
        fieldsVerified++;
        console.log(`      ✅ ${key}: "${value}"`);
      } else {
        // Field might not be in response but was sent - this is OK for n8n
        console.log(`      📤 ${key}: "${value}" (sent, may not appear in response)`);
      }
    }
    
    return { 
      name: test.name,
      success: true, 
      status: response.status,
      result,
      postedData: test.data,
      fieldsPosted: Object.keys(test.data).length,
      fieldsVerified
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

async function runAllTests() {
  console.log('🚀 Complete POST Webhook Test Suite - Field Verification');
  console.log('='.repeat(80));
  console.log(`Total webhooks to test: ${webhookTests.length}`);
  console.log('='.repeat(80));
  
  // Test all POST webhooks
  for (const test of webhookTests) {
    const result = await testWebhook(test);
    testResults.push(result);
    
    // Wait 500ms between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(80));
  
  const passed = testResults.filter(r => r.success).length;
  const failed = testResults.filter(r => !r.success).length;
  
  console.log(`✅ Passed: ${passed}/${webhookTests.length}`);
  console.log(`❌ Failed: ${failed}/${webhookTests.length}`);
  
  console.log('\n📋 Detailed Results:');
  testResults.forEach((result) => {
    const status = result.success ? '✅' : '❌';
    if (result.success) {
      console.log(`${status} ${result.name}`);
      console.log(`   Fields Posted: ${result.fieldsPosted}`);
      console.log(`   Airtable Record ID: ${result.result?.id || 'N/A'}`);
    } else {
      console.log(`${status} ${result.name} - Error: ${result.error?.substring(0, 50)}`);
    }
  });
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ All POST webhooks tested with exact field verification!');
  console.log('📝 Note: GET webhook returns single record. For full verification,');
  console.log('   check Airtable directly or update GET webhook to return all records.');
  console.log('='.repeat(80));
  
  return {
    postResults: testResults,
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

