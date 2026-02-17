/**
 * Quick test for GET /public/clients/:id/form-config
 * Run: cd backend && npx tsx scripts/test-public-form-config.ts
 *
 * Uses a client ID from your data (e.g. recVpVbkj1QdEfM9J) - update CLIENT_ID if needed.
 */

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001/api';
const CLIENT_ID = process.env.TEST_CLIENT_ID || 'recVpVbkj1QdEfM9J';

async function testPublicFormConfig() {
  const url = `${API_BASE}/public/clients/${CLIENT_ID}/form-config`;
  console.log(`\nTesting: GET ${url}\n`);

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok) {
      console.error('FAIL:', res.status, data);
      process.exit(1);
    }

    if (!data.success) {
      console.error('FAIL: success=false', data);
      process.exit(1);
    }

    const categories = data.data || [];
    console.log(`PASS: Got ${categories.length} categories`);
    categories.forEach((c: any, i: number) => {
      const fieldCount = (c.fields || []).length;
      console.log(`  ${i + 1}. ${c.categoryName || c['Category Name'] || 'Unknown'} (${fieldCount} fields)`);
    });

    if (categories.length > 0 && categories[0].fields?.length > 0) {
      const firstField = categories[0].fields[0];
      console.log(`\nSample field: ${firstField.label || firstField['Field Label']} (${firstField.fieldId || firstField['Field ID']})`);
    }

    console.log('\nPublic form-config endpoint OK.\n');
  } catch (err: any) {
    console.error('FAIL:', err.message);
    process.exit(1);
  }
}

testPublicFormConfig();
