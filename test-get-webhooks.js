/**
 * Test all n8n GET webhooks
 * Tests response format, field presence, and data structure
 */

import fetch from 'node-fetch';

const N8N_BASE_URL = 'https://fixrrahul.app.n8n.cloud';

// All GET webhooks from n8n "ALL GET WEBHOOKS" flow
const webhooks = [
  { name: 'Admin Activity', path: 'Adminactivity', table: 'Admin Activity log', expectedFields: ['id', 'Activity ID', 'Timestamp', 'Performed By', 'Action Type'] },
  { name: 'User Accounts', path: 'useraccount', table: 'User Accounts', expectedFields: ['id', 'Username', 'Password', 'Role', 'Account Status', 'Associated Profile'] },
  { name: 'Client Form Mapping', path: 'clientformmapping', table: 'Client Form Mapping', expectedFields: ['id', 'Mapping ID', 'Client', 'Category', 'Is Required'] },
  { name: 'Clients', path: 'client', table: 'Clients', expectedFields: ['id', 'Client ID', 'Client Name', 'Assigned KAM', 'Status'] },
  { name: 'Commission Ledger', path: 'commisionledger', table: 'Commission Ledger', expectedFields: ['id', 'Ledger Entry ID', 'Client', 'Loan File', 'Date', 'Payout Amount'] },
  { name: 'Credit Team Users', path: 'creditteamuser', table: 'Credit Team Users', expectedFields: ['id', 'Credit User ID', 'Name', 'Email', 'Role', 'Status'] },
  { name: 'Daily Summary Reports', path: 'dailysummaryreport', table: 'Daily summary Reports', expectedFields: ['id', 'Report Date', 'Summary Content'] },
  { name: 'File Auditing Log', path: 'fileauditinglog', table: 'File Auditing Log', expectedFields: ['id', 'Log Entry ID', 'File', 'Timestamp', 'Actor', 'Action/Event Type'] },
  { name: 'Form Categories', path: 'formcategories', table: 'Form Categories', expectedFields: ['id', 'Category ID', 'Category Name', 'Display Order', 'Active'] },
  { name: 'Form Fields', path: 'formfields', table: 'Form Fields', expectedFields: ['id', 'Field ID', 'Category', 'Field Label', 'Field Type', 'Is Mandatory'] },
  { name: 'KAM Users', path: 'kamusers', table: 'KAM Users', expectedFields: ['id', 'KAM ID', 'Name', 'Email', 'Role', 'Status'] },
  { name: 'Loan Applications', path: 'loanapplication', table: 'Loan Applications', expectedFields: ['id', 'File ID', 'Client', 'Status', 'Applicant Name', 'Loan Product'] },
  { name: 'Loan Products', path: 'loanproducts', table: 'Loan Products', expectedFields: ['id', 'Product ID', 'Product Name', 'Active'] },
  { name: 'NBFC Partners', path: 'nbfcpartners', table: 'NBFC Partners', expectedFields: ['id', 'Lender ID', 'Lender Name', 'Active'] },
  { name: 'Notifications', path: 'notifications', table: 'Notifications', expectedFields: ['id', 'Notification ID', 'Recipient User', 'Title', 'Message', 'Is Read'] },
];

/**
 * Analyze response format
 */
function analyzeResponseFormat(data) {
  const analysis = {
    isArray: Array.isArray(data),
    isObject: typeof data === 'object' && data !== null && !Array.isArray(data),
    hasRecords: false,
    hasData: false,
    isAirtableFormat: false,
    isFlattened: false,
    recordCount: 0,
    structure: 'unknown',
  };

  if (Array.isArray(data)) {
    analysis.recordCount = data.length;
    analysis.structure = 'array';
    
    if (data.length > 0) {
      const firstRecord = data[0];
      // Check if Airtable format (has 'fields' property)
      if (firstRecord && typeof firstRecord === 'object' && 'fields' in firstRecord) {
        analysis.isAirtableFormat = true;
        analysis.structure = 'array_airtable';
      } else {
        analysis.isFlattened = true;
        analysis.structure = 'array_flattened';
      }
    }
  } else if (typeof data === 'object' && data !== null) {
    if ('records' in data && Array.isArray(data.records)) {
      analysis.hasRecords = true;
      analysis.recordCount = data.records.length;
      analysis.structure = 'object_with_records';
      
      if (data.records.length > 0) {
        const firstRecord = data.records[0];
        if (firstRecord && typeof firstRecord === 'object' && 'fields' in firstRecord) {
          analysis.isAirtableFormat = true;
        } else {
          analysis.isFlattened = true;
        }
      }
    } else if ('data' in data && Array.isArray(data.data)) {
      analysis.hasData = true;
      analysis.recordCount = data.data.length;
      analysis.structure = 'object_with_data';
      
      if (data.data.length > 0) {
        const firstRecord = data.data[0];
        if (firstRecord && typeof firstRecord === 'object' && 'fields' in firstRecord) {
          analysis.isAirtableFormat = true;
        } else {
          analysis.isFlattened = true;
        }
      }
    } else {
      // Check if it's a single record
      if ('id' in data) {
        analysis.recordCount = 1;
        analysis.structure = 'single_record';
        if ('fields' in data) {
          analysis.isAirtableFormat = true;
        } else {
          analysis.isFlattened = true;
        }
      }
    }
  }

  return analysis;
}

/**
 * Check for required fields in records
 */
function checkFields(records, expectedFields) {
  if (!Array.isArray(records) || records.length === 0) {
    return {
      missingFields: expectedFields,
      presentFields: [],
      fieldCoverage: 0,
    };
  }

  const firstRecord = records[0];
  const recordFields = Object.keys(firstRecord);
  
  // Handle Airtable format
  const actualFields = firstRecord.fields ? Object.keys(firstRecord.fields) : recordFields;
  
  const missingFields = expectedFields.filter(field => !actualFields.includes(field));
  const presentFields = expectedFields.filter(field => actualFields.includes(field));
  const fieldCoverage = (presentFields.length / expectedFields.length) * 100;

  return {
    missingFields,
    presentFields,
    fieldCoverage,
    allFields: actualFields,
  };
}

/**
 * Test a single webhook
 */
async function testWebhook(webhook) {
  const url = `${N8N_BASE_URL}/webhook/${webhook.path}`;
  const result = {
    name: webhook.name,
    path: webhook.path,
    table: webhook.table,
    url,
    status: 'unknown',
    httpStatus: null,
    error: null,
    responseFormat: null,
    fieldAnalysis: null,
    recordCount: 0,
    sampleRecord: null,
    recommendations: [],
  };

  try {
    console.log(`\n🧪 Testing: ${webhook.name}`);
    console.log(`   URL: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 second timeout
    });

    result.httpStatus = response.status;
    
    if (!response.ok) {
      result.status = 'error';
      result.error = `HTTP ${response.status}: ${response.statusText}`;
      const errorText = await response.text();
      result.error += ` - ${errorText.substring(0, 200)}`;
      return result;
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      result.status = 'error';
      result.error = `Unexpected content-type: ${contentType}`;
      return result;
    }

    const data = await response.json();
    
    // Analyze response format
    result.responseFormat = analyzeResponseFormat(data);
    
    // Extract records for field analysis
    let records = [];
    if (Array.isArray(data)) {
      records = data;
    } else if (data.records && Array.isArray(data.records)) {
      records = data.records;
    } else if (data.data && Array.isArray(data.data)) {
      records = data.data;
    } else if (data.id) {
      records = [data];
    }

    result.recordCount = records.length;
    
    // Get sample record (first non-empty record)
    if (records.length > 0) {
      // Handle Airtable format
      const firstRecord = records[0];
      if (firstRecord.fields) {
        result.sampleRecord = {
          id: firstRecord.id,
          ...firstRecord.fields,
        };
      } else {
        result.sampleRecord = firstRecord;
      }
    }

    // Check fields
    result.fieldAnalysis = checkFields(records, webhook.expectedFields);

    // Generate recommendations
    if (result.responseFormat.structure === 'unknown') {
      result.recommendations.push('Response format is not recognized. Expected array or object with records/data property.');
    }

    if (result.responseFormat.isAirtableFormat) {
      result.recommendations.push('Response is in Airtable format (has "fields" property). Backend parser handles this, but flattened format is preferred.');
    }

    if (result.recordCount === 0) {
      result.recommendations.push('No records returned. This may be expected if the Airtable table is empty.');
    }

    if (result.fieldAnalysis.fieldCoverage < 100) {
      result.recommendations.push(`Missing ${result.fieldAnalysis.missingFields.length} expected fields: ${result.fieldAnalysis.missingFields.join(', ')}`);
    }

    if (result.fieldAnalysis.fieldCoverage === 0 && result.recordCount > 0) {
      result.recommendations.push('No expected fields found in records. Field names may be different in Airtable.');
    }

    // Check for empty/null values in critical fields
    if (records.length > 0) {
      const criticalFields = webhook.expectedFields.slice(0, 3); // First 3 are most critical
      const emptyFields = [];
      
      records.slice(0, 5).forEach((record, idx) => {
        const rec = record.fields || record;
        criticalFields.forEach(field => {
          if (rec[field] === null || rec[field] === undefined || rec[field] === '') {
            emptyFields.push(`Record ${idx + 1}: ${field}`);
          }
        });
      });

      if (emptyFields.length > 0) {
        result.recommendations.push(`Some records have empty/null values in critical fields: ${emptyFields.slice(0, 5).join(', ')}`);
      }
    }

    result.status = 'success';
    
  } catch (error) {
    result.status = 'error';
    result.error = error.message || String(error);
    console.error(`   ❌ Error: ${result.error}`);
  }

  return result;
}

/**
 * Generate summary report
 */
function generateReport(results) {
  const report = {
    summary: {
      total: results.length,
      success: results.filter(r => r.status === 'success').length,
      errors: results.filter(r => r.status === 'error').length,
      emptyResponses: results.filter(r => r.recordCount === 0).length,
      formatIssues: results.filter(r => 
        r.responseFormat && (
          r.responseFormat.structure === 'unknown' ||
          r.responseFormat.isAirtableFormat
        )
      ).length,
      missingFields: results.filter(r => 
        r.fieldAnalysis && r.fieldAnalysis.fieldCoverage < 100
      ).length,
    },
    results,
  };

  return report;
}

/**
 * Main test execution
 */
async function runTests() {
  console.log('🚀 Starting GET Webhook Tests');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Testing ${webhooks.length} webhooks...\n`);

  const results = [];
  
  for (const webhook of webhooks) {
    const result = await testWebhook(webhook);
    results.push(result);
    
    // Print quick status
    if (result.status === 'success') {
      const statusIcon = result.recordCount > 0 ? '✅' : '⚠️';
      const fieldIcon = result.fieldAnalysis.fieldCoverage === 100 ? '✅' : '⚠️';
      console.log(`   ${statusIcon} Status: ${result.status} | Records: ${result.recordCount} | Fields: ${fieldIcon} ${Math.round(result.fieldAnalysis.fieldCoverage)}%`);
    } else {
      console.log(`   ❌ Status: ${result.status} | Error: ${result.error}`);
    }
    
    // Wait 1 second between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  const report = generateReport(results);
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Summary');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Total Webhooks: ${report.summary.total}`);
  console.log(`✅ Successful: ${report.summary.success}`);
  console.log(`❌ Errors: ${report.summary.errors}`);
  console.log(`⚠️  Empty Responses: ${report.summary.emptyResponses}`);
  console.log(`⚠️  Format Issues: ${report.summary.formatIssues}`);
  console.log(`⚠️  Missing Fields: ${report.summary.missingFields}`);

  // Save detailed report to file
  const fs = await import('fs');
  const reportJson = JSON.stringify(report, null, 2);
  fs.writeFileSync('get-webhook-test-results.json', reportJson);
  console.log('\n📄 Detailed report saved to: get-webhook-test-results.json');

  return report;
}

// Run tests
runTests().catch(console.error);
