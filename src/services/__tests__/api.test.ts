import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiService } from '../api';

describe('apiService request logical success handling', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('maps HTTP 200 with success:false body to failure', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'application/json' }),
      text: async () => JSON.stringify({ success: false, error: 'n8n rejected write' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiService.createApplication({
      productId: 'LP001',
      applicantName: 'Test User',
      requestedLoanAmount: 100000,
      formData: {},
      saveAsDraft: false,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('n8n rejected write');
  });

  it('sends validateOnly when validating an application submission', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'application/json' }),
      text: async () => JSON.stringify({ success: true, data: { warnings: ['warn'] } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await apiService.validateApplicationSubmission({
      productId: 'LP001',
      applicantName: 'Test User',
      requestedLoanAmount: 100000,
      formData: { field1: 'value' },
      clientSubmissionId: 'submit-123',
    });

    const [, requestInit] = fetchMock.mock.calls[0];
    expect(requestInit.method).toBe('POST');
    expect(JSON.parse(requestInit.body)).toMatchObject({
      validateOnly: true,
      clientSubmissionId: 'submit-123',
    });
  });

  it('sends clientSubmissionId for draft submit requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'application/json' }),
      text: async () => JSON.stringify({ success: true }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await apiService.submitApplication('app-123', { clientSubmissionId: 'submit-456' });

    const [url, requestInit] = fetchMock.mock.calls[0];
    expect(url).toContain('/loan-applications/app-123/submit');
    expect(requestInit.method).toBe('POST');
    expect(JSON.parse(requestInit.body)).toEqual({ clientSubmissionId: 'submit-456' });
  });
});
