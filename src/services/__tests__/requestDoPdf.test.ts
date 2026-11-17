import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestDoPdf } from '../engineClient';

const generatedUrl =
  'https://pdf-temp-files.s3.us-west-2.amazonaws.com/job/CKYC_Template_Individual_2.pdf?X-Amz-Expires=3600';

describe('requestDoPdf', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('saves the generated PDF and returns the stored file url', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('85af8f18-a251-45a3-b95e-ad593070fd0e')) {
        return new Response(
          JSON.stringify([
            {
              pageCount: 1,
              url: generatedUrl,
              name: 'CKYC_Template_Individual_2.pdf',
            },
          ]),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }
      if (url.includes('/api/kam/do-pdf/store')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              url: 'https://files.example/stored-do.pdf',
              fileName: 'CKYC_Template_Individual_2.pdf',
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(requestDoPdf({ file_id: 'SF1' })).resolves.toEqual({
      url: 'https://files.example/stored-do.pdf',
      fileName: 'CKYC_Template_Individual_2.pdf',
    });

    const storeCall = fetchMock.mock.calls.find((call) =>
      String(call[0]).includes('/api/kam/do-pdf/store')
    );
    expect(storeCall).toBeTruthy();
    expect(JSON.parse(String((storeCall?.[1] as RequestInit).body))).toEqual({
      url: generatedUrl,
      fileName: 'CKYC_Template_Individual_2.pdf',
    });
  });
});
