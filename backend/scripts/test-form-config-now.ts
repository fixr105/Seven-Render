/**
 * Test getSimpleFormConfig (Product Documents) directly
 * Run: cd backend && npx tsx scripts/test-form-config-now.ts
 * Requires productId - form config is product-centric.
 */
import { getSimpleFormConfig } from '../src/services/formConfig/simpleFormConfig.service.js';

const CLIENT_ID = process.env.TEST_CLIENT_ID || 'USER-1771248061376-1pqjvjlp0';
const PRODUCT_ID = process.env.TEST_PRODUCT_ID || 'LP011';

async function main() {
  console.log(`\nTesting getSimpleFormConfig(clientId="${CLIENT_ID}", productId="${PRODUCT_ID}")\n`);
  try {
    const result = await getSimpleFormConfig(CLIENT_ID, PRODUCT_ID);
    console.log('Result:', JSON.stringify(result, null, 2));
    console.log(`\n✅ Got ${result.categories.length} categories`);
    result.categories.forEach((c, i) => {
      console.log(`  ${i + 1}. ${c.categoryName} (${c.fields.length} fields)`);
      c.fields.forEach((f, j) => console.log(`     - ${f.label} (${f.fieldId}) required=${f.isRequired}`));
    });
  } catch (err: any) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

main();
