import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { LoanWorkflowService } from '../loanWorkflow.service.js';
import { n8nClient } from '../../airtable/n8nClient.js';
import { LoanStatus, UserRole } from '../../../config/constants.js';

jest.mock('../../airtable/n8nClient.js', () => ({
  n8nClient: {
    fetchTable: jest.fn(),
    postLoanApplication: jest.fn(),
    postFileAuditLog: jest.fn().mockResolvedValue({ success: true } as never),
  },
}));

jest.mock('../../../utils/adminLogger.js', () => ({
  AdminActionType: {
    SUBMIT_APPLICATION: 'submit_application',
    CREATE_APPLICATION: 'create_application',
  },
  logAdminActivity: jest.fn().mockResolvedValue({} as never),
}));

jest.mock('../../statusTracking/statusStateMachine.js', () => ({
  validateTransition: jest.fn(),
  toUserRole: jest.fn(() => 'client'),
  normalizeToCanonicalStatus: (raw: string) => String(raw || '').trim().toLowerCase().replace(/\s+/g, '_'),
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

jest.mock('../../formConfigVersioning.js', () => ({
  getLatestFormConfigVersion: jest.fn().mockResolvedValue(null as never),
}));

jest.mock('../../../utils/kamApplicationAccess.js', () => ({
  assertKAMCanMutateApplication: jest.fn().mockResolvedValue(undefined as never),
}));

jest.mock('../../statusTracking/dynamicStatus.service.js', () => ({
  normalizeDynamicStatus: (raw: string) => String(raw || '').trim().toLowerCase(),
  mayApplyTargetLoanStatus: jest.fn().mockResolvedValue(true as never),
  getApplicationProductStatuses: jest.fn(),
  getAllowedStatusesFromProduct: jest.fn(),
}));

describe('LoanWorkflowService durability', () => {
  const service = new LoanWorkflowService();
  const mockN8nClient = n8nClient as unknown as {
    fetchTable: jest.Mock;
    postLoanApplication: jest.Mock;
    postFileAuditLog: jest.Mock;
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

  it('reuses an existing application for the same clientSubmissionId without formData', async () => {
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

  it('upserts formData when existing draft matches clientSubmissionId', async () => {
    mockN8nClient.fetchTable.mockResolvedValue([
      {
        id: 'rec-existing',
        Client: 'CLIENT001',
        'File ID': 'SF-EXISTING',
        Status: LoanStatus.DRAFT,
        'Client Submission ID': 'submit-123',
        'Applicant Name': 'Old Name',
        'Loan Product': 'LP001',
        'Form Data': JSON.stringify({ pan: 'ABCDE1234F' }),
      },
    ] as never);
    mockN8nClient.postLoanApplication.mockResolvedValue({ success: true } as never);

    const result = await service.createLoanApplication(clientUser as any, {
      clientId: 'CLIENT001',
      saveAsDraft: true,
      clientSubmissionId: 'submit-123',
      applicantName: 'Updated Name',
      productId: 'LP001',
      requestedLoanAmount: '600000',
      formData: {
        applicant_name: 'Updated Name',
        loan_product_id: 'LP001',
        requested_loan_amount: '600000',
        email: 'updated@example.com',
      },
    });

    expect(result).toEqual({
      applicationId: 'rec-existing',
      fileId: 'SF-EXISTING',
      status: LoanStatus.DRAFT,
    });
    expect(mockN8nClient.postLoanApplication).toHaveBeenCalledWith(
      expect.objectContaining({
        'Applicant Name': 'Updated Name',
        'Loan Product': 'LP001',
        'Requested Loan Amount': '600000',
      }),
      expect.objectContaining({
        operationName: 'loan application draft upsert',
      })
    );

    const posted = mockN8nClient.postLoanApplication.mock.calls[0][0];
    const storedFormData = JSON.parse(posted['Form Data']);
    expect(storedFormData.email).toBe('updated@example.com');
    expect(storedFormData.pan).toBe('ABCDE1234F');
  });

  it('posts Google Drive folder link in Documents when upserting a draft', async () => {
    mockN8nClient.postLoanApplication.mockResolvedValue({ success: true } as never);
    mockN8nClient.fetchTable.mockResolvedValue([
      {
        id: 'rec-folder',
        Client: 'CLIENT001',
        'File ID': 'SFFOLDER1',
        Status: LoanStatus.DRAFT,
        'Client Submission ID': 'submit-folder',
        Documents: 'withVehicle:https://cdn.example.com/v.jpg|v.jpg',
        'Form Data': JSON.stringify({
          'geoPhotos.withVehicle.url': 'https://cdn.example.com/v.jpg',
          'geoPhotos.withVehicle.fileName': 'v.jpg',
        }),
      },
    ] as never);

    await service.createLoanApplication(clientUser as any, {
      clientId: 'CLIENT001',
      productId: 'LP001',
      applicantName: 'Folder Test',
      saveAsDraft: true,
      clientSubmissionId: 'submit-folder',
      formData: {
        _documentsFolderLink: 'https://drive.google.com/drive/folders/abc123',
        'geoPhotos.withVehicle.url': 'https://cdn.example.com/v.jpg',
        'geoPhotos.withVehicle.fileName': 'v.jpg',
      },
    });

    expect(mockN8nClient.postLoanApplication).toHaveBeenCalledWith(
      expect.objectContaining({
        Documents: expect.stringContaining(
          '_documentsFolderLink:https://drive.google.com/drive/folders/abc123|Documents Folder'
        ),
      }),
      expect.any(Object)
    );
    const posted = mockN8nClient.postLoanApplication.mock.calls[0][0];
    const storedFormData = JSON.parse(posted['Form Data']);
    expect(storedFormData._documentsFolderLink).toBe('https://drive.google.com/drive/folders/abc123');
  });

  it('submits draft with one loan POST and one file audit (no verify GET storm)', async () => {
    mockN8nClient.postLoanApplication.mockResolvedValue({ success: true } as never);

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
        'Submitted Date': expect.any(String),
      }),
      expect.objectContaining({
        strictWriteAck: true,
        operationName: 'loan application submit',
      })
    );
    expect(mockN8nClient.postFileAuditLog).toHaveBeenCalledTimes(1);
    expect(mockN8nClient.fetchTable).not.toHaveBeenCalled();
  });

  it('merges formData into submit payload when provided', async () => {
    mockN8nClient.postLoanApplication.mockResolvedValue({ success: true } as never);

    await service.submitExistingLoanApplication(
      clientUser as any,
      {
        id: 'rec-1',
        'File ID': 'SF001',
        Status: LoanStatus.DRAFT,
        'Form Data': JSON.stringify({ pan: 'OLD' }),
      },
      {
        formData: { pan: 'NEWPAN1234A', applicantName: 'Fresh' },
        formConfigVersion: 'v1',
      }
    );

    const posted = mockN8nClient.postLoanApplication.mock.calls[0][0];
    const stored = JSON.parse(posted['Form Data']);
    expect(stored.pan).toBe('NEWPAN1234A');
  });

  it('includes folder link in Documents when submitting an application', async () => {
    mockN8nClient.postLoanApplication.mockResolvedValue({ success: true } as never);

    await service.submitExistingLoanApplication(
      clientUser as any,
      {
        id: 'rec-submit-folder',
        'File ID': 'SFSUBMIT1',
        Status: LoanStatus.DRAFT,
        Documents: 'withVehicle:https://cdn.example.com/v.jpg|v.jpg',
        'Form Data': JSON.stringify({
          _documentsFolderLink: 'https://drive.google.com/drive/folders/submit123',
          'geoPhotos.withVehicle.url': 'https://cdn.example.com/v.jpg',
          'geoPhotos.withVehicle.fileName': 'v.jpg',
        }),
      },
      {
        clientSubmissionId: 'submit-folder-final',
        formConfigVersion: 'v1',
      }
    );

    expect(mockN8nClient.postLoanApplication).toHaveBeenCalledWith(
      expect.objectContaining({
        Documents: expect.stringContaining(
          '_documentsFolderLink:https://drive.google.com/drive/folders/submit123|Documents Folder'
        ),
      }),
      expect.any(Object)
    );
  });

  it('creates submitted application without persistence verify GET loop', async () => {
    mockN8nClient.postLoanApplication.mockResolvedValue({ success: true } as never);
    mockN8nClient.fetchTable.mockResolvedValue([] as never);

    const result = await service.createLoanApplication(clientUser as any, {
      clientId: 'CLIENT001',
      productId: 'LP001',
      applicantName: 'Direct Submit',
      saveAsDraft: false,
      clientSubmissionId: 'submit-789',
    });

    expect(result.fileId).toMatch(/^SF/);
    expect(result.status).toBe(LoanStatus.UNDER_KAM_REVIEW);
    expect(mockN8nClient.postLoanApplication).toHaveBeenCalledTimes(1);
    expect(mockN8nClient.postLoanApplication).toHaveBeenCalledWith(
      expect.objectContaining({
        Client: 'CLIENT001',
        Status: LoanStatus.UNDER_KAM_REVIEW,
      }),
      expect.objectContaining({
        strictWriteAck: true,
        operationName: 'loan application create',
      })
    );
    expect(mockN8nClient.postFileAuditLog).toHaveBeenCalledTimes(1);
  });

  it('uses lenient webhook acknowledgement when creating draft applications', async () => {
    mockN8nClient.postLoanApplication.mockResolvedValue({ success: true } as never);
    mockN8nClient.fetchTable.mockResolvedValue([] as never);

    await service.createLoanApplication(clientUser as any, {
      clientId: 'CLIENT001',
      productId: 'LP001',
      applicantName: 'Draft Test',
      saveAsDraft: true,
    });

    expect(mockN8nClient.postLoanApplication).toHaveBeenCalledWith(
      expect.objectContaining({ Status: LoanStatus.DRAFT }),
      expect.objectContaining({
        strictWriteAck: false,
        operationName: 'loan application create',
      })
    );
  });

  it('forwardToCreditTeam updates status to pending_credit_review for KAM', async () => {
    const kamUser = {
      id: 'kam-1',
      email: 'kam@test.local',
      role: UserRole.KAM,
      kamId: 'recKAM001',
    };

    mockN8nClient.fetchTable.mockImplementation(async (tableName: string) => {
      if (tableName === 'Loan Application') {
        return [
          {
            id: 'rec-fwd',
            'File ID': 'SF-FWD',
            Client: 'CLIENT001',
            Status: LoanStatus.UNDER_KAM_REVIEW,
          },
        ] as never;
      }
      if (tableName === 'Credit Team Users') return [] as never;
      return [] as never;
    });
    mockN8nClient.postLoanApplication.mockResolvedValue({ success: true } as never);

    await service.forwardToCreditTeam(kamUser as never, {
      fileId: 'rec-fwd',
      notes: 'Ready for credit review',
    });

    expect(mockN8nClient.postLoanApplication).toHaveBeenCalledWith(
      expect.objectContaining({
        Status: LoanStatus.PENDING_CREDIT_REVIEW,
      })
    );
  });
});
