/**
 * Script to create loan products with required documents mapped from Client Form Mapping
 * 
 * This script:
 * 1. Loads Client Form Mapping and Form Fields from Airtable
 * 2. Generates mapping of clients (CL001, CL002, etc.) to required field IDs
 * 3. Creates loan products with Required Documents populated from the mapping
 * 
 * Usage: node backend/scripts/create-loan-products.js
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const N8N_BASE_URL = process.env.N8N_BASE_URL || 'https://fixrrahul.app.n8n.cloud';

// Webhook URLs
const N8N_GET_CLIENT_FORM_MAPPING_URL = `${N8N_BASE_URL}/webhook/clientformmapping`;
const N8N_GET_FORM_FIELDS_URL = `${N8N_BASE_URL}/webhook/formfields`;
const N8N_POST_LOAN_PRODUCTS_URL = `${N8N_BASE_URL}/webhook/loanproducts`;

// Loan products to create
const loanProducts = [
  {
    "Loan Product ID": "LP009",
    "Loan Name": "Revenue Based Finance for EV",
    "Description": "Flexible financing solution for electric vehicle-based businesses with repayments linked to future revenues.",
    "Active": true,
    "Client Mapping": "CL001", // Maps to CL001 for required documents
    "Associated NBFC": "Anupam Finserv"
  },
  {
    "Loan Product ID": "LP010",
    "Loan Name": "Revenue Based Finance",
    "Description": "Short-term working capital loan tied to future revenue inflows, ideal for small businesses.",
    "Active": true,
    "Client Mapping": "CL002",
    "Associated NBFC": "Anupam Finserv"
  },
  {
    "Loan Product ID": "LP011",
    "Loan Name": "MoneyMultiplier",
    "Description": "Structured lending product to enhance cashflow using recurring income streams as leverage.",
    "Active": true,
    "Client Mapping": "CL003",
    "Associated NBFC": "Anupam Finserv"
  },
  {
    "Loan Product ID": "LP012",
    "Loan Name": "Home Loan",
    "Description": "Housing finance product for salaried or self-employed applicants, customizable by tenure and rate.",
    "Active": true,
    "Client Mapping": "CL004",
    "Associated NBFC": "Anupam Finserv"
  },
  {
    "Loan Product ID": "LP013",
    "Loan Name": "Loan Against Property",
    "Description": "Secured loan backed by residential or commercial property for flexible financing.",
    "Active": true,
    "Client Mapping": "CL005",
    "Associated NBFC": "Anupam Finserv"
  },
  {
    "Loan Product ID": "LP014",
    "Loan Name": "Term Loan",
    "Description": "Fixed-term installment loan for capital or operational business needs.",
    "Active": true,
    "Client Mapping": "CL006",
    "Associated NBFC": "Anupam Finserv"
  },
  {
    "Loan Product ID": "LP015",
    "Loan Name": "Fundraise for NBFC",
    "Description": "Institutional funding line for NBFC partners to expand loan books or build reserves.",
    "Active": true,
    "Client Mapping": "CL007",
    "Associated NBFC": "Anupam Finserv"
  }
];

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
 * Fetch Client Form Mapping table
 */
async function fetchClientFormMapping() {
  console.log('📥 Fetching Client Form Mapping table...');
  try {
    const response = await fetch(N8N_GET_CLIENT_FORM_MAPPING_URL);
    
    if (!response.ok) {
      const text = await response.text();
      console.error(`   ❌ Failed to fetch: ${response.status} ${response.statusText}`);
      return [];
    }
    
    const text = await response.text();
    if (!text || text.trim() === '') {
      console.log(`   ⚠️  Empty response from webhook`);
      return [];
    }
    
    let result;
    try {
      result = JSON.parse(text);
    } catch (parseError) {
      console.error(`   ❌ Failed to parse JSON:`, parseError.message);
      return [];
    }
    
    const records = Array.isArray(result) ? result : (result.records || [result] || []);
    console.log(`   ✅ Fetched ${records.length} Client Form Mapping records`);
    return records;
  } catch (error) {
    console.error(`   ❌ Error fetching Client Form Mapping:`, error.message);
    return [];
  }
}

/**
 * Fetch Form Fields table
 */
async function fetchFormFields() {
  console.log('📥 Fetching Form Fields table...');
  try {
    const response = await fetch(N8N_GET_FORM_FIELDS_URL);
    
    if (!response.ok) {
      const text = await response.text();
      console.error(`   ❌ Failed to fetch: ${response.status} ${response.statusText}`);
      return [];
    }
    
    const text = await response.text();
    if (!text || text.trim() === '') {
      console.log(`   ⚠️  Empty response from webhook`);
      return [];
    }
    
    let result;
    try {
      result = JSON.parse(text);
    } catch (parseError) {
      console.error(`   ❌ Failed to parse JSON:`, parseError.message);
      return [];
    }
    
    const records = Array.isArray(result) ? result : (result.records || [result] || []);
    console.log(`   ✅ Fetched ${records.length} Form Fields records`);
    return records;
  } catch (error) {
    console.error(`   ❌ Error fetching Form Fields:`, error.message);
    return [];
  }
}

/**
 * Parse display order as number (handles string and number)
 */
function parseDisplayOrder(order) {
  if (order === null || order === undefined || order === '') {
    return 999999; // Put items without order at the end
  }
  const num = typeof order === 'string' ? parseInt(order, 10) : order;
  return isNaN(num) ? 999999 : num;
}

/**
 * Generate the client to field IDs mapping
 */
function generateFieldMapping(clientFormMappings, formFields) {
  console.log('\n🔄 Generating field mapping...\n');
  
  // Step 1: Group Client Form Mappings by Client
  // Only include mappings where "Is Required" = "True" or "Yes"
  const clientRequiredCategories = {};
  
  for (const mapping of clientFormMappings) {
    const client = getField(mapping, 'Client');
    const category = getField(mapping, 'Category');
    const isRequired = getField(mapping, 'Is Required');
    const displayOrder = getField(mapping, 'Display Order');
    
    // Check if required (handle both 'True'/'False' and 'Yes'/'No' formats)
    const isRequiredValue = String(isRequired || '').toLowerCase();
    if (isRequiredValue !== 'true' && isRequiredValue !== 'yes') {
      continue; // Skip non-required mappings
    }
    
    if (!client || !category) {
      continue; // Skip invalid mappings
    }
    
    if (!clientRequiredCategories[client]) {
      clientRequiredCategories[client] = [];
    }
    
    clientRequiredCategories[client].push({
      category,
      displayOrder: parseDisplayOrder(displayOrder),
    });
  }
  
  console.log(`   Found ${Object.keys(clientRequiredCategories).length} clients with required form categories`);
  
  // Step 2: For each client, find form fields in required categories
  // Only include fields where "Is Mandatory" = "True" or "Yes"
  const mapping = {};
  
  for (const [client, categories] of Object.entries(clientRequiredCategories)) {
    const requiredFieldIds = [];
    
    // Get all required categories for this client, sorted by display order
    const sortedCategories = categories.sort((a, b) => a.displayOrder - b.displayOrder);
    
    // For each category, find mandatory form fields
    for (const { category } of sortedCategories) {
      for (const field of formFields) {
        const fieldCategory = getField(field, 'Category');
        const fieldId = getField(field, 'Field ID');
        const isMandatory = getField(field, 'Is Mandatory');
        const displayOrder = getField(field, 'Display Order');
        const active = getField(field, 'Active');
        
        // Check if field belongs to this category and is mandatory
        if (fieldCategory === category && fieldId) {
          const isMandatoryValue = String(isMandatory || '').toLowerCase();
          const isActiveValue = String(active || '').toLowerCase();
          
          // Include if mandatory and active
          if ((isMandatoryValue === 'true' || isMandatoryValue === 'yes') &&
              (isActiveValue === 'true' || isActiveValue === 'yes' || active === null || active === undefined)) {
            requiredFieldIds.push({
              fieldId,
              displayOrder: parseDisplayOrder(displayOrder),
            });
          }
        }
      }
    }
    
    // Sort by display order and extract just the field IDs
    requiredFieldIds.sort((a, b) => a.displayOrder - b.displayOrder);
    const fieldIds = requiredFieldIds.map(item => item.fieldId);
    
    if (fieldIds.length > 0) {
      mapping[client] = fieldIds;
      console.log(`   ✅ ${client}: ${fieldIds.length} required fields`);
    } else {
      console.log(`   ⚠️  ${client}: No required fields found`);
    }
  }
  
  return mapping;
}

/**
 * Create a loan product
 */
async function createLoanProduct(product, fieldMapping, index) {
  const recordId = `LP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Get required documents from mapping
  const clientKey = product['Client Mapping'];
  const requiredDocuments = fieldMapping[clientKey] || [];
  
  // Format Required Documents/Fields as comma-separated string
  const requiredDocumentsString = requiredDocuments.join(', ');
  
  // Prepare data with exact field names as required by n8n webhook
  const productData = {
    id: recordId, // for matching
    'Product ID': product['Loan Product ID'],
    'Product Name': product['Loan Name'],
    'Description': product['Description'],
    'Active': product['Active'] ? 'True' : 'False',
    'Required Documents/Fields': requiredDocumentsString,
    // Note: Associated NBFC might need to be added if the table supports it
    // For now, we'll include it in Description or as a separate field if needed
  };

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Creating Loan Product ${index + 1}/${loanProducts.length}: ${product['Loan Name']}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`   Product ID: ${product['Loan Product ID']}`);
  console.log(`   Loan Name: ${product['Loan Name']}`);
  console.log(`   Client Mapping: ${clientKey}`);
  console.log(`   Required Documents: ${requiredDocuments.length} fields`);
  if (requiredDocuments.length > 0) {
    console.log(`   Field IDs: ${requiredDocuments.slice(0, 3).join(', ')}${requiredDocuments.length > 3 ? '...' : ''}`);
  } else {
    console.log(`   ⚠️  No required documents found for ${clientKey}`);
  }
  console.log(`   Associated NBFC: ${product['Associated NBFC']}`);
  console.log(`\n   Request body:`, JSON.stringify(productData, null, 2));
  
  try {
    const response = await fetch(N8N_POST_LOAN_PRODUCTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(productData),
    });

    const result = await response.json();
    
    console.log(`\n   Response status: ${response.status} ${response.statusText}`);
    console.log(`   Response body:`, JSON.stringify(result, null, 2));
    
    if (response.ok) {
      console.log(`\n   ✅ Successfully created Loan Product: ${product['Loan Name']}`);
      return { 
        success: true, 
        productId: product['Loan Product ID'],
        productName: product['Loan Name'],
        requiredDocumentsCount: requiredDocuments.length,
        result 
      };
    } else {
      console.error(`\n   ❌ Failed to create Loan Product: ${product['Loan Name']}`);
      console.error(`   Error: ${JSON.stringify(result, null, 2)}`);
      return { 
        success: false, 
        productId: product['Loan Product ID'],
        productName: product['Loan Name'],
        error: result 
      };
    }
  } catch (error) {
    console.error(`\n   ❌ Error creating Loan Product: ${product['Loan Name']}`, error.message);
    return { 
      success: false, 
      productId: product['Loan Product ID'],
      productName: product['Loan Name'],
      error: error.message 
    };
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log('🚀 Starting loan products creation script...\n');
  console.log(`📡 Using n8n base URL: ${N8N_BASE_URL}\n`);
  console.log(`📋 Loan Products to create: ${loanProducts.length}\n`);
  
  // Step 1: Fetch form field mappings
  const [clientFormMappings, formFields] = await Promise.all([
    fetchClientFormMapping(),
    fetchFormFields(),
  ]);
  
  if (formFields.length === 0) {
    console.error('\n❌ No Form Fields records found. Cannot generate mapping.');
    process.exit(1);
  }
  
  // Step 2: Generate field mapping
  const fieldMapping = generateFieldMapping(clientFormMappings, formFields);
  
  if (Object.keys(fieldMapping).length === 0) {
    console.warn('\n⚠️  No field mappings found. Loan products will be created without required documents.');
    console.warn('   This is okay - you can update them later when mappings are available.\n');
  }
  
  // Step 3: Create loan products
  const results = {
    successful: [],
    failed: [],
  };

  for (let i = 0; i < loanProducts.length; i++) {
    const product = loanProducts[i];
    const result = await createLoanProduct(product, fieldMapping, i);
    
    if (result.success) {
      results.successful.push(result);
    } else {
      results.failed.push(result);
    }
    
    // Rate limiting: Wait 1 second between requests (except for the last one)
    if (i < loanProducts.length - 1) {
      console.log(`\n   ⏳ Waiting 1 second before next request...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Step 4: Print summary
  console.log(`\n\n${'='.repeat(60)}`);
  console.log('SUMMARY');
  console.log(`${'='.repeat(60)}\n`);
  
  console.log(`✅ Successfully created: ${results.successful.length} loan products`);
  results.successful.forEach(r => {
    console.log(`   - ${r.productName} (${r.productId}) - ${r.requiredDocumentsCount} required documents`);
  });
  
  if (results.failed.length > 0) {
    console.log(`\n❌ Failed to create: ${results.failed.length} loan products`);
    results.failed.forEach(r => {
      console.log(`   - ${r.productName} (${r.productId})`);
      if (r.error) {
        console.log(`     Error: ${typeof r.error === 'string' ? r.error : JSON.stringify(r.error)}`);
      }
    });
  }
  
  console.log(`\n${'='.repeat(60)}\n`);
  
  // Exit with appropriate code
  if (results.failed.length > 0) {
    console.log('⚠️  Some loan products failed to create. Please check the logs above.');
    process.exit(1);
  } else {
    console.log('✅ All loan products created successfully!');
    process.exit(0);
  }
}

// Run the script
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});

