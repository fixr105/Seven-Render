#!/usr/bin/env tsx
/**
 * Test the link webhook (POST file to n8n)
 * Usage: npx tsx scripts/test-link-webhook.ts [url]
 * Example: npx tsx scripts/test-link-webhook.ts "https://example.com/share/doc123"
 */

const LINK_WEBHOOK_URL =
  process.env.N8N_LINK_WEBHOOK_URL ||
  `${process.env.N8N_BASE_URL || 'https://fixrrahul.app.n8n.cloud'}/webhook/3212b705-b54a-4d4e-9648-e7a6bfb06d2b`;

async function main() {
  const testUrl = process.argv[2] || 'https://example.com/test-share-link';
  console.log('Testing link webhook...');
  console.log('URL:', LINK_WEBHOOK_URL);
  console.log('Payload: { file:', testUrl, '}\n');

  try {
    const response = await fetch(LINK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: testUrl }),
    });

    console.log('Status:', response.status, response.statusText);
    const text = await response.text();
    console.log('Response:', text || '(empty)');

    if (response.ok) {
      console.log('\n✅ Webhook triggered successfully');
    } else {
      console.log('\n❌ Webhook returned error. Check n8n workflow is Active.');
    }
  } catch (err: any) {
    console.error('❌ Request failed:', err.message);
    process.exit(1);
  }
}

main();
