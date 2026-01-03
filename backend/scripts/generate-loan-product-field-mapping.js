/**
 * Script to generate loan product to required form fields mapping
 * 
 * This script:
 * 1. Loads Client Form Mapping table
 * 2. For each Client (loan product), finds all form fields marked as "Is Required" = Yes
 * 3. Sorts them by Display Order
 * 4. Outputs a JSON mapping: { "CL001": ["FLD-...", "FLD-..."] }
 * 
 * Usage: node backend/scripts/generate-loan-product-field-mapping.js
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const N8N_BASE_URL = process.env.N8N_BASE_URL || 'https://fixrrahul.app.n8n.cloud';

// Webhook URLs
const N8N_GET_CLIENT_FORM_MAPPING_URL = `${N8N_BASE_URL}/webhook/clientformmapping`;
const N8N_GET_FORM_FIELDS_URL = `${N8N_BASE_URL}/webhook/formfields`;

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
      console.error(`   Response body:`, text);
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
      console.error(`   Response text:`, text.substring(0, 200));
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
      console.error(`   Response body:`, text);
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
      console.error(`   Response text:`, text.substring(0, 200));
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
 * Generate the mapping
 */
function generateMapping(clientFormMappings, formFields) {
  console.log('\n🔄 Processing data to generate mapping...\n');
  
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
 * Main execution
 */
async function main() {
  console.log('🚀 Starting loan product field mapping generation...\n');
  console.log(`📡 Using n8n base URL: ${N8N_BASE_URL}\n`);
  
  // Fetch data
  const [clientFormMappings, formFields] = await Promise.all([
    fetchClientFormMapping(),
    fetchFormFields(),
  ]);
  
  if (clientFormMappings.length === 0) {
    console.warn('\n⚠️  No Client Form Mapping records found.');
    console.warn('   This could mean:');
    console.warn('   - The table is empty');
    console.warn('   - The webhook is not configured correctly');
    console.warn('   - There are no form mappings created yet');
    console.warn('\n   Generating empty mapping structure...\n');
  }
  
  if (formFields.length === 0) {
    console.error('\n❌ No Form Fields records found. Cannot generate mapping.');
    process.exit(1);
  }
  
  // Generate mapping
  const mapping = generateMapping(clientFormMappings, formFields);
  
  // Output results
  console.log(`\n${'='.repeat(60)}`);
  console.log('GENERATED MAPPING');
  console.log(`${'='.repeat(60)}\n`);
  
  if (Object.keys(mapping).length === 0) {
    console.log('⚠️  No mappings generated. This could be because:');
    console.log('   - Client Form Mapping has no entries with "Is Required" = "True" or "Yes"');
    console.log('   - Form Fields have no entries with "Is Mandatory" = "True" or "Yes"');
    console.log('   - Categories in mappings do not match Categories in form fields');
    console.log('\n   Generating empty mapping structure anyway...\n');
  }
  
  // Pretty print JSON
  const jsonOutput = JSON.stringify(mapping, null, 2);
  console.log(jsonOutput);
  
  // Save to file
  const outputPath = path.join(process.cwd(), 'loan-product-field-mapping.json');
  fs.writeFileSync(outputPath, jsonOutput, 'utf8');
  console.log(`\n💾 Mapping saved to: ${outputPath}`);
  
  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('SUMMARY');
  console.log(`${'='.repeat(60)}\n`);
  console.log(`✅ Generated mapping for ${Object.keys(mapping).length} clients/loan products`);
  
  let totalFields = 0;
  for (const [client, fields] of Object.entries(mapping)) {
    console.log(`   - ${client}: ${fields.length} required fields`);
    totalFields += fields.length;
  }
  console.log(`\n   Total required fields: ${totalFields}`);
  console.log(`\n${'='.repeat(60)}\n`);
  
  process.exit(0);
}

// Run the script
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});

