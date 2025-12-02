/**
 * Test all POST webhooks with correct field mappings
 */

import fetch from 'node-fetch';

const baseUrl = 'https://fixrrahul.app.n8n.cloud/webhook';

// Test data for each webhook with exact fields
const webhookTests = [
  {
    name: '1. POSTLOG (Admin Activity Log)',
    url: `${baseUrl}/POSTLOG`,
    data: {
      id: `TEST-POSTLOG-${Date.now()}`,
      'Activity ID': `ACT-TEST-${Date.now()}`,
      'Timestamp': new Date().toISOString(),
      'Performed By': 'Test User',
      'Action Type': 'Test Action',
      'Description/Details': 'Test execution for POSTLOG webhook',
      'Target Entity': 'Test Entity'
    }
  },
  {
    name: '2. POSTCLIENTFORMMAPPING (Client Form Mapping)',
    url: `${baseUrl}/POSTCLIENTFORMMAPPING`,
    data: {
      id: `MAP-TEST-${Date.now()}`,
      'Mapping ID': `MAP-TEST-${Date.now()}`,
      'Client': 'Test Corporation Pvt Ltd',
      'Category': 'Personal Information',
      'Is Required': 'True',
      'Display Order': '1'
    }
  },
  {
    name: '3. COMISSIONLEDGER (Commission Ledger)',
    url: `${baseUrl}/COMISSIONLEDGER`,
    data: {
      id: `LEDGER-TEST-${Date.now()}`,
      'Ledger Entry ID': `LEDGER-TEST-${Date.now()}`,
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
    url: `${baseUrl}/CREDITTEAMUSERS`,
    data: {
      id: `CREDIT-TEST-${Date.now()}`,
      'Credit User ID': `CREDIT-TEST-${Date.now()}`,
      'Name': 'John Credit Analyst',
      'Email': 'credit.analyst@test.com',
      'Phone': '+91 9876543210',
      'Role': 'credit_team',
      'Status': 'Active'
    }
  },
  {
    name: '5. DAILYSUMMARY (Daily Summary Reports)',
    url: `${baseUrl}/DAILYSUMMARY`,
    data: {
      id: `SUMMARY-TEST-${Date.now()}`,
      'Report Date': new Date().toISOString().split('T')[0],
      'Summary Content': 'Test daily summary report content',
      'Generated Timestamp': new Date().toISOString(),
      'Delivered To': 'credit_team, kam'
    }
  },
  {
    name: '6. FILEAUDITLOGGING (File Auditing Log)',
    url: `${baseUrl}/FILEAUDITLOGGING`,
    data: {
      id: `AUDIT-TEST-${Date.now()}`,
      'Log Entry ID': `AUDIT-TEST-${Date.now()}`,
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
    url: `${baseUrl}/FormCategory`,
    data: {
      id: `CATEGORY-TEST-${Date.now()}`,
      'Category ID': `CAT-TEST-${Date.now()}`,
      'Category Name': 'Test Category',
      'Description': 'Test form category description',
      'Display Order': '1',
      'Active': 'True'
    }
  },
  {
    name: '8. FormCategory (Form Fields)',
    url: `${baseUrl}/FormCategory`,
    data: {
      id: `FIELD-TEST-${Date.now()}`,
      'Field ID': `FIELD-TEST-${Date.now()}`,
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
    url: `${baseUrl}/KAMusers`,
    data: {
      id: `KAM-TEST-${Date.now()}`,
      'KAM ID': `KAM-TEST-${Date.now()}`,
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
    url: `${baseUrl}/applications`,
    data: {
      id: `APP-TEST-${Date.now()}`,
      'File ID': `SF${Date.now()}`,
      'Client': 'Test Corporation Pvt Ltd',
      'Applicant Name': 'John Doe',
      'Loan Product': 'Personal Loan',
      'Requested Loan Amount': '5000000',
      'Documents': 'pan:doc1.pdf,aadhar:doc2.pdf',
      'Status': 'draft',
      'Assigned Credit Analyst': '',
      'Assigned NBFC': '',
      'Lender Decision Status': '',
      'Lender Decision Date': '',
      'Lender Decision Remarks': '',
      'Approved Loan Amount': '',
      'AI File Summary': '',
      'Form Data': JSON.stringify({ name: 'John Doe', pan: 'ABCDE1234F' }),
      'Creation Date': new Date().toISOString().split('T')[0],
      'Submitted Date': '',
      'Last Updated': new Date().toISOString()
    }
  },
  {
    name: '11. adduser (User Accounts)',
    url: `${baseUrl}/adduser`,
    data: {
      id: `USER-TEST-${Date.now()}`,
      'Username': 'testuser@example.com',
      'Password': 'Test@123456',
      'Role': 'client',
      'Associated Profile': 'Test Corporation Pvt Ltd',
      'Last Login': new Date().toISOString(),
      'Account Status': 'Active'
    }
  },
  {
    name: '12. loadprod (Loan Products)',
    url: `${baseUrl}/loadprod`,
    data: {
      id: `PROD-TEST-${Date.now()}`,
      'Product ID': `PROD-TEST-${Date.now()}`,
      'Product Name': 'Test Personal Loan',
      'Description': 'Test loan product description',
      'Active': 'True',
      'Required Documents/Fields': 'PAN, Aadhar, Bank Statement'
    }
  },
  {
    name: '13. NBFC (NBFC Partners)',
    url: `${baseUrl}/NBFC`,
    data: {
      id: `NBFC-TEST-${Date.now()}`,
      'Lender ID': `NBFC-TEST-${Date.now()}`,
      'Lender Name': 'Test NBFC Bank',
      'Contact Person': 'John NBFC Manager',
      'Contact Email/Phone': 'nbfc@test.com / +91 9876543212',
      'Address/Region': 'Mumbai, Maharashtra',
      'Active': 'True'
    }
  }
];

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
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }

    if (response.ok) {
      console.log(`   ✅ SUCCESS (${response.status})`);
      console.log(`   Response:`, JSON.stringify(responseData, null, 2).substring(0, 200));
    } else {
      console.log(`   ❌ FAILED (${response.status})`);
      console.log(`   Error:`, responseData);
    }
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}`);
  }
}

async function runAllTests() {
  console.log('🚀 Starting POST webhook tests...\n');
  console.log(`Total webhooks to test: ${webhookTests.length}\n`);
  
  for (const test of webhookTests) {
    await testWebhook(test);
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n✅ All tests completed!');
}

runAllTests().catch(console.error);

