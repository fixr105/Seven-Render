#!/usr/bin/env tsx
/**
 * Verify the document folder link pool webhook (getlink0).
 *
 * Usage:
 *   npx tsx backend/scripts/test-getlink0-webhook.ts
 *   npx tsx backend/scripts/test-getlink0-webhook.ts --consume "https://drive.google.com/drive/folders/example"
 *
 * Optional env:
 *   N8N_GET_LINK_WEBHOOK_URL — override default getlink0 URL
 */

const GETLINK_WEBHOOK_URL =
  process.env.N8N_GET_LINK_WEBHOOK_URL || 'https://fixrrahul.app.n8n.cloud/webhook/getlink0';

function parseArgs(): { consumeLink?: string } {
  const args = process.argv.slice(2);
  const consumeIndex = args.indexOf('--consume');
  if (consumeIndex === -1) return {};
  const consumeLink = args[consumeIndex + 1];
  if (!consumeLink) {
    console.error('Missing URL after --consume');
    process.exit(1);
  }
  return { consumeLink };
}

async function fetchLinkPool(): Promise<void> {
  console.log('GET link pool');
  console.log('URL:', GETLINK_WEBHOOK_URL);

  const response = await fetch(GETLINK_WEBHOOK_URL, { method: 'GET' });
  const text = await response.text();
  console.log('Status:', response.status, response.statusText);
  console.log('Body preview:', text.slice(0, 500) || '(empty)');

  if (!response.ok) {
    console.error('\nGET failed. Check n8n workflow is Active and returns sheet rows synchronously.');
    process.exit(1);
  }

  try {
    const parsed = JSON.parse(text);
    const rows = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.data)
        ? parsed.data
        : Array.isArray(parsed?.rows)
          ? parsed.rows
          : [];
    console.log(`\nParsed row count: ${rows.length}`);
    rows.slice(0, 5).forEach((row: Record<string, unknown>, index: number) => {
      const link = row.Links ?? row.links ?? row.link ?? row.url;
      const status = row.Status ?? row.status ?? row.Used ?? row.used ?? '';
      console.log(`  [${index + 1}] status=${JSON.stringify(status)} link=${String(link ?? '').slice(0, 80)}`);
    });
  } catch {
    console.log('\nResponse is not JSON array — inspect body above.');
  }
}

async function consumeLink(link: string): Promise<void> {
  console.log('\nPOST consume (mark YES)');
  console.log('URL:', GETLINK_WEBHOOK_URL);
  console.log('Payload:', JSON.stringify({ status: 'YES', link }));

  const response = await fetch(GETLINK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'YES', link: link.trim() }),
  });
  const text = await response.text();
  console.log('Status:', response.status, response.statusText);
  console.log('Body:', text || '(empty)');

  if (!response.ok) {
    console.error('\nPOST failed.');
    process.exit(1);
  }

  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    if (parsed.success === false) {
      console.error('\nWebhook reported failure:', parsed.error ?? parsed.message);
      process.exit(1);
    }
  } catch {
    // non-JSON success bodies are acceptable
  }

  console.log('\nConsume request completed.');
}

async function main(): Promise<void> {
  const { consumeLink: linkToConsume } = parseArgs();
  await fetchLinkPool();
  if (linkToConsume) {
    await consumeLink(linkToConsume);
  } else {
    console.log('\nTip: pass --consume "<url>" to test marking a row as YES.');
  }
}

main().catch((error: unknown) => {
  console.error('Script failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
