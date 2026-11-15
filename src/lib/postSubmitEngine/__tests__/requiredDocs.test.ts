import { describe, expect, it } from 'vitest';
import { buildRequiredDocsFromAirtable, formatDocumentsField } from '../requiredDocs';

describe('buildRequiredDocsFromAirtable', () => {
  it('uses fallback docs when Airtable is empty', () => {
    const docs = buildRequiredDocsFromAirtable([], false);
    expect(docs.some((d) => d.fieldId === 'pan_card' && d.required)).toBe(true);
    expect(docs.some((d) => d.fieldId === 'bank_statement' && !d.required)).toBe(true);
    expect(docs.some((d) => d.fieldId === 'co_applicant_pan')).toBe(false);
  });

  it('appends co-applicant docs when needed', () => {
    const docs = buildRequiredDocsFromAirtable(undefined, true);
    expect(docs.some((d) => d.fieldId === 'co_applicant_pan')).toBe(true);
  });
});

describe('formatDocumentsField', () => {
  it('joins fieldId:url|filename with commas', () => {
    expect(
      formatDocumentsField({
        pan_card: { fieldId: 'pan_card', url: 'https://x/pan.jpg', filename: 'pan.jpg' },
        aadhaar_front: {
          fieldId: 'aadhaar_front',
          url: 'https://x/a.jpg',
          filename: 'a.jpg',
        },
      })
    ).toBe('pan_card:https://x/pan.jpg|pan.jpg,aadhaar_front:https://x/a.jpg|a.jpg');
  });
});
