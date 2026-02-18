#!/usr/bin/env tsx
/**
 * Test getFormConfigForProduct (product-embedded + Product Documents fallback)
 * Usage: npx tsx scripts/test-form-config-product.ts [productId]
 */
import 'dotenv/config';
import { getFormConfigForProduct } from '../src/services/formConfig/productFormConfig.service.js';

const productId = (process.argv[2] || 'LP008').trim();

async function main() {
  console.log('\nTesting getFormConfigForProduct for', productId);
  try {
    const result = await getFormConfigForProduct(productId);
    console.log('Success!');
    console.log('Categories:', result.categories.length);
    result.categories.forEach((c, i) => {
      console.log('  ' + (i + 1) + '. ' + c.categoryName + ' (' + c.fields.length + ' fields)');
      c.fields.forEach((f) => console.log('     - ' + f.label + ' (' + f.fieldId + ')'));
    });
    console.log('\nForm loads successfully.');
  } catch (e: any) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}

main();
