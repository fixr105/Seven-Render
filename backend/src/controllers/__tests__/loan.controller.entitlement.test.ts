import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Request, Response } from 'express';
import { LoanController } from '../loan.controller.js';
import { n8nClient } from '../../services/airtable/n8nClient.js';
import { UserRole } from '../../config/constants.js';

jest.mock('../../services/airtable/n8nClient.js', () => ({
  n8nClient: {
    fetchTable: jest.fn(),
    postLoanApplication: jest.fn(),
    getUserAccounts: jest.fn(async () => []),
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
const mockFindApplicationBySubmissionId = jest.fn<(...args: unknown[]) => Promise<unknown>>(async () => null);
jest.mock('../../services/workflow/loanWorkflow.service.js', () => ({
  loanWorkflowService: {
    findApplicationBySubmissionId: (clientId: unknown, submissionId: unknown) =>
      mockFindApplicationBySubmissionId(clientId, submissionId),
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
    mockFindApplicationBySubmissionId.mockReset();
    (mockFindApplicationBySubmissionId as any).mockResolvedValue(null);
    (mockCreateLoanApplication as any).mockResolvedValue({
      applicationId: 'APP-1',
      fileId: 'SF001',
      status: 'draft',
    });
    mockResponse = {} as any;
    mockResponse.status = jest.fn().mockReturnValue(mockResponse);
    mockResponse.json = jest.fn().mockReturnValue(mockResponse);
  });

  it('skips Clients entitlement GET when JWT already has clientId', async () => {
    (mockN8nClientInstance.fetchTable as jest.Mock).mockImplementation(async () => []);

    const req = {
      user: {
        id: 'u1',
        email: 'client@example.com',
        role: UserRole.CLIENT,
        clientId: 'CL001',
      },
      body: {
        productId: 'LP999',
        applicantName: 'Product gated at form load',
        requestedLoanAmount: 1000,
        formData: {},
        saveAsDraft: true,
      },
    } as unknown as Request;

    await controller.createApplication(req, mockResponse as Response);

    expect(mockN8nClientInstance.fetchTable).not.toHaveBeenCalledWith(
      'Clients',
      expect.anything()
    );
    expect(mockCreateLoanApplication).toHaveBeenCalled();
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ loanApplicationId: 'APP-1', fileId: 'SF001' }),
      })
    );
  });

  it('rejects create when productId is missing even with clientId', async () => {
    const req = {
      user: {
        id: 'u1',
        email: 'client@example.com',
        role: UserRole.CLIENT,
        clientId: 'CL001',
      },
      body: {
        productId: '',
        applicantName: 'Missing Product',
        requestedLoanAmount: 1000,
        formData: {},
        saveAsDraft: true,
      },
    } as unknown as Request;

    await controller.createApplication(req, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: 'Product ID is required.',
    });
    expect(mockCreateLoanApplication).not.toHaveBeenCalled();
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

  it('returns existing application when workflow fails after write instead of creating a duplicate', async () => {
    (mockN8nClientInstance.fetchTable as jest.Mock).mockImplementation(async (tableName: string) => {
      if (tableName === 'Clients') {
        return [
          {
            id: 'recClient',
            'Client ID': 'CL001',
            'Assigned Products': 'LP001',
          },
        ];
      }
      return [];
    });

    mockCreateLoanApplication.mockRejectedValue(new Error('persistence verify failed') as never);
    (mockFindApplicationBySubmissionId as any).mockResolvedValueOnce({
      id: 'rec-existing',
      'File ID': 'SF-EXISTING',
      Status: 'under_kam_review',
      'Client Submission ID': 'submit-abc',
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
        applicantName: 'Dup Test',
        formData: {},
        saveAsDraft: true,
        clientSubmissionId: 'submit-abc',
      },
    } as unknown as Request;

    await controller.createApplication(req, mockResponse as Response);

    expect(mockN8nClientInstance.postLoanApplication).not.toHaveBeenCalled();
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: true,
      data: expect.objectContaining({
        loanApplicationId: 'rec-existing',
        fileId: 'SF-EXISTING',
        status: 'under_kam_review',
      }),
    });
  });

  it('returns 500 when workflow fails and no persisted application is found', async () => {
    (mockN8nClientInstance.fetchTable as jest.Mock).mockImplementation(async (tableName: string) => {
      if (tableName === 'Clients') {
        return [
          {
            id: 'recClient',
            'Client ID': 'CL001',
            'Assigned Products': 'LP001',
          },
        ];
      }
      return [];
    });

    mockCreateLoanApplication.mockRejectedValue(new Error('workflow failed') as never);

    const req = {
      user: {
        id: 'u1',
        email: 'client@example.com',
        role: UserRole.CLIENT,
        clientId: 'CL001',
      },
      body: {
        productId: 'LP001',
        applicantName: 'Fail Test',
        formData: {},
        saveAsDraft: true,
      },
    } as unknown as Request;

    await controller.createApplication(req, mockResponse as Response);

    expect(mockN8nClientInstance.postLoanApplication).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(500);
  });
});

