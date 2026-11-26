function requiredN8nOrigin(name) {
  const raw = String(process.env[name] || '').trim().replace(/\/+$/, '').replace(/\/webhook$/i, '');
  if (!raw) {
    console.error(name + ' is required. Refusing to fall back to the old n8n host.');
    process.exit(1);
  }
  return raw;
}

/**
 * Script to generate loan product to required form fields mapping
 *
 * Uses Product Documents table (Product ID, Record Title, Display Order, Is Required).
 *
 * This script:
 * 1. Loads Product Documents table
 * 2. Groups by Product ID, sorts by Display Order
 * 3. Outputs JSON mapping: { "LP009": ["recXXX", "recYYY"], "LP011": ["recXXX", ...] }
 *
 * Keys are Product IDs. Values are Product Document ids (Airtable record ids).
 *
 * Usage: node backend/scripts/generate-loan-product-field-mapping.js
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const N8N_BASE_URL = requiredN8nOrigin('N8N_LMS_BASE_URL');

// Webhook URL - Product Documents
const N8N_GET_PRODUCT_DOCUMENTS_URL = `${N8N_BASE_URL}/webhook/productdocument`;

function getField(record, fieldName) {
  if (record.fields && record.fields[fieldName] !== undefined) {
    return record.fields[fieldName];
  }
  if (record[fieldName] !== undefined) {
    return record[fieldName];
  }
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
 * Keys: Product ID.
 * Values: Array of Product Document ids (Airtable record ids) sorted by Display Order.
 */
function generateMapping(productDocRows) {
  console.log('\n🔄 Processing Product Documents...\n');

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

async function main() {
  console.log('🚀 Starting loan product field mapping generation (Product Documents)...\n');
  console.log(`📡 Using n8n base URL: ${N8N_BASE_URL}\n`);

  const productDocRows = await fetchTable(N8N_GET_PRODUCT_DOCUMENTS_URL, 'Product Documents');

  if (productDocRows.length === 0) {
    console.warn('\n⚠️  No Product Documents records found.');
    console.warn('   Configure Product Documents in the Form Configuration page (Credit Team).\n');
  }

  const mapping = generateMapping(productDocRows);

  console.log(`\n${'='.repeat(60)}`);
  console.log('GENERATED MAPPING');
  console.log(`${'='.repeat(60)}\n`);

  const jsonOutput = JSON.stringify(mapping, null, 2);
  console.log(jsonOutput);

  const outputPath = path.join(process.cwd(), 'loan-product-field-mapping.json');
  fs.writeFileSync(outputPath, jsonOutput, 'utf8');
  console.log(`\n💾 Mapping saved to: ${outputPath}`);

  console.log(`\n${'='.repeat(60)}`);
  console.log('SUMMARY');
  console.log(`${'='.repeat(60)}\n`);
  console.log(`✅ Generated mapping for ${Object.keys(mapping).length} products`);

  let totalFields = 0;
  for (const [key, fields] of Object.entries(mapping)) {
    console.log(`   - ${key}: ${fields.length} document(s)`);
    totalFields += fields.length;
  }
  console.log(`\n   Total: ${totalFields} product document ids`);
  console.log(`\n${'='.repeat(60)}\n`);

  process.exit(0);
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
