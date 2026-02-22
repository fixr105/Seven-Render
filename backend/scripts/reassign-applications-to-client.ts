/**
 * Reassign all existing Loan Applications to a single client identified by contact email.
 *
 * - Resolves the client by matching Contact Email/Phone to REASSIGN_CLIENT_EMAIL
 * - Updates each application's Client field to that client's id
 * - KAM tagging: applications are tagged to the KAM via Client → Assigned KAM (ensure
 *   the target client has Assigned KAM set in Airtable or via POST /credit/clients/:id/assign-kam)
 *
 * Usage:
 *   cd backend && npm run reassign:applications
 *
 * Env:
 *   REASSIGN_CLIENT_EMAIL  - Contact email to identify the target client (default: anyaaa@gmail.com)
 *   REASSIGN_DRY_RUN       - If "true", only log what would be updated; do not POST
 */

import { n8nClient } from '../src/services/airtable/n8nClient.js';

const DEFAULT_EMAIL = 'anyaaa@gmail.com';

function getTargetEmail(): string {
  const env = process.env.REASSIGN_CLIENT_EMAIL;
  return (env && env.trim()) || DEFAULT_EMAIL;
}

function isDryRun(): boolean {
  const v = (process.env.REASSIGN_DRY_RUN || '').trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

async function main(): Promise<void> {
  const targetEmail = getTargetEmail();
  const dryRun = isDryRun();
  const normalizedEmail = targetEmail.toLowerCase();

  console.log('Reassign applications to client by email');
  console.log('  Target email:', targetEmail);
  console.log('  Dry run:', dryRun);
  console.log('');

  const clients = await n8nClient.fetchTable('Clients', false);
  const targetClient = (clients as any[]).find((c: any) => {
    const contact = (c['Contact Email / Phone'] ?? c.contactEmailPhone ?? '').toString().toLowerCase();
    return normalizedEmail && contact.includes(normalizedEmail);
  });

  if (!targetClient) {
    console.error(`No client found with contact containing "${targetEmail}".`);
    console.error('Ensure the client exists in the Clients table and Contact Email/Phone contains this email.');
    process.exit(1);
  }

  const targetClientId = (targetClient.id ?? targetClient['Client ID'] ?? '').toString().trim();
  const clientName = (targetClient['Client Name'] ?? targetClient.clientName ?? 'Unknown').toString().trim();
  console.log('Target client:', clientName, '| id:', targetClientId);
  console.log('');

  const applications = await n8nClient.fetchTable('Loan Application', false);
  const total = (applications as any[]).length;
  console.log('Applications to update:', total);
  if (total === 0) {
    console.log('Nothing to do.');
    return;
  }

  let updated = 0;
  const failures: { fileId: string; error: string }[] = [];

  for (let i = 0; i < (applications as any[]).length; i++) {
    const app = (applications as any[])[i] as any;
    const fileId = (app['File ID'] ?? app.fileId ?? '').toString().trim();
    const currentClient = (app.Client ?? app.client ?? '').toString().trim();

    if (dryRun) {
      console.log(`  [dry run] ${fileId}  current Client: ${currentClient || '—'}  → ${targetClientId}`);
      updated++;
      continue;
    }

    try {
      await n8nClient.postLoanApplication({ ...app, Client: targetClientId });
      updated++;
      console.log(`  Updated ${updated}/${total}  ${fileId}`);
    } catch (err: any) {
      const message = err?.message ?? String(err);
      failures.push({ fileId, error: message });
      console.error(`  Failed ${fileId}:`, message);
    }
  }

  console.log('');
  if (dryRun) {
    console.log('Dry run complete. Would update', updated, 'applications.');
    return;
  }
  console.log('Updated', updated, 'of', total, 'applications.');
  if (failures.length > 0) {
    console.error('Failures:', failures.length);
    failures.forEach((f) => console.error('  ', f.fileId, f.error));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
