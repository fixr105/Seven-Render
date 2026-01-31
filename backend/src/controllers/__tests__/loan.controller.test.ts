/**
 * P0 Tests: Loan Application Listing and Mandatory Field Validation
 * Tests M3-BE-001, M2-BE-003
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Request, Response } from 'express';
import { LoanController } from '../loan.controller.js';
import { UserRole, LoanStatus } from '../../config/constants.js';
import { AuthUser } from '../../types/auth.js';
import { createMockN8nClient, mockLoanApplications, mockFormFields, mockClientFormMapping, mockFormCategories } from '../../__tests__/helpers/mockN8nClient.js';
import * as n8nClientModule from '../../services/airtable/n8nClient.js';

// Mock the n8nClient module
const mockN8nClientInstance = createMockN8nClient();
jest.mock('../../services/airtable/n8nClient.js', () => ({
  n8nClient: mockN8nClientInstance,
}));

// Mock admin logger
jest.mock('../../utils/adminLogger.js', () => ({
  logApplicationAction: jest.fn().mockResolvedValue(undefined),
  AdminActionType: {
    SUBMIT_APPLICATION: 'submit_application',
    SAVE_DRAFT: 'save_draft',
  },
}));

// Mock status tracking
jest.mock('../../services/statusTracking/statusStateMachine.js', () => ({
  validateTransition: jest.fn(),
}));

jest.mock('../../services/statusTracking/statusHistory.service.js', () => ({
  recordStatusChange: jest.fn().mockResolvedValue(undefined),
}));


describe('LoanController - P0 Tests', () => {
  let controller: LoanController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    controller = new LoanController();
    mockN8nClientInstance.clearPostedData();
    
    // Reset mocks
    jest.clearAllMocks();

    // Setup mock response
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
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

      expect(mockN8nClientInstance.fetchTable).toHaveBeenCalledWith('Loan Application');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalled();

      const responseCall = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(responseCall.success).toBe(true);
      expect(responseCall.data).toBeDefined();
      
      // Verify only CLIENT001 applications are returned
      const applications = responseCall.data;
      applications.forEach((app: any) => {
        expect(app.Client).toBe('CLIENT001');
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

      expect(mockN8nClientInstance.fetchTable).toHaveBeenCalledWith('Loan Application');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      
      const responseCall = (mockResponse.json as jest.Mock).mock.calls[0][0];
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

      // Mock form fields with mandatory fields
      (mockN8nClientInstance.fetchTable as jest.Mock).mockImplementation(async (tableName: string) => {
        if (tableName === 'Form Fields') return mockFormFields;
        if (tableName === 'Client Form Mapping') return mockClientFormMapping;
        if (tableName === 'Form Categories') return mockFormCategories;
        if (tableName === 'Loan Application') {
          return mockLoanApplications.filter((app: any) => app.id === 'rec1');
        }
        return [];
      });

      mockRequest = {
        user: clientUser,
        params: { id: 'rec1' },
        body: {
          formData: {
            // Missing mandatory 'Applicant Name' and 'PAN Card'
            email: 'test@example.com',
          },
        },
      };

      await controller.submitApplication(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      const responseCall = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(responseCall.success).toBe(false);
      expect(responseCall.error).toContain('Missing required fields');
      expect(responseCall.missingFields).toBeDefined();
      expect(responseCall.missingFields.length).toBeGreaterThan(0);
    });

    it('should accept submission with all mandatory fields filled', async () => {
      const clientUser: AuthUser = {
        id: 'user-1',
        email: 'Sagar@gmail.com',
        role: UserRole.CLIENT,
        clientId: 'CLIENT001',
      };

      // Mock form fields
      (mockN8nClientInstance.fetchTable as jest.Mock).mockImplementation(async (tableName: string) => {
        if (tableName === 'Form Fields') return mockFormFields;
        if (tableName === 'Client Form Mapping') return mockClientFormMapping;
        if (tableName === 'Form Categories') return mockFormCategories;
        if (tableName === 'Loan Application') {
          return [{
            ...mockLoanApplications[0],
            id: 'rec1',
            Status: LoanStatus.DRAFT,
            'Form Data': JSON.stringify({
              'FLD001': 'John Doe', // Applicant Name (mandatory)
              'FLD002': 'ABCDE1234F', // PAN Card (mandatory)
              'FLD003': 'test@example.com', // Email (optional)
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

      // Should succeed (200 or 201)
      expect([200, 201]).toContain((mockResponse.status as jest.Mock).mock.calls[0][0]);
      const responseCall = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(responseCall.success).toBe(true);
    });

    it('should validate mandatory fields from Client Form Mapping', async () => {
      const clientUser: AuthUser = {
        id: 'user-1',
        email: 'Sagar@gmail.com',
        role: UserRole.CLIENT,
        clientId: 'CLIENT001',
      };

      // Mock with client-specific mapping
      (mockN8nClientInstance.fetchTable as jest.Mock).mockImplementation(async (tableName: string) => {
        if (tableName === 'Form Fields') return mockFormFields;
        if (tableName === 'Client Form Mapping') {
          return [{
            ...mockClientFormMapping[0],
            'Is Required': 'True', // Category is required
          }];
        }
        if (tableName === 'Form Categories') return mockFormCategories;
        if (tableName === 'Loan Application') {
          return [{
            ...mockLoanApplications[0],
            id: 'rec1',
            Status: LoanStatus.DRAFT,
            'Form Data': JSON.stringify({}), // Missing mandatory fields
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
      const responseCall = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(responseCall.missingFields).toBeDefined();
    });
  });
});

