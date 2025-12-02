/**
 * Test POST to Loan Applications Webhook
 * Tests: https://fixrrahul.app.n8n.cloud/webhook/applications
 */

import fetch from 'node-fetch';

const WEBHOOK_URL = 'https://fixrrahul.app.n8n.cloud/webhook/applications';

// Test data with exact fields as specified
const testData = {
  id: 'APP-TEST-' + Date.now(), // for matching
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
  'AI File Summary': '',
  'Form Data': JSON.stringify({
    property_type: 'Residential',
    property_value: 7000000,
    employment_type: 'Salaried'
  }),
  'Creation Date': new Date().toISOString().split('T')[0],
  'Submitted Date': '',
  'Last Updated': new Date().toISOString()
};

async function testApplicationsPost() {
  try {
    console.log('🧪 Testing Loan Applications POST Webhook\n');
    console.log('URL:', WEBHOOK_URL);
    console.log('\n📤 Sending data:');
    console.log(JSON.stringify(testData, null, 2));
    console.log('\n' + '-'.repeat(60) + '\n');

    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    });

    const responseText = await response.text();
    
    console.log('📥 Response Status:', response.status, response.statusText);
    console.log('📥 Response Headers:', Object.fromEntries(response.headers.entries()));
    console.log('\n📥 Response Body:');
    
    if (responseText.trim() === '') {
      console.log('(Empty response)');
    } else {
      try {
        const jsonResponse = JSON.parse(responseText);
        console.log(JSON.stringify(jsonResponse, null, 2));
      } catch (e) {
        console.log(responseText);
      }
    }

    console.log('\n' + '-'.repeat(60) + '\n');

    if (response.ok) {
      console.log('✅ SUCCESS: Loan Application created successfully!');
      console.log('\nTest data sent (all 19 fields):');
      console.log('1. id:', testData.id);
      console.log('2. File ID:', testData['File ID']);
      console.log('3. Client:', testData['Client']);
      console.log('4. Applicant Name:', testData['Applicant Name']);
      console.log('5. Loan Product:', testData['Loan Product']);
      console.log('6. Requested Loan Amount:', testData['Requested Loan Amount']);
      console.log('7. Documents:', testData['Documents']);
      console.log('8. Status:', testData['Status']);
      console.log('9. Assigned Credit Analyst:', testData['Assigned Credit Analyst'] || '(empty)');
      console.log('10. Assigned NBFC:', testData['Assigned NBFC'] || '(empty)');
      console.log('11. Lender Decision Status:', testData['Lender Decision Status'] || '(empty)');
      console.log('12. Lender Decision Date:', testData['Lender Decision Date'] || '(empty)');
      console.log('13. Lender Decision Remarks:', testData['Lender Decision Remarks'] || '(empty)');
      console.log('14. Approved Loan Amount:', testData['Approved Loan Amount'] || '(empty)');
      console.log('15. AI File Summary:', testData['AI File Summary'] || '(empty)');
      console.log('16. Form Data:', testData['Form Data']);
      console.log('17. Creation Date:', testData['Creation Date']);
      console.log('18. Submitted Date:', testData['Submitted Date'] || '(empty)');
      console.log('19. Last Updated:', testData['Last Updated']);
    } else {
      console.log('❌ FAILED:', response.status, response.statusText);
      console.log('Response:', responseText);
    }

    return {
      success: response.ok,
      status: response.status,
      data: responseText,
    };
  } catch (error) {
    console.error('❌ Error:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Run test
testApplicationsPost()
  .then((result) => {
    console.log('\n📊 Test Result:', result.success ? '✅ PASS' : '❌ FAIL');
    process.exit(result.success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

