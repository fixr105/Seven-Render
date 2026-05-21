/**
 * P0 Tests: Loan Application Listing and Mandatory Field Validation
 * Tests M3-BE-001, M2-BE-003
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Request, Response } from 'express';
import { LoanController } from '../loan.controller.js';
import { UserRole, LoanStatus } from '../../config/constants.js';
import { AuthUser } from '../../types/auth.js';
import { createMockN8nClient, mockLoanApplications, mockFormFields, mockProductDocuments, mockClientFormMapping, mockFormCategories } from '../../__tests__/helpers/mockN8nClient.js';

var mockN8nClientInstance!: ReturnType<typeof createMockN8nClient>;

jest.mock('../../services/airtable/n8nClient.js', () => {
  const { createMockN8nClient: createMock } = require('../../__tests__/helpers/mockN8nClient.js');
  const inst = createMock();
  mockN8nClientInstance = inst;
  return { n8nClient: inst };
});

// Mock admin logger
jest.mock('../../utils/adminLogger.js', () => ({
  logApplicationAction: jest.fn(async () => {}),
  AdminActionType: {
    SUBMIT_APPLICATION: 'submit_application',
    SAVE_DRAFT: 'save_draft',
    UPDATE_APPLICATION: 'update_application',
    STATUS_CHANGE: 'status_change',
  },
}));

// Mock status tracking
jest.mock('../../services/statusTracking/statusStateMachine.js', () => {
  const actual = jest.requireActual<typeof import('../../services/statusTracking/statusStateMachine.js')>(
    '../../services/statusTracking/statusStateMachine.js'
  );
  return {
    ...actual,
    validateTransition: jest.fn(),
  };
});

jest.mock('../../services/statusTracking/statusHistory.service.js', () => ({
  recordStatusChange: jest.fn(async () => {}),
}));

jest.mock('../../services/workflow/loanWorkflow.service.js', () => ({
  loanWorkflowService: {
    submitExistingLoanApplication: jest.fn(async () => ({
      fileId: 'SF20250101001',
      status: 'under_kam_review',
    })),
  },
}));

jest.mock('../../utils/logger.js', () => ({
  defaultLogger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));


describe('LoanController - P0 Tests', () => {
  let controller: LoanController;
  let mockRequest: Partial<Request>;
  let mockResponse: Response;

  beforeEach(() => {
    controller = new LoanController();
    mockN8nClientInstance.clearPostedData();
    
    // Reset mocks
    jest.clearAllMocks();

    // Setup mock response (cast: Partial<Response> rejects jest.fn() for status/json under strict types)
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as unknown as Response;
  });

  describe('M3-BE-001: Role-Based Application Listings', () => {
    it('should return only CLIENT applications for CLIENT role', async () => {
      const clientUser: AuthUser = {
        id: 'user-1',
        email: 'Sagar@gmail.com',
        role: UserRole.CLIENT,
        clientId: 'CLIENT001',
      };

      mockRequest = {
        user: clientUser,
        query: {},
      };

      // Mock fetchTable to return loan applications
      (mockN8nClientInstance.fetchTable as jest.Mock).mockImplementation(async (tableName: string) => {
        if (tableName === 'Loan Application') return mockLoanApplications;
        if (tableName === 'Clients') return [];
        if (tableName === 'Loan Products') return [];
        return [];
      });

      await controller.listApplications(mockRequest as Request, mockResponse as Response);

      expect(mockN8nClientInstance.fetchTable).toHaveBeenCalledWith('Loan Application', false);
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));

      const responseCall = (mockResponse.json as jest.Mock).mock.calls[0][0] as {
        success: boolean;
        data: Array<{ Client?: string }>;
      };
      expect(responseCall.success).toBe(true);
      expect(responseCall.data).toBeDefined();
      
      // Verify only CLIENT001 applications are returned
      const applications = responseCall.data;
      applications.forEach((app: any) => {
        expect(app.clientId).toBe('CLIENT001');
      });
    });

    it('should return all applications for CREDIT role', async () => {
      const creditUser: AuthUser = {
        id: 'user-3',
        email: 'Sagar@gmail.com',
        role: UserRole.CREDIT,
      };

      mockRequest = {
        user: creditUser,
        query: {},
      };

      (mockN8nClientInstance.fetchTable as jest.Mock).mockImplementation(async (tableName: string) => {
        if (tableName === 'Loan Application') return mockLoanApplications;
        if (tableName === 'Clients') return [];
        if (tableName === 'Loan Products') return [];
        return [];
      });

      await controller.listApplications(mockRequest as Request, mockResponse as Response);

      expect(mockN8nClientInstance.fetchTable).toHaveBeenCalledWith('Loan Application', false);
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
      
      const responseCall = (mockResponse.json as jest.Mock).mock.calls[0][0] as {
        success: boolean;
        data: unknown[];
      };
      expect(responseCall.success).toBe(true);
      
      // CREDIT should see all applications
      const applications = responseCall.data;
      expect(applications.length).toBeGreaterThan(0);
    });

    it('should return 403 for unauthenticated requests', async () => {
      mockRequest = {
        user: undefined,
        query: {},
      };

      await controller.listApplications(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Forbidden',
      });
    });
  });

  describe('M2-BE-003: Mandatory Field Validation on Submit', () => {
    it('should reject submission with missing mandatory fields', async () => {
      const clientUser: AuthUser = {
        id: 'user-1',
        email: 'Sagar@gmail.com',
        role: UserRole.CLIENT,
        clientId: 'CLIENT001',
      };

      // Mock Product Documents (used by getSimpleFormConfig for validation)
      (mockN8nClientInstance.fetchTable as jest.Mock).mockImplementation(async (tableName: string) => {
        if (tableName === 'Product Documents') return mockProductDocuments;
        if (tableName === 'Form Fields') return mockFormFields;
        if (tableName === 'Client Form Mapping') return mockClientFormMapping;
        if (tableName === 'Form Categories') return mockFormCategories;
        if (tableName === 'Loan Application') {
          return [{
            ...mockLoanApplications[0],
            id: 'rec1',
            'Loan Product': 'PROD001', // Must match mockProductDocuments Product ID
          }];
        }
        return [];
      });

      mockRequest = {
        user: clientUser,
        params: { id: 'rec1' },
        body: {
          formData: {
            // Missing mandatory 'Applicant Name' (rt1) and 'PAN Card' (rt2) - Product Documents use field ids rt1, rt2
            email: 'test@example.com',
          },
        },
      };

      await controller.submitApplication(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      const responseCall = (mockResponse.json as jest.Mock).mock.calls[0][0] as {
        success: boolean;
        error?: string;
        missingFields?: unknown[];
      };
      expect(responseCall.success).toBe(false);
      expect(responseCall.error).toMatch(/Missing required field|documents folder link/i);
      expect(responseCall.missingFields).toBeDefined();
      expect(responseCall.missingFields!.length).toBeGreaterThan(0);
    });

    it('should accept submission with all mandatory fields filled', async () => {
      const clientUser: AuthUser = {
        id: 'user-1',
        email: 'Sagar@gmail.com',
        role: UserRole.CLIENT,
        clientId: 'CLIENT001',
      };

      // Mock Product Documents; file fields satisfied by added_to_link/to_be_shared
      (mockN8nClientInstance.fetchTable as jest.Mock).mockImplementation(async (tableName: string) => {
        if (tableName === 'Product Documents') return mockProductDocuments;
        if (tableName === 'Form Fields') return mockFormFields;
        if (tableName === 'Client Form Mapping') return mockClientFormMapping;
        if (tableName === 'Form Categories') return mockFormCategories;
        if (tableName === 'Loan Application') {
          return [{
            ...mockLoanApplications[0],
            id: 'rec1',
            'Loan Product': 'PROD001', // Must match mockProductDocuments Product ID
            Status: LoanStatus.DRAFT,
            'Form Data': JSON.stringify({
              _documentsFolderLink: 'https://drive.google.com/drive/folders/testfolder123',
              _mobileNumber: '9876543210',
              _email: 'applicant@example.com',
              _typeOfPurchase: 'Rental',
              rt1: 'Jane Applicant',
              rt2: 'ABCDE1234F',
            }),
          }];
        }
        return [];
      });

      mockRequest = {
        user: clientUser,
        params: { id: 'rec1' },
        body: {},
      };

      await controller.submitApplication(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
      const responseCall = (mockResponse.json as jest.Mock).mock.calls[0][0] as { success: boolean };
      expect(responseCall.success).toBe(true);
    });

    it('should validate mandatory fields from Form Link + Record Titles', async () => {
      const clientUser: AuthUser = {
        id: 'user-1',
        email: 'Sagar@gmail.com',
        role: UserRole.CLIENT,
        clientId: 'CLIENT001',
      };

      // Mock Product Documents with required file fields
      (mockN8nClientInstance.fetchTable as jest.Mock).mockImplementation(async (tableName: string) => {
        if (tableName === 'Product Documents') return mockProductDocuments;
        if (tableName === 'Form Fields') return mockFormFields;
        if (tableName === 'Client Form Mapping') return mockClientFormMapping;
        if (tableName === 'Form Categories') return mockFormCategories;
        if (tableName === 'Loan Application') {
          return [{
            ...mockLoanApplications[0],
            id: 'rec1',
            'Loan Product': 'PROD001',
            Status: LoanStatus.DRAFT,
            'Form Data': JSON.stringify({}), // Missing mandatory file fields
          }];
        }
        return [];
      });

      mockRequest = {
        user: clientUser,
        params: { id: 'rec1' },
        body: {},
      };

      await controller.submitApplication(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      const responseCall = (mockResponse.json as jest.Mock).mock.calls[0][0] as { missingFields?: unknown[] };
      expect(responseCall.missingFields).toBeDefined();
    });
  });

});

