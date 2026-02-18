#!/usr/bin/env tsx
/**
 * Debug: Check if a product has form config (Product Documents).
 * Form config is product-centric - no client-specific mapping.
 *
 * Usage: npx tsx scripts/debug-client-form-for-email.ts [productId]
 * Example: npx tsx scripts/debug-client-form-for-email.ts LP011
 */

import 'dotenv/config';
import { n8nClient } from '../src/services/airtable/n8nClient.js';
import { getSimpleFormConfig } from '../src/services/formConfig/simpleFormConfig.service.js';

const productId = (process.argv[2] || 'LP011').trim();

async function main() {
  try {
    const [productDocs, products] = await Promise.all([
      n8nClient.fetchTable('Product Documents', false, undefined, 15000),
      n8nClient.fetchTable('Loan Products', false, undefined, 15000),
    ]);

    const product = products.find(
      (p: any) =>
        (p['Product ID'] || p.productId || '').toString().trim() === productId
    );
    const productName = product?.['Product Name'] || product?.productName || productId;

    const docsForProduct = productDocs.filter(
      (r: any) => (r['Product ID'] || r.productId || '').toString().trim() === productId
    );

    console.log(`\nProduct: ${productName} (${productId})`);
    console.log(`Product Documents: ${docsForProduct.length} row(s)`);

    if (docsForProduct.length > 0) {
      console.table(
        docsForProduct.map((d: any) => ({
          'Record Title': d['Record Title'] || d.recordTitle,
          'Display Order': d['Display Order'] ?? d.displayOrder,
          'Is Required': d['Is Required'] ?? d.isRequired,
        }))
      );
      const config = await getSimpleFormConfig('_', productId);
      console.log(`\ngetSimpleFormConfig returns ${config.categories.length} category(ies), ${config.categories.reduce((s, c) => s + c.fields.length, 0)} field(s)`);
      console.log('Form config should load for any client when they select this product.');
    } else {
      console.log('\nNo Product Documents for this product. Add documents in Form Configuration (Credit Team).');
    }
  } catch (error: any) {
    console.error('Error:', error?.message || error);
    process.exit(1);
  }
}

main();
