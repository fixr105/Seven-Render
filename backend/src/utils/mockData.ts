/**
 * Module 0: Mock Data Provider
 * 
 * Provides mock data for development/testing when MOCK_MODE is enabled.
 * Mock data is organized per module for easy testing.
 */

const MOCK_MODE = process.env.MOCK_MODE === 'true' || process.env.NODE_ENV === 'test';

/**
 * Mock data for Module 0 (Foundation)
 */
export const mockUserAccounts = [
  {
    id: 'user-client-1',
    Username: 'client@test.com',
    Password: '$2a$10$example', // bcrypt hash
    Role: 'client',
    'Account Status': 'Active',
    'Associated Profile': 'client-1',
  },
  {
    id: 'user-kam-1',
    Username: 'kam@test.com',
    Password: '$2a$10$example',
    Role: 'kam',
    'Account Status': 'Active',
    'Associated Profile': 'kam-1',
  },
  {
    id: 'user-credit-1',
    Username: 'credit@test.com',
    Password: '$2a$10$example',
    Role: 'credit_team',
    'Account Status': 'Active',
    'Associated Profile': 'credit-1',
  },
  {
    id: 'user-nbfc-1',
    Username: 'nbfc@test.com',
    Password: '$2a$10$example',
    Role: 'nbfc',
    'Account Status': 'Active',
    'Associated Profile': 'nbfc-1',
  },
];

export const mockClients = [
  {
    id: 'client-1',
    'Client ID': 'client-1',
    'Client Name': 'Test Client Company',
    'Contact Email/Phone': 'client@test.com',
    'Assigned KAM': 'kam-1',
    'Enabled Modules': ['M1', 'M2', 'M3'],
  },
];

export const mockKAMUsers = [
  {
    id: 'kam-1',
    Name: 'Test KAM',
    Email: 'kam@test.com',
  },
];

export const mockCreditTeamUsers = [
  {
    id: 'credit-1',
    Name: 'Test Credit Analyst',
    Email: 'credit@test.com',
  },
];

export const mockNBFCPartners = [
  {
    id: 'nbfc-1',
    'Lender Name': 'Test NBFC',
    'Contact Email/Phone': 'nbfc@test.com',
  },
];

export const mockLoanApplications = [
  {
    id: 'app-1',
    'File ID': 'SF12345678',
    Client: 'client-1',
    'Applicant Name': 'Test Applicant',
    'Loan Product': 'product-1',
    'Requested Loan Amount': '100000',
    Status: 'draft',
    'Creation Date': new Date().toISOString().split('T')[0],
    'Last Updated': new Date().toISOString(),
  },
];

export const mockAdminActivityLog = [
  {
    id: 'act-1',
    'Activity ID': 'act-1',
    Timestamp: new Date().toISOString(),
    'Performed By': 'client@test.com',
    'Action Type': 'create_application',
    'Description/Details': 'Created draft loan application',
    'Target Entity': 'loan_application',
    'Related File ID': 'SF12345678',
  },
];

/**
 * Get mock data for a table
 */
export function getMockData(tableName: string): any[] {
  if (!MOCK_MODE) {
    return [];
  }

  const tableMap: Record<string, any[]> = {
    'User Accounts': mockUserAccounts,
    'Clients': mockClients,
    'KAM Users': mockKAMUsers,
    'Credit Team Users': mockCreditTeamUsers,
    'NBFC Partners': mockNBFCPartners,
    'Loan Application': mockLoanApplications,
    'Admin Activity Log': mockAdminActivityLog,
  };

  return tableMap[tableName] || [];
}

/**
 * Check if mock mode is enabled
 */
export function isMockMode(): boolean {
  return MOCK_MODE;
}










