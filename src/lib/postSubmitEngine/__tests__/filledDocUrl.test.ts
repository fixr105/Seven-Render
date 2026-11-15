import { describe, expect, it } from 'vitest';
import { extractFilledDocUrl } from '../filledDocUrl';

/** Real POSTfull1 shape captured 2026-11-15 on draft recoa21al0APAct0k. */
const REAL_POSTFULL1 = [
  {
    pageCount: 3,
    url: 'https://pdf-temp-files.s3.us-west-2.amazonaws.com/WO73DUERO36IQHLKY3T8Y6WZR4G55NIC/Fintree_Sanction_Letter_20_1__203_20copy.pdf?X-Amz-Expires=3600&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIA4NRRSZPHPZV7KQXY%2F20261115%2Fus-west-2%2Fs3%2Faws4_request&X-Amz-Date=20261115T094951Z&X-Amz-SignedHeaders=host&X-Amz-Signature=0e1f46a79d25b8e71043adbd9413e7e5eae00f4ac215f41daa5b48e114f52acb',
    outputLinkValidTill: '2026-11-15T10:49:50.7694231+00:00',
    jobDuration: 251,
    duration: 0,
    name: 'Fintree_Sanction_Letter_20_1__203_20copy.pdf',
  },
];

describe('extractFilledDocUrl', () => {
  it('accepts the real POSTfull array response and returns the https url', () => {
    const url = extractFilledDocUrl(REAL_POSTFULL1);
    expect(url).toMatch(/^https:\/\//);
    expect(url).toContain('Fintree_Sanction_Letter');
    expect(url).not.toContain(',');
  });

  it('accepts a plain object with url', () => {
    expect(
      extractFilledDocUrl({
        url: 'https://cdn.example.com/a.pdf',
      })
    ).toBe('https://cdn.example.com/a.pdf');
  });

  it('prefers pdf_url over later keys', () => {
    expect(
      extractFilledDocUrl({
        pdf_url: 'https://cdn.example.com/from-pdf-url.pdf',
        url: 'https://cdn.example.com/from-url.pdf',
      })
    ).toBe('https://cdn.example.com/from-pdf-url.pdf');
  });

  it('tries url, fileUrl, file_url, link, publicUrl, public_url, href in order', () => {
    expect(extractFilledDocUrl({ fileUrl: 'https://a.example/f.pdf' })).toBe(
      'https://a.example/f.pdf'
    );
    expect(extractFilledDocUrl({ file_url: 'https://a.example/g.pdf' })).toBe(
      'https://a.example/g.pdf'
    );
    expect(extractFilledDocUrl({ link: 'https://a.example/h.pdf' })).toBe(
      'https://a.example/h.pdf'
    );
    expect(extractFilledDocUrl({ publicUrl: 'https://a.example/i.pdf' })).toBe(
      'https://a.example/i.pdf'
    );
    expect(extractFilledDocUrl({ public_url: 'https://a.example/j.pdf' })).toBe(
      'https://a.example/j.pdf'
    );
    expect(extractFilledDocUrl({ href: 'https://a.example/k.pdf' })).toBe(
      'https://a.example/k.pdf'
    );
  });

  it('rejects non-https, comma-containing, or empty values', () => {
    expect(extractFilledDocUrl({ url: 'http://insecure.example/a.pdf' })).toBe('');
    expect(extractFilledDocUrl({ url: 'https://a.example/a.pdf,https://b.example/b.pdf' })).toBe(
      ''
    );
    expect(extractFilledDocUrl(null)).toBe('');
    expect(extractFilledDocUrl([])).toBe('');
    expect(extractFilledDocUrl({ url: '' })).toBe('');
  });
});
