import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { LoanWorkflowService } from '../loanWorkflow.service.js';
import { n8nClient } from '../../airtable/n8nClient.js';
import { LoanStatus, UserRole } from '../../../config/constants.js';

jest.mock('../../airtable/n8nClient.js', () => ({
  n8nClient: {
    fetchTable: jest.fn(),
    postLoanApplication: jest.fn(),
  },
}));

jest.mock('../../statusTracking/statusStateMachine.js', () => ({
  validateTransition: jest.fn(),
  toUserRole: jest.fn(() => 'client'),
}));

jest.mock('../../statusTracking/statusHistory.service.js', () => ({
  recordStatusChange: jest.fn().mockResolvedValue(undefined as never),
}));

jest.mock('../../logging/centralizedLogger.service.js', () => ({
  centralizedLogger: {
    logApplicationCreated: jest.fn().mockResolvedValue(undefined as never),
    logStatusChange: jest.fn().mockResolvedValue(undefined as never),
  },
}));

describe('LoanWorkflowService durability', () => {
  const service = new LoanWorkflowService();
  const mockN8nClient = n8nClient as unknown as {
    fetchTable: jest.Mock;
    postLoanApplication: jest.Mock;
  };
  const clientUser = {
    id: 'user-1',
    email: 'client@example.com',
    role: UserRole.CLIENT,
    clientId: 'CLIENT001',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reuses an existing application for the same clientSubmissionId', async () => {
    mockN8nClient.fetchTable.mockResolvedValue([
      {
        id: 'rec-existing',
        Client: 'CLIENT001',
        'File ID': 'SF-EXISTING',
        Status: LoanStatus.DRAFT,
        'Client Submission ID': 'submit-123',
      },
    ] as never);

    const result = await service.createLoanApplication(clientUser as any, {
      clientId: 'CLIENT001',
      saveAsDraft: true,
      clientSubmissionId: 'submit-123',
    });

    expect(result).toEqual({
      applicationId: 'rec-existing',
      fileId: 'SF-EXISTING',
      status: LoanStatus.DRAFT,
    });
    expect(mockN8nClient.postLoanApplication).not.toHaveBeenCalled();
  });

  it('verifies persisted status for draft submission', async () => {
    mockN8nClient.postLoanApplication.mockResolvedValue({ success: true } as never);
    mockN8nClient.fetchTable.mockResolvedValue([
      {
        id: 'rec-1',
        'File ID': 'SF001',
        Status: LoanStatus.UNDER_KAM_REVIEW,
        'Client Submission ID': 'submit-456',
      },
    ] as never);

    const result = await service.submitExistingLoanApplication(clientUser as any, {
      id: 'rec-1',
      'File ID': 'SF001',
      Status: LoanStatus.DRAFT,
      'Client Submission ID': 'submit-456',
    }, {
      clientSubmissionId: 'submit-456',
      formConfigVersion: 'v1',
    });

    expect(result).toEqual({
      fileId: 'SF001',
      status: LoanStatus.UNDER_KAM_REVIEW,
    });
    expect(mockN8nClient.postLoanApplication).toHaveBeenCalledWith(
      expect.objectContaining({
        Status: LoanStatus.UNDER_KAM_REVIEW,
        'Client Submission ID': 'submit-456',
        'Form Config Version': 'v1',
      }),
      expect.objectContaining({
        strictWriteAck: true,
        operationName: 'loan application submit',
      })
    );
  });

  it('recovers when verify fails but the application was persisted', async () => {
    mockN8nClient.postLoanApplication.mockResolvedValue({ success: true } as never);
    let fetchCalls = 0;
    mockN8nClient.fetchTable.mockImplementation(async () => {
      fetchCalls += 1;
      if (fetchCalls <= 6) {
        return [] as never;
      }
      return [
        {
          id: 'rec-new',
          Client: 'CLIENT001',
          'File ID': 'SFNEW001',
          Status: LoanStatus.UNDER_KAM_REVIEW,
          'Client Submission ID': 'submit-789',
        },
      ] as never;
    });

    const result = await service.createLoanApplication(clientUser as any, {
      clientId: 'CLIENT001',
      productId: 'LP001',
      applicantName: 'Recover Test',
      saveAsDraft: false,
      clientSubmissionId: 'submit-789',
    });

    expect(result).toEqual({
      applicationId: 'rec-new',
      fileId: 'SFNEW001',
      status: LoanStatus.UNDER_KAM_REVIEW,
    });
    expect(mockN8nClient.postLoanApplication).toHaveBeenCalledTimes(1);
  });
});
