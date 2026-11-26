function requiredN8nOrigin(name) {
  const raw = String(process.env[name] || '').trim().replace(/\/+$/, '').replace(/\/webhook$/i, '');
  if (!raw) {
    console.error(name + ' is required. Refusing to fall back to the old n8n host.');
    process.exit(1);
  }
  return raw;
}

/**
 * Test all webhooks one by one with exact field mappings
 */

import fetch from 'node-fetch';

// Test configurations - each with exact fields from n8n schema
const webhookTests = [
  {
    name: '1. POSTLOG (Admin Activity Log)',
    url: `${requiredN8nOrigin('N8N_LMS_BASE_URL')}/webhook/POSTLOG`,
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
    url: `${requiredN8nOrigin('N8N_LEGACY_BASE_URL')}/webhook/POSTCLIENTFORMMAPPING`,
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
    url: `${requiredN8nOrigin('N8N_LMS_BASE_URL')}/webhook/COMISSIONLEDGER`,
    data: {
      id: 'LEDGER-TEST-' + Date.now(),
      'Ledger Entry ID': 'LEDGER-TEST-' + Date.now(),
      'Client': 'Test Corporation Pvt Ltd',
      'Loan File': 'SF20250101001',
      'Date': '2025-01-15',
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
    url: `${requiredN8nOrigin('N8N_LMS_BASE_URL')}/webhook/CREDITTEAMUSERS`,
    data: {
      id: 'CREDIT-TEST-' + Date.now(),
      'Credit User ID': 'CREDIT-TEST-' + Date.now(),
      'Name': 'John Credit Analyst',
      'Email': 'credit.analyst@test.com',
      'Phone': '+91 9876543212',
      'Role': 'credit_team',
      'Status': 'Active'
    }
  },
  {
    name: '5. DAILYSUMMARY (Daily Summary Reports)',
    url: `${requiredN8nOrigin('N8N_LMS_BASE_URL')}/webhook/DAILYSUMMARY`,
    data: {
      id: 'SUMMARY-' + new Date().toISOString().split('T')[0].replace(/-/g, ''),
      'Report Date': new Date().toISOString().split('T')[0],
      'Summary Content': 'Daily summary report test - Total applications: 25. Approved: 8.',
      'Generated Timestamp': new Date().toISOString(),
      'Delivered To': ['Email to Management', 'Dashboard']
    }
  },
  {
    name: '6. FILEAUDITLOGGING (File Audit Log)',
    url: `${requiredN8nOrigin('N8N_LEGACY_BASE_URL')}/webhook/FILEAUDITLOGGING`,
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
    name: '7. FormCategory (Form Fields)',
    url: `${requiredN8nOrigin('N8N_LEGACY_BASE_URL')}/webhook/FormCategory`,
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
    name: '8. FormCategory (Form Categories)',
    url: `${requiredN8nOrigin('N8N_LEGACY_BASE_URL')}/webhook/FormCategory`,
    data: {
      id: 'CAT-TEST-' + Date.now(),
      'Category ID': 'CAT-TEST-' + Date.now(),
      'Category Name': 'Personal Information',
      'Description': 'Category for personal information fields',
      'Display Order': '1',
      'Active': 'True'
    }
  },
  {
    name: '9. KAMusers (KAM Users)',
    url: `${requiredN8nOrigin('N8N_LMS_BASE_URL')}/webhook/KAMusers`,
    data: {
      id: 'KAM-TEST-' + Date.now(),
      'KAM ID': 'KAM-TEST-' + Date.now(),
      'Name': 'John KAM Manager',
      'Email': 'kam.manager@test.com',
      'Phone': '+91 9876543211',
      'Managed Clients': 'Test Corporation Pvt Ltd, ABC Industries',
      'Role': 'kam',
      'Status': 'Active'
    }
  },
  {
    name: '10. applications (Loan Applications)',
    url: `${requiredN8nOrigin('N8N_LEGACY_BASE_URL')}/webhook/applications`,
    data: {
      id: 'APP-TEST-' + Date.now(),
      'File ID': 'SF20250115001',
      'Client': 'Test Corporation Pvt Ltd',
      'Applicant Name': 'John Doe',
      'Loan Product': 'Home Loan',
      'Requested Loan Amount': '5000000',
      'Documents': 'Aadhar, PAN, Salary Slip',
      'Status': 'pending_kam_review',
      'Assigned Credit Analyst': 'Credit Analyst 1',
      'Assigned NBFC': '',
      'Lender Decision Status': '',
      'Lender Decision Date': '',
      'Lender Decision Remarks': '',
      'Approved Loan Amount': '',
      'AI File Summary': 'Applicant has good credit history and stable income',
      'Form Data': '{"property_type": "Residential", "property_value": 7000000}',
      'Creation Date': '2025-01-15',
      'Submitted Date': '2025-01-15',
      'Last Updated': new Date().toISOString()
    }
  },
  {
    name: '11. adduser (User Accounts)',
    url: `${requiredN8nOrigin('N8N_LMS_BASE_URL')}/webhook/adduser`,
    data: {
      id: 'USER-TEST-' + Date.now(),
      'Username': 'testuser@example.com',
      'Password': 'Test@123456',
      'Role': 'client',
      'Associated Profile': 'Test Corporation Pvt Ltd',
      'Last Login': new Date().toISOString(),
      'Account Status': 'Active'
    }
  },
  {
    name: '12. applications (NBFC Partners)',
    url: `${requiredN8nOrigin('N8N_LEGACY_BASE_URL')}/webhook/applications`,
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

async function testWebhook(test) {
  try {
    console.log(`\n${test.name}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📡 URL: ${test.url}`);
    console.log(`📋 Data: ${JSON.stringify(test.data, null, 2)}`);
    
    const response = await fetch(test.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(test.data),
    });

    const responseText = await response.text();
    
    if (!response.ok) {
      console.log(`❌ Failed: ${response.status} ${response.statusText}`);
      console.log(`Response: ${responseText}`);
      return { success: false, error: responseText };
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

    console.log(`✅ Success`);
    console.log(`Response: ${JSON.stringify(result, null, 2)}`);
    return { success: true, result };
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runAllTests() {
  console.log('🧪 Testing All Webhooks - One by One');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const results = [];
  
  for (const test of webhookTests) {
    const result = await testWebhook(test);
    results.push({ name: test.name, ...result });
    
    // Wait 1 second between tests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Summary:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.name}`);
  });
  
  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;
  
  console.log(`\n✅ ${successCount}/${totalCount} webhooks successful`);
}

// Run tests
runAllTests().catch(console.error);

