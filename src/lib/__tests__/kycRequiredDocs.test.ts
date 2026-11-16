import { describe, expect, it } from 'vitest';
import {
  areRequiredKycDocsUploaded,
  buildKycRequiredDocSlots,
  hasCompletedWizardKycDocuments,
  listSavedKycDocuments,
} from '../kycRequiredDocs';

describe('buildKycRequiredDocSlots', () => {
  it('does not add co-applicant slots when mobile is empty', () => {
    const slots = buildKycRequiredDocSlots({
      '_meta.supportPersonType': 'co_applicant',
      'coApplicant.pan': 'ABCDE1234F',
      'coApplicant.mobile': '',
    });
    expect(slots.map((slot) => slot.fieldId)).not.toContain('co_applicant_pan');
  });

  it('keeps RC, loan statement, insurance, and permit optional', () => {
    const formConfig = [
      {
        categoryName: 'Fleet',
        fields: [
          { fieldId: 'field-3b.1', label: 'Vehicle Proforma Invoice', type: 'file', isRequired: true },
          { fieldId: 'field-3b.3', label: 'RC Copy (if takeover)', type: 'file', isRequired: true },
          { fieldId: 'field-3b.4', label: 'Existing Loan Statement (BT cases)', type: 'file', isRequired: true },
          { fieldId: 'field-3b.5', label: 'Insurance Copy', type: 'file', isRequired: true },
          { fieldId: 'field-3b.6', label: 'Permit Copy (if commercial vehicle)', type: 'file', isRequired: true },
        ],
      },
    ];
    const slots = buildKycRequiredDocSlots({}, formConfig);
    expect(slots.find((slot) => slot.fieldId === 'field-3b.1')?.required).toBe(true);
    expect(slots.filter((slot) => !slot.required).map((slot) => slot.fieldId)).toEqual([
      'field-3b.3',
      'field-3b.4',
      'field-3b.5',
      'field-3b.6',
    ]);
    expect(
      areRequiredKycDocsUploaded(
        {
          '_meta.kycDocuments.uploads': {
            'field-3b.1': { url: 'https://cdn.example/invoice.pdf', filename: 'invoice.pdf' },
          },
        },
        formConfig
      )
    ).toBe(true);
  });

  it('adds co-applicant slots even when the product form already has applicant file fields', () => {
    const slots = buildKycRequiredDocSlots(
      {
        '_meta.supportPersonType': 'co_applicant',
        'coApplicant.pan': 'ABCDE1234F',
        'coApplicant.mobile': '9876543210',
      },
      [
        {
          categoryName: 'Documents',
          fields: [
            {
              fieldId: 'field-1a.1',
              label: 'PAN Card',
              type: 'file',
              isRequired: true,
            },
          ],
        },
      ]
    );
    expect(slots.map((slot) => slot.fieldId)).toEqual([
      'field-1a.1',
      'co_applicant_pan',
      'co_applicant_aadhaar',
    ]);
  });
});

describe('listSavedKycDocuments', () => {
  it('reads the documents string when the upload map is empty', () => {
    expect(
      listSavedKycDocuments({
        '_meta.kycDocuments.uploads': {},
        '_meta.kycDocuments.documentsString':
          'aadhaar_front:https://cdn.example.com/a.jpg|a.jpg',
      })
    ).toEqual([
      {
        fieldId: 'aadhaar_front',
        url: 'https://cdn.example.com/a.jpg',
        filename: 'a.jpg',
      },
    ]);
  });
});

describe('hasCompletedWizardKycDocuments', () => {
  it('is true when wizard documentsString + field-* uploads exist (fallback ids would fail)', () => {
    const formData = {
      '_meta.supportPersonType': 'co_applicant',
      '_meta.kycDocuments.documentsString':
        'undefined:https://cdn.example/a.jpg|a.jpg,undefined:https://cdn.example/b.jpg|b.jpg',
      '_meta.kycDocuments.uploads': {
        'field-1a.1': { url: 'https://cdn.example/a.jpg', filename: 'a.jpg' },
        'field-1a.2': { url: 'https://cdn.example/b.jpg', filename: 'b.jpg' },
      },
    };
    expect(areRequiredKycDocsUploaded(formData)).toBe(false);
    expect(hasCompletedWizardKycDocuments(formData)).toBe(true);
  });

  it('is false when documentsString is empty', () => {
    expect(
      hasCompletedWizardKycDocuments({
        '_meta.kycDocuments.uploads': {
          'field-1a.1': { url: 'https://cdn.example/a.jpg', filename: 'a.jpg' },
        },
      })
    ).toBe(false);
  });
});
