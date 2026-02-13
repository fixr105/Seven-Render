/**
 * Data Validation Script: Assigned KAM and Ledger
 *
 * Validates:
 * 1. Assigned KAM - Clients with non-empty Assigned KAM must reference a valid KAM Users record
 * 2. Ledger - Commission Ledger entries must reference valid clients and have required fields
 *
 * Usage:
 *   cd backend && npx tsx scripts/validate-assigned-kam-and-ledger.ts
 *
 * Exit code: 0 if all validations pass, 1 if any fail
 */

import { n8nClient } from '../src/services/airtable/n8nClient.js';

interface ValidationResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
}

async function validateAssignedKAM(): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const [clients, kamUsers] = await Promise.all([
      n8nClient.fetchTable('Clients', false),
      n8nClient.fetchTable('KAM Users', false),
    ]);

    const validKamIds = new Set<string>();
    for (const k of kamUsers as any[]) {
      const kid = k.id || k['KAM ID'];
      if (kid) validKamIds.add(String(kid));
      const kamId = k['KAM ID'];
      if (kamId) validKamIds.add(String(kamId));
    }

    let orphanedCount = 0;
    let emptyCount = 0;

    for (const client of clients as any[]) {
      const assignedKAM = client['Assigned KAM'] || client.assignedKAM || '';
      const clientId = client['Client ID'] || client.id || 'Unknown';
      const clientName = client['Client Name'] || client.clientName || 'Unknown';

      if (!assignedKAM || !String(assignedKAM).trim()) {
        emptyCount++;
        continue;
      }

      if (!validKamIds.has(String(assignedKAM).trim())) {
        orphanedCount++;
        errors.push(`Client "${clientName}" (${clientId}): Assigned KAM "${assignedKAM}" not found in KAM Users`);
      }
    }

    if (emptyCount > 0) {
      warnings.push(`${emptyCount} client(s) have empty Assigned KAM`);
    }

    if (orphanedCount > 0) {
      return { passed: false, errors, warnings };
    }

    return { passed: true, errors, warnings };
  } catch (err: any) {
    errors.push(`Failed to validate Assigned KAM: ${err.message}`);
    return { passed: false, errors, warnings };
  }
}

async function validateLedger(): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const [ledgerEntries, clients] = await Promise.all([
      n8nClient.fetchTable('Commission Ledger', false),
      n8nClient.fetchTable('Clients', false),
    ]);

    const validClientIds = new Set<string>();
    for (const c of clients as any[]) {
      const cid = c.id || c['Client ID'];
      if (cid) validClientIds.add(String(cid));
    }

    let invalidClientCount = 0;
    let missingDateCount = 0;
    let missingPayoutCount = 0;

    for (const entry of ledgerEntries as any[]) {
      const entryId = entry.id || entry['Ledger Entry ID'] || 'Unknown';
      const clientRef = entry.Client || entry['Client'] || '';
      const date = entry.Date || entry['Date'] || '';
      const payoutAmount = entry['Payout Amount'] ?? '';

      if (!clientRef || !String(clientRef).trim()) {
        errors.push(`Ledger entry ${entryId}: Missing Client reference`);
        invalidClientCount++;
      } else if (!validClientIds.has(String(clientRef).trim())) {
        errors.push(`Ledger entry ${entryId}: Client "${clientRef}" not found in Clients table`);
        invalidClientCount++;
      }

      if (!date || !String(date).trim()) {
        missingDateCount++;
        if (missingDateCount <= 5) {
          errors.push(`Ledger entry ${entryId}: Missing Date`);
        }
      }

      if (payoutAmount === '' || payoutAmount === undefined || payoutAmount === null) {
        missingPayoutCount++;
        if (missingPayoutCount <= 5) {
          errors.push(`Ledger entry ${entryId}: Missing Payout Amount`);
        }
      }
    }

    if (missingDateCount > 5) {
      errors.push(`... and ${missingDateCount - 5} more entries missing Date`);
    }
    if (missingPayoutCount > 5) {
      errors.push(`... and ${missingPayoutCount - 5} more entries missing Payout Amount`);
    }

    if (errors.length > 0) {
      return { passed: false, errors, warnings };
    }

    return { passed: true, errors, warnings };
  } catch (err: any) {
    errors.push(`Failed to validate Ledger: ${err.message}`);
    return { passed: false, errors, warnings };
  }
}

async function main() {
  console.log('Data Validation: Assigned KAM and Ledger');
  console.log('='.repeat(60));

  const kamResult = await validateAssignedKAM();
  console.log('\n1. Assigned KAM Validation');
  console.log('-'.repeat(40));
  if (kamResult.passed) {
    console.log('   PASSED');
  } else {
    console.log('   FAILED');
    kamResult.errors.forEach((e) => console.log(`   - ${e}`));
  }
  kamResult.warnings.forEach((w) => console.log(`   (warning) ${w}`));

  const ledgerResult = await validateLedger();
  console.log('\n2. Ledger Validation');
  console.log('-'.repeat(40));
  if (ledgerResult.passed) {
    console.log('   PASSED');
  } else {
    console.log('   FAILED');
    ledgerResult.errors.forEach((e) => console.log(`   - ${e}`));
  }
  ledgerResult.warnings.forEach((w) => console.log(`   (warning) ${w}`));

  console.log('\n' + '='.repeat(60));
  const allPassed = kamResult.passed && ledgerResult.passed;
  console.log(allPassed ? 'All validations PASSED' : 'Some validations FAILED');
  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error('Validation script error:', err);
  process.exit(1);
});
