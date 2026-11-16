import { describe, expect, it } from 'vitest';
import { buildRequiredDocsFromAirtable, formatDocumentsField } from '../requiredDocs';

describe('buildRequiredDocsFromAirtable', () => {
  it('uses fallback docs when Airtable is empty', () => {
    const docs = buildRequiredDocsFromAirtable([], false);
    expect(docs.some((d) => d.fieldId === 'pan_card' && d.required)).toBe(true);
    expect(docs.some((d) => d.fieldId === 'bank_statement' && !d.required)).toBe(true);
    expect(docs.some((d) => d.fieldId === 'co_applicant_pan')).toBe(false);
  });

  it('keeps takeover, balance-transfer, insurance, and permit uploads optional', () => {
    const docs = buildRequiredDocsFromAirtable(
      [
        { 'Document Name': 'Vehicle Proforma Invoice', 'Field ID': 'field-3b.1', Required: 'True' },
        { 'Document Name': 'RC Copy (if takeover)', 'Field ID': 'field-3b.3', Required: 'True' },
        { 'Document Name': 'Existing Loan Statement (BT cases)', 'Field ID': 'field-3b.4', Required: 'True' },
        { 'Document Name': 'Insurance Copy', 'Field ID': 'field-3b.5', Required: 'True' },
        { 'Document Name': 'Permit Copy (if commercial vehicle)', 'Field ID': 'field-3b.6', Required: 'True' },
      ],
      false
    );
    expect(docs.find((doc) => doc.fieldId === 'field-3b.1')?.required).toBe(true);
    expect(docs.filter((doc) => !doc.required).map((doc) => doc.fieldId)).toEqual([
      'field-3b.3',
      'field-3b.4',
      'field-3b.5',
      'field-3b.6',
    ]);
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
