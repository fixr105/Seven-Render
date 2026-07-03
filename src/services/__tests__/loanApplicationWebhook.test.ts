import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  createLoanApplicationViaWebhook,
  hasDirectLoanApplicationWebhook,
} from '../loanApplicationWebhook';

describe('loanApplicationWebhook', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_N8N_LOAN_APPLICATIONS_URL', 'https://example.n8n.cloud/webhook/loanapplications');
    vi.stubEnv('VITE_N8N_LOAN_APPLICATION_GET_URL', 'https://example.n8n.cloud/webhook/loanapplication');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('reports configured when post and get URLs are set in production', () => {
    expect(hasDirectLoanApplicationWebhook()).toBe(true);
  });

  it('creates and verifies when webhook POST succeeds and GET finds the record', async () => {
    let postedFileId = '';
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('loanapplications') && init?.method === 'POST') {
        const body = JSON.parse(init.body as string) as Record<string, string>;
        postedFileId = body['File ID'];
        return new Response(JSON.stringify({ success: true, fileId: postedFileId }), { status: 200 });
      }
      if (url.includes('loanapplication')) {
        return new Response(
          JSON.stringify([{ id: 'rec1', 'File ID': postedFileId, Status: 'draft', Client: 'CL001' }]),
          { status: 200 }
        );
      }
      return new Response('not found', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await createLoanApplicationViaWebhook({
      clientId: 'CL001',
      productId: 'LP001',
      applicantName: 'Test',
      saveAsDraft: true,
      clientSubmissionId: 'submit-1',
    });

    expect(result.success).toBe(true);
    expect(result.data?.fileId).toBe(postedFileId);
    expect(result.data?.loanApplicationId).toBe('rec1');
  });

  it('fails when POST succeeds but GET never finds the record', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('loanapplications') && init?.method === 'POST') {
        return new Response('', { status: 200 });
      }
      if (url.includes('loanapplication')) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return new Response('not found', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const resultPromise = createLoanApplicationViaWebhook({
      clientId: 'CL001',
      productId: 'LP001',
      saveAsDraft: true,
    });
    await vi.runAllTimersAsync();
    const result = await resultPromise;
    vi.useRealTimers();

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not confirmed in Airtable/i);
  }, 15000);
});
