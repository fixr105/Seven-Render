#!/usr/bin/env tsx
import { n8nClient } from '../src/services/airtable/n8nClient.js';
import { n8nConfig } from '../src/config/airtable.js';

const data = {
  id: 'LA-HL-2026-0001',
  'File ID': 'LA-HL-2026-0001',
  Client: 'rec44vOPpqUaqH59V',
  'KAM ID': 'USER-1767430957573-81645wu26',
  'Applicant Name': 'Veer Malhotra',
  'Loan Product': 'rechNMMj9vI3op3kX',
  'Requested Loan Amount': 344444444,
  Documents: 'Initial checklist generated',
  Status: 'sent_to_nbfc',
  'Assigned Credit Analyst': 'CA-002',
  'Assigned NBFC': 'NBFC-HomeFin-01',
  'Lender Decision Status': 'Under Review',
  'Lender Decision Date': '',
  'Lender Decision Remarks': '',
  'Approved Loan Amount': '',
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

async function main() {
  const payload = n8nClient.buildLoanApplicationPayload(data);
  const result = await n8nClient.postData(n8nConfig.postApplicationsUrl, payload);
  console.log('Response:', result);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
