/**
 * Script to create loan products with required documents mapped from Product Documents
 *
 * This script:
 * 1. Loads Product Documents table from Airtable (or uses loan-product-field-mapping.json)
 * 2. Creates loan products with Required Documents populated from the mapping
 * 3. Product ID is used as mapping key (e.g. LP009 -> document ids)
 *
 * Usage: node backend/scripts/create-loan-products.js
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const N8N_BASE_URL = process.env.N8N_BASE_URL || 'https://fixrrahul.app.n8n.cloud';

// Webhook URLs - Product Documents
const N8N_GET_PRODUCT_DOCUMENTS_URL = `${N8N_BASE_URL}/webhook/productdocument`;
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

async function fetchTable(url, tableName) {
  console.log(`📥 Fetching ${tableName}...`);
  try {
    const response = await fetch(url);
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
    console.log(`   ✅ Fetched ${records.length} ${tableName} records`);
    return records;
  } catch (error) {
    console.error(`   ❌ Error fetching ${tableName}:`, error.message);
    return [];
  }
}

function parseDisplayOrder(order) {
  if (order === null || order === undefined || order === '') {
    return 999999;
  }
  const num = typeof order === 'string' ? parseInt(order, 10) : order;
  return isNaN(num) ? 999999 : num;
}

/**
 * Generate mapping from Product Documents.
 * Keys: Product ID. Values: Product Document ids sorted by Display Order.
 */
function generateFieldMapping(productDocRows) {
  console.log('\n🔄 Generating field mapping from Product Documents...\n');

  const byProduct = {};
  for (const r of productDocRows) {
    const productId = (getField(r, 'Product ID') || '').toString().trim();
    if (!productId) continue;
    if (!byProduct[productId]) byProduct[productId] = [];
    byProduct[productId].push({
      id: r.id || getField(r, 'id'),
      displayOrder: parseDisplayOrder(getField(r, 'Display Order')),
    });
  }

  const mapping = {};
  for (const [productId, docs] of Object.entries(byProduct)) {
    const sorted = docs.filter((d) => d.id).sort((a, b) => a.displayOrder - b.displayOrder);
    const fieldIds = sorted.map((d) => d.id);
    if (fieldIds.length > 0) {
      mapping[productId] = fieldIds;
      console.log(`   ✅ ${productId}: ${fieldIds.length} document(s)`);
    }
  }

  return mapping;
}

/**
 * Create a loan product
 */
async function createLoanProduct(product, fieldMapping, index) {
  const recordId = `LP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Get required documents from mapping (key by Product ID)
  const productKey = product['Loan Product ID'] || product['Product ID'];
  const requiredDocuments = fieldMapping[productKey] || [];
  
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
  console.log(`   Product Mapping: ${productKey}`);
  console.log(`   Required Documents: ${requiredDocuments.length} fields`);
  if (requiredDocuments.length > 0) {
    console.log(`   Field IDs: ${requiredDocuments.slice(0, 3).join(', ')}${requiredDocuments.length > 3 ? '...' : ''}`);
  } else {
    console.log(`   ⚠️  No required documents found for ${productKey}`);
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
  
  // Step 1: Fetch Product Documents (or load from loan-product-field-mapping.json)
  let fieldMapping = {};
  const mappingPath = path.join(process.cwd(), 'loan-product-field-mapping.json');
  if (fs.existsSync(mappingPath)) {
    console.log(`📥 Loading mapping from ${mappingPath}...`);
    const raw = fs.readFileSync(mappingPath, 'utf8');
    fieldMapping = JSON.parse(raw);
    console.log(`   ✅ Loaded mapping for ${Object.keys(fieldMapping).length} products\n`);
  } else {
    const productDocRows = await fetchTable(N8N_GET_PRODUCT_DOCUMENTS_URL, 'Product Documents');
    fieldMapping = generateFieldMapping(productDocRows);
  }
  
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

