/**
 * Mock n8n Client for Testing
 * Provides realistic mock responses matching SEVEN-DASHBOARD-2.json structure
 */

import { ParsedRecord } from '../../services/airtable/n8nClient.js';

/**
 * Mock data matching Airtable table structures from SEVEN-DASHBOARD-2.json
 */

export const mockLoanApplications: ParsedRecord[] = [
  {
    id: 'rec1',
    createdTime: '2025-01-01T00:00:00.000Z',
    'File ID': 'SF20250101001',
    'Client': 'CLIENT001',
    'Status': 'draft',
    'Applicant Name': 'John Doe',
    'Requested Loan Amount': '500000',
    'Form Data': JSON.stringify({ name: 'John Doe', pan: 'ABCDE1234F' }),
    'Documents': '',
    'Assigned NBFC': '',
    'Lender Decision Status': '',
    'Lender Decision Date': '',
    'Lender Decision Remarks': '',
    'AI File Summary': '',
  },
  {
    id: 'rec2',
    createdTime: '2025-01-02T00:00:00.000Z',
    'File ID': 'SF20250102001',
    'Client': 'CLIENT001',
    'Status': 'under_kam_review',
    'Applicant Name': 'Jane Smith',
    'Requested Loan Amount': '1000000',
    'Form Data': JSON.stringify({ name: 'Jane Smith', pan: 'FGHIJ5678K' }),
    'Documents': '',
    'Assigned NBFC': '',
    'Lender Decision Status': '',
    'Lender Decision Date': '',
    'Lender Decision Remarks': '',
    'AI File Summary': '',
  },
  {
    id: 'rec3',
    createdTime: '2025-01-03T00:00:00.000Z',
    'File ID': 'SF20250103001',
    'Client': 'CLIENT002',
    'Status': 'pending_credit_review',
    'Applicant Name': 'Bob Johnson',
    'Requested Loan Amount': '750000',
    'Form Data': JSON.stringify({ name: 'Bob Johnson', pan: 'LMNOP9012Q' }),
    'Documents': '',
    'Assigned NBFC': 'NBFC001',
    'Lender Decision Status': 'Pending',
    'Lender Decision Date': '',
    'Lender Decision Remarks': '',
    'AI File Summary': '',
  },
  {
    id: 'rec4',
    createdTime: '2025-01-04T00:00:00.000Z',
    'File ID': 'SF20250104001',
    'Client': 'CLIENT001',
    'Status': 'sent_to_nbfc',
    'Applicant Name': 'Alice Brown',
    'Requested Loan Amount': '2000000',
    'Form Data': JSON.stringify({ name: 'Alice Brown', pan: 'RSTUV3456W' }),
    'Documents': '',
    'Assigned NBFC': 'NBFC001',
    'Lender Decision Status': 'Pending',
    'Lender Decision Date': '',
    'Lender Decision Remarks': '',
    'AI File Summary': '',
  },
];

export const mockCommissionLedger: ParsedRecord[] = [
  {
    id: 'ledger1',
    createdTime: '2025-01-01T00:00:00.000Z',
    'Ledger Entry ID': 'LE001',
    'Client': 'CLIENT001',
    'Loan File': 'SF20250101001',
    'Date': '2025-01-01',
    'Disbursed Amount': '500000',
    'Commission Rate': '1.5',
    'Payout Amount': '7500',
    'Description': 'Commission for loan disbursement',
    'Dispute Status': 'None',
    'Payout Request': 'False',
  },
  {
    id: 'ledger2',
    createdTime: '2025-01-02T00:00:00.000Z',
    'Ledger Entry ID': 'LE002',
    'Client': 'CLIENT001',
    'Loan File': 'SF20250102001',
    'Date': '2025-01-02',
    'Disbursed Amount': '1000000',
    'Commission Rate': '1.5',
    'Payout Amount': '15000',
    'Description': 'Commission for loan disbursement',
    'Dispute Status': 'None',
    'Payout Request': 'Requested',
  },
  {
    id: 'ledger3',
    createdTime: '2025-01-03T00:00:00.000Z',
    'Ledger Entry ID': 'LE003',
    'Client': 'CLIENT002',
    'Loan File': 'SF20250103001',
    'Date': '2025-01-03',
    'Disbursed Amount': '750000',
    'Commission Rate': '2.0',
    'Payout Amount': '15000',
    'Description': 'Commission for loan disbursement',
    'Dispute Status': 'None',
    'Payout Request': 'False',
  },
];

export const mockFormFields: ParsedRecord[] = [
  {
    id: 'field1',
    createdTime: '2025-01-01T00:00:00.000Z',
    'Field ID': 'FLD001',
    'Category': 'CAT001',
    'Field Label': 'Applicant Name',
    'Field Type': 'text',
    'Field Placeholder': 'Enter full name',
    'Is Mandatory': 'True',
    'Display Order': '1',
    'Active': 'True',
  },
  {
    id: 'field2',
    createdTime: '2025-01-01T00:00:00.000Z',
    'Field ID': 'FLD002',
    'Category': 'CAT001',
    'Field Label': 'PAN Card',
    'Field Type': 'text',
    'Field Placeholder': 'Enter PAN number',
    'Is Mandatory': 'True',
    'Display Order': '2',
    'Active': 'True',
  },
  {
    id: 'field3',
    createdTime: '2025-01-01T00:00:00.000Z',
    'Field ID': 'FLD003',
    'Category': 'CAT001',
    'Field Label': 'Email',
    'Field Type': 'email',
    'Field Placeholder': 'Enter email address',
    'Is Mandatory': 'False',
    'Display Order': '3',
    'Active': 'True',
  },
];

export const mockClientFormMapping: ParsedRecord[] = [
  {
    id: 'mapping1',
    createdTime: '2025-01-01T00:00:00.000Z',
    'Mapping ID': 'MAP001',
    'Client': 'CLIENT001',
    'Category': 'CAT001',
    'Is Required': 'True',
    'Display Order': '1',
  },
];

/** Form Link (new simple config) - used by getSimpleFormConfig */
export const mockFormLink: ParsedRecord[] = [
  {
    id: 'fl1',
    createdTime: '2025-01-01T00:00:00.000Z',
    'Client ID': 'CLIENT001',
    'Form link': 'https://example.com/form',
    'Product ID': '',
    'Mapping ID': 'MAP001',
  },
];

/** Record Titles (new simple config) - used by getSimpleFormConfig */
export const mockRecordTitles: ParsedRecord[] = [
  {
    id: 'rt1',
    createdTime: '2025-01-01T00:00:00.000Z',
    'Mapping ID': 'MAP001',
    'Record Title': 'Applicant Name',
    'Display Order': 1,
    'Is Required': true,
  },
  {
    id: 'rt2',
    createdTime: '2025-01-01T00:00:00.000Z',
    'Mapping ID': 'MAP001',
    'Record Title': 'PAN Card',
    'Display Order': 2,
    'Is Required': true,
  },
];

export const mockFormCategories: ParsedRecord[] = [
  {
    id: 'cat1',
    createdTime: '2025-01-01T00:00:00.000Z',
    'Category ID': 'CAT001',
    'Category Name': 'Personal KYC',
    'Description': 'Personal information and KYC details',
    'Display Order': '1',
    'Active': 'True',
  },
];

export const mockFileAuditingLog: ParsedRecord[] = [
  {
    id: 'audit1',
    createdTime: '2025-01-01T00:00:00.000Z',
    'Log Entry ID': 'AUDIT001',
    'File': 'SF20250101001',
    'Timestamp': '2025-01-01T10:00:00.000Z',
    'Actor': 'Sagar@gmail.com',
    'Action/Event Type': 'Status Change',
    'Details/Message': 'Application created',
    'Target User/Role': 'kam',
    'Resolved': 'False',
  },
  {
    id: 'audit2',
    createdTime: '2025-01-02T00:00:00.000Z',
    'Log Entry ID': 'AUDIT002',
    'File': 'SF20250101001',
    'Timestamp': '2025-01-02T10:00:00.000Z',
    'Actor': 'Sagar@gmail.com',
    'Action/Event Type': 'Query Raised',
    'Details/Message': 'Please provide additional documents',
    'Target User/Role': 'CLIENT',
    'Resolved': 'False',
  },
];

export const mockNotifications: ParsedRecord[] = [
  {
    id: 'notif1',
    createdTime: '2025-01-02T00:00:00.000Z',
    'Notification ID': 'NOTIF001',
    'User': 'Sagar@gmail.com',
    'Title': 'Query Raised',
    'Message': 'A query has been raised on your application',
    'Read': 'False',
    'Created At': '2025-01-02T10:00:00.000Z',
  },
];

export const mockClients: ParsedRecord[] = [
  {
    id: 'client1',
    createdTime: '2025-01-01T00:00:00.000Z',
    'Client ID': 'CLIENT001',
    'Client Name': 'Test Client 1',
    'Primary Contact Name': 'John Manager',
    'Contact Email / Phone': 'client1@test.com',
    'Assigned KAM': 'KAM001',
    'Enabled Modules': 'M1, M2, M3',
    'Commission Rate': '1.5',
    'Status': 'Active',
  },
];

/**
 * Create a mock n8n client that returns predefined data
 */
export function createMockN8nClient() {
  const tableData: Record<string, ParsedRecord[]> = {
    'Loan Application': mockLoanApplications,
    'Loan Applications': mockLoanApplications, // POST uses plural
    'Commission Ledger': mockCommissionLedger,
    'Form Fields': mockFormFields,
    'Client Form Mapping': mockClientFormMapping,
    'Form Link': mockFormLink,
    'Record Titles': mockRecordTitles,
    'Form Categories': mockFormCategories,
    'File Auditing Log': mockFileAuditingLog,
    'Notifications': mockNotifications,
    'Clients': mockClients,
  };

  const postData: Record<string, any[]> = {};

  return {
    fetchTable: jest.fn(async (tableName: string): Promise<ParsedRecord[]> => {
      return tableData[tableName] || [];
    }),
    postLoanApplication: jest.fn(async (data: any) => {
      const key = 'Loan Applications';
      if (!postData[key]) postData[key] = [];
      postData[key].push(data);
      return { success: true, id: data.id || `rec-${Date.now()}` };
    }),
    postCommissionLedger: jest.fn(async (data: any) => {
      const key = 'Commission Ledger';
      if (!postData[key]) postData[key] = [];
      postData[key].push(data);
      return { success: true, id: data.id || `ledger-${Date.now()}` };
    }),
    postFileAuditLog: jest.fn(async (data: any) => {
      const key = 'File Auditing Log';
      if (!postData[key]) postData[key] = [];
      postData[key].push(data);
      return { success: true, id: data.id || `audit-${Date.now()}` };
    }),
    postNotification: jest.fn(async (data: any) => {
      const key = 'Notifications';
      if (!postData[key]) postData[key] = [];
      postData[key].push(data);
      return { success: true, id: data.id || `notif-${Date.now()}` };
    }),
    getPostedData: (tableName: string) => postData[tableName] || [],
    clearPostedData: () => {
      Object.keys(postData).forEach(key => delete postData[key]);
    },
  };
}

