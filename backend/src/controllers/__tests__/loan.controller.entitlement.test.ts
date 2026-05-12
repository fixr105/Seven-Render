import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Request, Response } from 'express';
import { LoanController } from '../loan.controller.js';
import { n8nClient } from '../../services/airtable/n8nClient.js';
import { UserRole } from '../../config/constants.js';

jest.mock('../../services/airtable/n8nClient.js', () => ({
  n8nClient: {
    fetchTable: jest.fn(),
  },
}));

jest.mock('../../utils/adminLogger.js', () => ({
  logApplicationAction: jest.fn(),
  AdminActionType: {
    SUBMIT_APPLICATION: 'submit_application',
    SAVE_DRAFT: 'save_draft',
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

const mockCreateLoanApplication = jest.fn();
jest.mock('../../services/workflow/loanWorkflow.service.js', () => ({
  loanWorkflowService: {
    findApplicationBySubmissionId: jest.fn(async () => null),
    createLoanApplication: (...args: unknown[]) => mockCreateLoanApplication(...args),
  },
}));

const mockN8nClientInstance = n8nClient as any;

describe('LoanController.createApplication entitlement', () => {
  let controller: LoanController;
  let mockResponse: any;

  beforeEach(() => {
    controller = new LoanController();
    jest.clearAllMocks();
    mockCreateLoanApplication.mockReset();
    (mockCreateLoanApplication as any).mockResolvedValue({
      applicationId: 'APP-1',
      fileId: 'SF001',
      status: 'draft',
    });
    mockResponse = {} as any;
    mockResponse.status = jest.fn().mockReturnValue(mockResponse);
    mockResponse.json = jest.fn().mockReturnValue(mockResponse);
  });

  it('rejects unassigned product for client role', async () => {
    (mockN8nClientInstance.fetchTable as jest.Mock).mockImplementation(async (tableName: string) => {
      if (tableName === 'Clients') {
        return [{ id: 'recClient', 'Client ID': 'CL001', products: 'LP010 LP012' }];
      }
      return [];
    });

    const req = {
      user: {
        id: 'u1',
        email: 'client@example.com',
        role: UserRole.CLIENT,
        clientId: 'CL001',
      },
      body: {
        productId: 'LP999',
        applicantName: 'Unauthorized Product',
        requestedLoanAmount: 1000,
        formData: {},
        saveAsDraft: true,
      },
    } as unknown as Request;

    await controller.createApplication(req, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: 'This product is not assigned to your account. Please contact your KAM to allocate products.',
    });
  });

  it('uses Contact Email/Phone variant to resolve client entitlements', async () => {
    (mockN8nClientInstance.fetchTable as jest.Mock).mockImplementation(async (tableName: string) => {
      if (tableName === 'Clients') {
        return [
          {
            id: 'recClient',
            'Client ID': 'CL001',
            'Contact Email/Phone': 'client@example.com',
            'Assigned Products': 'LP010',
          },
        ];
      }
      return [];
    });

    const req = {
      user: {
        id: 'u1',
        email: 'client@example.com',
        role: UserRole.CLIENT,
        clientId: 'UNKNOWN',
      },
      body: {
        productId: 'LP999',
        applicantName: 'Unauthorized Product',
        requestedLoanAmount: 1000,
        formData: {},
        saveAsDraft: true,
      },
    } as unknown as Request;

    await controller.createApplication(req, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: 'This product is not assigned to your account. Please contact your KAM to allocate products.',
    });
  });

  it('derives requested loan amount from selected vehicle', async () => {
    (mockN8nClientInstance.fetchTable as jest.Mock).mockImplementation(async (tableName: string) => {
      if (tableName === 'Clients') {
        return [
          {
            id: 'recClient',
            'Client ID': 'CL001',
            'Assigned Products': 'LP001',
            'Contact Email/Phone': 'client@example.com',
          },
        ];
      }
      if (tableName === 'Vehicles') {
        return [
          {
            id: 'recVehicle1',
            'Vehicle ID': 'VEH001',
            Make: 'Tata',
            Model: 'Ace Gold',
            'Requested Loan Amount': '550000',
            'Product ID': 'LP001',
            'Allowed Clients': 'CL001',
          },
        ];
      }
      return [];
    });

    const req = {
      user: {
        id: 'u1',
        email: 'client@example.com',
        role: UserRole.CLIENT,
        clientId: 'CL001',
      },
      body: {
        productId: 'LP001',
        applicantName: 'Vehicle User',
        formData: {
          _vehicleMake: 'Tata',
          _vehicleModel: 'Ace Gold',
        },
        saveAsDraft: true,
      },
    } as unknown as Request;

    await controller.createApplication(req, mockResponse as Response);

    expect(mockCreateLoanApplication).toHaveBeenCalled();
    const payload = mockCreateLoanApplication.mock.calls[0][1] as {
      requestedLoanAmount: string;
      formData: Record<string, unknown>;
    };
    expect(payload.requestedLoanAmount).toBe('550000');
    expect(payload.formData._vehicleRequestedLoanAmount).toBe('550000');
    expect(payload.formData._vehicleMake).toBe('Tata');
    expect(payload.formData._vehicleModel).toBe('Ace Gold');
  });
});

