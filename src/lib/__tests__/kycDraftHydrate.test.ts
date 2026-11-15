import { describe, expect, it } from 'vitest';
import { mergeEngineLoanRowOverFormData } from '../kycDraftHydrate';

describe('mergeEngineLoanRowOverFormData', () => {
  it('merges Engine Form Data over Express and sets File ID', () => {
    const merged = mergeEngineLoanRowOverFormData(
      { 'borrower.firstName': 'Express', '_meta.other': 'keep' },
      {
        id: 'recX',
        'File ID': 'LIVE-1',
        'Form Data': JSON.stringify({
          'borrower.firstName': 'Engine',
          '_meta.kycDocuments.uploads': {
            pan_card: { url: 'https://x/a.jpg', filename: 'a.jpg' },
          },
        }),
        Documents: 'pan_card:https://x/a.jpg|a.jpg',
      }
    );
    expect(merged['borrower.firstName']).toBe('Engine');
    expect(merged['_meta.other']).toBe('keep');
    expect(merged['_meta.fileId']).toBe('LIVE-1');
    expect(merged['_meta.kycDocuments.documentsString']).toBe(
      'pan_card:https://x/a.jpg|a.jpg'
    );
  });

  it('rebuilds uploads from Documents when uploads meta missing', () => {
    const merged = mergeEngineLoanRowOverFormData(
      {},
      {
        id: 'recY',
        'File ID': 'SF1',
        'Form Data': '{}',
        Documents: 'pan_card:https://x/p.jpg|p.jpg,aadhaar_front:https://x/f.pdf|f.pdf',
      }
    );
    expect(merged['_meta.kycDocuments.uploads']).toEqual({
      pan_card: { url: 'https://x/p.jpg', filename: 'p.jpg' },
      aadhaar_front: { url: 'https://x/f.pdf', filename: 'f.pdf' },
    });
  });
});
