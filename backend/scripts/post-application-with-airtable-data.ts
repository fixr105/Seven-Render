#!/usr/bin/env tsx
/**
 * POST one loan application using real Airtable data so it syncs with KAM-001.
 *
 * Fetches KAM Users, Clients, and Loan Products from Airtable; finds a client
 * assigned to KAM-001 and a loan product (LP012 or first); builds the payload
 * with your application data and POSTs to the loan applications webhook.
 *
 * Usage:
 *   cd backend && npx tsx scripts/post-application-with-airtable-data.ts
 *
 * Env: N8N_BASE_URL (and any other env required by n8nClient).
 */

import { n8nClient } from '../src/services/airtable/n8nClient.js';
import { n8nConfig } from '../src/config/airtable.js';
import { matchIds } from '../src/utils/idMatcher.js';

const KAM_ID_TARGET = process.env.KAM_ID_TARGET || 'KAM-001';

const APPLICATION_PAYLOAD = {
  id: 'LA-HL-2026-0001',
  Client: '', // filled from Airtable
  'KAM ID': KAM_ID_TARGET,
  'Applicant Name': 'Veer Malhotra',
  'Loan Product': '', // filled from Airtable
  'Requested Loan Amount': 344444444,
  Documents: 'Initial checklist generated',
  Status: 'sent_to_nbfc',
  'Assigned Credit Analyst': 'CA-002',
  'Assigned NBFC': 'NBFC-HomeFin-01',
  'Lender Decision Status': 'Under Review',
  'Lender Decision Date': '',
  'Lender Decision Remarks': '',
  'Approved Loan Amount': 0,
  'AI File Summary':
    'Applicant is salaried with stable income. Property documents under review.',
  'Form Data': {
    'PAN Card': 'yes',
    'Aadhaar Card / Passport / Voter ID / Driving License': 'yes',
    'Passport Size Photograph': 'yes',
    'Residence Address Proof (Utility Bill / Rent Agreement)': 'yes',
    'Personal Bank Statement – Last 6 Months (If applicable)': 'to be shared soon',
    'ITR – Last 2 Years (Acknowledgement and Statement of Income)': 'yes',
    'Personal Cheque': 'no',
    'Certificate of Incorporation (COI)': 'no',
    'Company PAN Card': 'no',
    'GST Certificate': 'no',
    'MSME or Udyam certificate': 'no',
    'MOA & AOA': 'no',
    'Board Resolution for Borrowing': 'no',
    'Company Address Proof': 'no',
    'Company Bank Statement – 12 Months (All Statement)': 'no',
    'Company ITR – Last 2 Years (With Audit report)': 'no',
    'Latest Audited Financials (Current Financial Year)': 'no',
    'GST 3B – Last 12 Months': 'no',
    'Security Cheques - 6': 'no',
    'LLP Incorporation Certificate': 'no',
    'LLP Agreement': 'no',
    'LLP PAN Card': 'no',
    'LLP Bank Statement – 12 Months': 'no',
    'LLP ITR – Last 2 Years': 'no',
    'Partner KYC Documents': 'no',
    'Partnership Deed': 'no',
    'Registration Certificate (if registered)': 'no',
    'Firm PAN Card': 'no',
    'Firm Bank Statement – 12 Months (All Statement)': 'no',
    'Firm ITR – Last 2 Years (With Audit report)': 'no',
    'GST 3B – Last 12 Months': 'no',
    'List of Partners with Shareholding Pattern': 'no',
    'GST / Trade License / Udyam Registration': 'no',
    'Business PAN (if applicable)': 'no',
    'Business Bank Statement – 12 Months': 'no',
    'ITR – Last 2 Years with Computation': 'no',
    'Balance Sheet & P&L': 'no',
    'Office Address Proof': 'no',
    'Sale Deed / Title Deed': 'yes',
    'Mother Deed / Chain Documents': 'yes',
    'Encumbrance Certificate (EC)': 'to be shared soon',
    'Khata / Property Tax Receipt': 'yes',
    'Approved Building Plan': 'yes',
    'Occupancy / Completion Certificate': 'yes',
    'Latest Electricity / Water Bill': 'yes',
  },
  'Creation Date': '2026-02-21',
  'Submitted Date': '2026-02-21',
  'Last Updated': '2026-02-21T09:30:03.100Z',
  MD: 'Initial submission',
};

function getClientId(c: any): string {
  return String(c?.id ?? c?.['Client ID'] ?? '').trim();
}

function getProductId(p: any): string {
  return String(p?.id ?? p?.['Product ID'] ?? '').trim();
}

async function main(): Promise<void> {
  console.log('Fetching Airtable data for KAM-001...\n');

  const [kamUsers, clients, loanProducts] = await Promise.all([
    n8nClient.fetchTable('KAM Users', false),
    n8nClient.fetchTable('Clients', false),
    n8nClient.fetchTable('Loan Products', false),
  ]);

  let kam = (kamUsers as any[]).find(
    (k: any) =>
      matchIds(k['KAM ID'], KAM_ID_TARGET) || matchIds(k.id, KAM_ID_TARGET)
  );
  if (!kam) {
    const first = (kamUsers as any[])[0];
    if (!first) {
      console.error('No KAM users in Airtable.');
      process.exit(1);
    }
    kam = first;
    console.log(
      `KAM "${KAM_ID_TARGET}" not in Airtable. Using first KAM so application syncs: ${kam['KAM ID'] || kam.id} (${kam['Name'] || kam['Email'] || '—'})`
    );
  }

  const kamIdentifier = kam['KAM ID'] || kam.id;
  const managedClients = (clients as any[]).filter((c: any) => {
    const assigned =
      c['Assigned KAM'] ?? c.assignedKAM ?? c['KAM ID'] ?? '';
    return (
      matchIds(assigned, kamIdentifier) || matchIds(assigned, kam.id)
    );
  });

  if (managedClients.length === 0) {
    console.error(
      `No clients found assigned to KAM-001 (${kamIdentifier}). Cannot sync.`
    );
    process.exit(1);
  }

  const client = managedClients[0];
  const clientId = getClientId(client);
  const clientName =
    client['Client Name'] ?? client['Primary Contact Name'] ?? clientId;
  console.log(`Using client: ${clientName} (${clientId})`);

  const product =
    (loanProducts as any[]).find(
      (p: any) =>
        (p['Product ID'] || p.id || '').toString().trim() === 'LP012'
    ) ?? (loanProducts as any[])[0];
  if (!product) {
    console.error('No loan products found.');
    process.exit(1);
  }
  const productId = getProductId(product);
  const productLabel =
    product['Product Name'] ?? product['Product ID'] ?? productId;
  console.log(`Using loan product: ${productLabel} (${productId})`);

  const data = {
    ...APPLICATION_PAYLOAD,
    Client: clientId,
    'KAM ID': kamIdentifier,
    'Loan Product': productId,
    'Form Data':
      typeof APPLICATION_PAYLOAD['Form Data'] === 'object'
        ? JSON.stringify(APPLICATION_PAYLOAD['Form Data'])
        : APPLICATION_PAYLOAD['Form Data'],
  };

  const payload = n8nClient.buildLoanApplicationPayload(data);
  if (data['File ID'] !== undefined) payload['File ID'] = data['File ID'];
  if (!payload['File ID']) payload['File ID'] = APPLICATION_PAYLOAD.id;

  console.log('\nPosting to loan applications webhook...');
  const result = await n8nClient.postData(
    n8nConfig.postApplicationsUrl,
    payload
  );
  console.log('Response:', result);
  console.log('\nDone. Application synced with KAM-001.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
