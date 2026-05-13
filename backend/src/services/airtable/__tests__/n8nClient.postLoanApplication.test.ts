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

  it('defaults loan application writes to strict acknowledgement', async () => {
    mockFetch.mockResolvedValue(responseOf('') as never);
    await expect(
      n8nClient.postLoanApplication(
        { 'File ID': 'SF005', Client: 'CL001', Status: 'Draft' }
      )
    ).rejects.toThrow(/empty response/i);
  });

  it('includes durable metadata fields in the payload', async () => {
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

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"Client Submission ID":"submit-789"'),
      })
    );
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"Form Config Version":"v2"'),
      })
    );
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
        body: expect.stringContaining('"Type of Purchase":"Rental"'),
      })
    );
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
