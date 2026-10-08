/**
 * One-off export: Loan Applications bureau slice from Form Data.
 * Writes a CSV outside the repo so PAN/mobile data is not committed.
 */
import { writeFileSync } from 'node:fs';
import dotenv from 'dotenv';
import { n8nClient } from '../src/services/airtable/n8nClient.js';
import { AIRTABLE_TABLE_NAMES } from '../src/services/airtable/n8nEndpoints.js';
import { parseFormDataField } from '../src/utils/mergeFormDataPatch.js';

dotenv.config();

const AIRTABLE_TABLE = 'Loan Applications';

const COLUMNS = [
  'Airtable Table',
  'id',
  'File ID',
  'Applicant Name',
  'Client',
  'Loan Product',
  'Status',
  'Creation Date',
  'Submitted Date',
  'Last Updated',
  '_meta.panLookup.status',
  '_meta.panLookup.cibilScore',
  '_meta.panLookup.completedAt',
  '_meta.panLookup.mobileNumber',
  '_meta.panLookup.panNumber',
  '_meta.panLookup.fullName',
  '_meta.panLookup.borrowerEmail',
  'borrower.firstName',
  'borrower.lastName',
  'borrower.customerName',
  'borrower.gender',
  'borrower.dob',
  'borrower.fatherName',
  'borrower.mobile',
  'borrower.email',
  'borrower.pan',
  'borrower.address.line1',
  'borrower.address.line2',
  'borrower.address.village',
  'borrower.address.pincode',
  'borrower.address.district',
  'borrower.address.state',
  'coApplicant.name',
  'coApplicant.pan',
  'coApplicant.mobile',
  'coApplicant.dob',
  'guarantor.name',
  'guarantor.pan',
  'guarantor.mobile',
  'guarantor.dob',
] as const;

function cell(value: unknown): string {
  const text = value == null ? '' : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function readField(record: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return '';
}

const records = await n8nClient.fetchTable(AIRTABLE_TABLE_NAMES.LOAN_APPLICATIONS, false, undefined, 180_000);

const lines = [COLUMNS.join(',')];
let withScore = 0;

for (const record of records) {
  const row = record as Record<string, unknown>;
  const formData = parseFormDataField(row['Form Data'] ?? row.formData ?? row.form_data);
  const score = String(formData['_meta.panLookup.cibilScore'] ?? '').trim();
  if (score) withScore += 1;

  const values: Record<string, string> = {
    'Airtable Table': AIRTABLE_TABLE,
    id: readField(row, 'id'),
    'File ID': readField(row, 'File ID', 'fileId'),
    'Applicant Name': readField(row, 'Applicant Name', 'applicantName'),
    Client: readField(row, 'Client', 'client'),
    'Loan Product': readField(row, 'Loan Product', 'loanProduct'),
    Status: readField(row, 'Status', 'status'),
    'Creation Date': readField(row, 'Creation Date', 'creationDate'),
    'Submitted Date': readField(row, 'Submitted Date', 'submittedDate'),
    'Last Updated': readField(row, 'Last Updated', 'lastUpdated'),
  };

  for (const column of COLUMNS) {
    if (column in values) continue;
    values[column] = String(formData[column] ?? '').trim();
  }

  lines.push(COLUMNS.map((column) => cell(values[column])).join(','));
}

const outPath = '/Users/govindpandey/Downloads/loan-applications-bureau.csv';
writeFileSync(outPath, `${lines.join('\n')}\n`, 'utf8');
console.log(`rows=${records.length} withCibilScore=${withScore} file=${outPath}`);
