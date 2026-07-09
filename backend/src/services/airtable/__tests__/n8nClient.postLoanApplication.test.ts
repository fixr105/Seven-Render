import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import fetch from 'node-fetch';
import { n8nClient } from '../n8nClient.js';

jest.mock('node-fetch', () => ({
  __esModule: true,
  default: jest.fn(),
}));

type MockResponse = {
  ok: boolean;
  status: number;
  statusText: string;
  text: () => Promise<string>;
};

const mockFetch = fetch as unknown as jest.Mock;

function responseOf(body: string, status = 200, statusText = 'OK'): MockResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    text: async () => body,
  };
}

describe('n8nClient.postLoanApplication strict write acknowledgement', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('fails when webhook returns success=false JSON', async () => {
    mockFetch.mockResolvedValue(responseOf(JSON.stringify({ success: false, error: 'write failed' })) as never);
    await expect(
      n8nClient.postLoanApplication(
        { 'File ID': 'SF001', Client: 'CL001', Status: 'Draft' },
        { strictWriteAck: true, operationName: 'loan application create' }
      )
    ).rejects.toThrow(/success=false|write failed/i);
  });

  it('fails when webhook returns empty body', async () => {
    mockFetch.mockResolvedValue(responseOf('') as never);
    await expect(
      n8nClient.postLoanApplication(
        { 'File ID': 'SF002', Client: 'CL001', Status: 'Draft' },
        { strictWriteAck: true, operationName: 'loan application create' }
      )
    ).rejects.toThrow(/empty response/i);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('fails when webhook returns non-JSON body', async () => {
    mockFetch.mockResolvedValue(responseOf('ok') as never);
    await expect(
      n8nClient.postLoanApplication(
        { 'File ID': 'SF003', Client: 'CL001', Status: 'Draft' },
        { strictWriteAck: true, operationName: 'loan application create' }
      )
    ).rejects.toThrow(/non-json/i);
  });

  it('passes when webhook returns explicit success JSON', async () => {
    mockFetch.mockResolvedValue(responseOf(JSON.stringify({ success: true, data: { fileId: 'SF004' } })) as never);
    await expect(
      n8nClient.postLoanApplication(
        { 'File ID': 'SF004', Client: 'CL001', Status: 'Draft' },
        { strictWriteAck: true, operationName: 'loan application create' }
      )
    ).resolves.toEqual({ success: true, data: { fileId: 'SF004' } });
  });

  it('passes when webhook returns async workflow acknowledgement JSON', async () => {
    mockFetch.mockResolvedValue(responseOf(JSON.stringify({ message: 'Workflow was started' })) as never);
    await expect(
      n8nClient.postLoanApplication(
        { 'File ID': 'SF004A', Client: 'CL001', Status: 'Draft' },
        { strictWriteAck: true, operationName: 'loan application create' }
      )
    ).resolves.toEqual({ message: 'Workflow was started' });
  });

  it('treats empty webhook body as success by default (lenient loan sync)', async () => {
    mockFetch.mockResolvedValue(responseOf('') as never);
    await expect(
      n8nClient.postLoanApplication(
        { 'File ID': 'SF005', Client: 'CL001', Status: 'Draft' }
      )
    ).resolves.toEqual(expect.objectContaining({ success: true }));
  });

  it('can opt in to strict acknowledgement for empty webhook body', async () => {
    mockFetch.mockResolvedValue(responseOf('') as never);
    await expect(
      n8nClient.postLoanApplication(
        { 'File ID': 'SF005B', Client: 'CL001', Status: 'Draft' },
        { strictWriteAck: true, operationName: 'loan application strict' }
      )
    ).rejects.toThrow(/empty response/i);
  });

  it('packs durable metadata into Form Data instead of non-Airtable columns', async () => {
    mockFetch.mockResolvedValue(responseOf(JSON.stringify({ success: true, id: 'rec1' })) as never);

    await n8nClient.postLoanApplication({
      'File ID': 'SF006',
      Client: 'CL001',
      Status: 'Draft',
      'Client Submission ID': 'submit-789',
      'Form Config Version': 'v2',
      'Needs Attention': 'True',
      'Validation Warnings': '["warn"]',
    });

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body['Client Submission ID']).toBeUndefined();
    expect(body['Form Config Version']).toBeUndefined();
    expect(body['Needs Attention']).toBeUndefined();
    expect(body['Validation Warnings']).toBeUndefined();
    const formData = JSON.parse(String(body['Form Data'])) as Record<string, unknown>;
    expect(formData['_meta.clientSubmissionId']).toBe('submit-789');
    expect(formData['_meta.formConfigVersion']).toBe('v2');
    expect(formData['_meta.needsAttention']).toBe(true);
    expect(formData['_meta.validationWarnings']).toEqual(['warn']);
  });

  it('preserves requested loan amount when value is zero', async () => {
    mockFetch.mockResolvedValue(responseOf(JSON.stringify({ success: true, id: 'rec2' })) as never);

    await n8nClient.postLoanApplication({
      'File ID': 'SF007',
      Client: 'CL001',
      Status: 'Draft',
      requestedLoanAmount: 0,
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"Requested Loan Amount":0'),
      })
    );
  });

  it('maps basic application fields from Form Data to top-level webhook keys', async () => {
    mockFetch.mockResolvedValue(responseOf(JSON.stringify({ success: true, id: 'rec3' })) as never);

    await n8nClient.postLoanApplication({
      'File ID': 'SF008',
      Client: 'CL001',
      Status: 'Draft',
      'Form Data': JSON.stringify({
        _mobileNumber: '9876543210',
        _email: 'john@example.com',
        _typeOfPurchase: 'Rental',
      }),
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"Mobile Number":"9876543210"'),
      })
    );
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"Email Id":"john@example.com"'),
      })
    );
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"Select":"Rental"'),
      })
    );
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.not.stringContaining('"Type of Purchase"'),
      })
    );
  });

  it('maps Remarks from Form Data to top-level webhook key', async () => {
    mockFetch.mockResolvedValue(responseOf(JSON.stringify({ success: true, id: 'rec-remarks' })) as never);

    await n8nClient.postLoanApplication({
      'File ID': 'SF010',
      Client: 'CL001',
      Status: 'Draft',
      'Form Data': JSON.stringify({
        Remarks: 'Customer has existing business relationship. Priority processing requested.',
      }),
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining(
          '"Remarks":"Customer has existing business relationship. Priority processing requested."'
        ),
      })
    );
  });

  it('sends Status in POST JSON body for application status updates', async () => {
    mockFetch.mockResolvedValue(responseOf(JSON.stringify({ success: true, id: 'rec-status' })) as never);

    await n8nClient.postLoanApplication({
      'File ID': 'SF009',
      Client: 'CL001',
      Status: 'qualified',
    });

    expect(mockFetch).toHaveBeenCalled();
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body.Status).toBe('Qualified');
    expect(body['File ID']).toBe('SF009');
  });

  it('omits Status from POST body for draft saves (not an Airtable option)', async () => {
    mockFetch.mockResolvedValue(responseOf(JSON.stringify({ success: true, id: 'rec-draft' })) as never);

    await n8nClient.postLoanApplication({
      'File ID': 'SF-DRAFT',
      Client: 'CL001',
      Status: 'draft',
    });

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.Status).toBeUndefined();
  });

  it('emits structured n8n_webhook_post_start on stderr before outbound fetch', async () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockFetch.mockResolvedValue(responseOf(JSON.stringify({ success: true, id: 'rec-log' })) as never);

    await n8nClient.postLoanApplication({
      'File ID': 'SF-LOG',
      Client: 'CL001',
      Status: 'submitted',
    });

    const jsonLines = errSpy.mock.calls
      .map((c) => c[0])
      .filter((msg): msg is string => typeof msg === 'string' && msg.includes('n8n_webhook_post_start'));
    expect(jsonLines.length).toBeGreaterThan(0);
    const evt = JSON.parse(jsonLines[0]!) as {
      event: string;
      operation: string;
      webhook: string;
      fileId: string | null;
      attempt: number;
    };
    expect(evt.event).toBe('n8n_webhook_post_start');
    expect(evt.operation).toMatch(/loan application sync/i);
    expect(evt.fileId).toBe('SF-LOG');
    expect(evt.attempt).toBe(1);
    expect(evt.webhook.length).toBeGreaterThan(0);
    expect(evt.webhook).not.toMatch(/^https?:\/\//);

    errSpy.mockRestore();
  });
});

describe('n8nClient.buildLoanApplicationPayload formData fallbacks', () => {
  it('reads applicant, product, and amount from parsed Form Data when top-level fields are absent', () => {
    const payload = n8nClient.buildLoanApplicationPayload({
      'File ID': 'SF001',
      Client: 'CL001',
      Status: 'draft',
      'Form Data': JSON.stringify({
        applicant_name: 'Jane Doe',
        loan_product_id: 'LP001',
        requested_loan_amount: '500000',
      }),
    });

    expect(payload['Applicant Name']).toBe('Jane Doe');
    expect(payload['Loan Product']).toBe('LP001');
    expect(payload['Requested Loan Amount']).toBe('500000');
    expect(payload.Status).toBeUndefined();
  });

  it('promotes _documentsFolderLink from Form Data into Documents column', () => {
    const payload = n8nClient.buildLoanApplicationPayload({
      'File ID': 'SF001',
      Client: 'CL001',
      Status: 'draft',
      'Form Data': JSON.stringify({
        _documentsFolderLink: 'https://drive.google.com/drive/folders/abc123',
      }),
    });

    expect(payload.Documents).toBe(
      '_documentsFolderLink:https://drive.google.com/drive/folders/abc123|Documents Folder'
    );
    const formData = JSON.parse(String(payload['Form Data'])) as Record<string, unknown>;
    expect(formData._documentsFolderLink).toBe('https://drive.google.com/drive/folders/abc123');
  });
});

describe('n8nClient.postUserAccount strict write acknowledgement', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('fails strict Last Login updates when add-user webhook returns an empty response', async () => {
    mockFetch.mockResolvedValue(responseOf('') as never);

    await expect(
      n8nClient.postUserAccount(
        {
          id: 'user-1',
          Username: 'user@example.com',
          Password: 'hashed',
          Role: 'client',
          'Last Login': '2026-05-13T07:00:00.000Z',
          'Account Status': 'Active',
        },
        { strictWriteAck: true, operationName: 'last login update' }
      )
    ).rejects.toThrow(/empty response/i);
  });
});
