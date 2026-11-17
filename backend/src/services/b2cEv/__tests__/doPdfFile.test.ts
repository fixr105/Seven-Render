import { describe, expect, it, jest } from '@jest/globals';
import { storeGeneratedDoPdf } from '../doPdfFile.js';

const source =
  'https://pdf-temp-files.s3.us-west-2.amazonaws.com/job/CKYC_Template_Individual_2.pdf?X-Amz-Expires=3600';

describe('storeGeneratedDoPdf', () => {
  it('downloads the generated PDF and stores it through urllink', async () => {
    const pdf = Buffer.from('%PDF-1.4 stored');
    const fetchImpl = jest.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === source) {
        return new Response(pdf, { status: 200, headers: { 'content-type': 'application/pdf' } });
      }
      if (url === 'https://fixrrahul.app.n8n.cloud/webhook/urllink') {
        expect(init?.method).toBe('POST');
        expect(init?.body).toBeInstanceOf(FormData);
        return new Response(JSON.stringify({ ok: true, url: 'https://files.example/stored-do.pdf' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      throw new Error(`unexpected ${url}`);
    });

    await expect(
      storeGeneratedDoPdf({
        url: source,
        fileName: 'CKYC_Template_Individual_2.pdf',
        fetchImpl: fetchImpl as typeof fetch,
        urllinkUrl: 'https://fixrrahul.app.n8n.cloud/webhook/urllink',
      })
    ).resolves.toEqual({
      url: 'https://files.example/stored-do.pdf',
      fileName: 'CKYC_Template_Individual_2.pdf',
    });
  });

  it('rejects a file that is not from the DO generator', async () => {
    await expect(
      storeGeneratedDoPdf({
        url: 'https://evil.example/do.pdf',
        fileName: 'DO.pdf',
        fetchImpl: jest.fn() as typeof fetch,
        urllinkUrl: 'https://fixrrahul.app.n8n.cloud/webhook/urllink',
      })
    ).rejects.toThrow('Unsupported DO file URL');
  });
});
