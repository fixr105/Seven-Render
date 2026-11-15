import { describe, expect, it } from 'vitest';
import {
  areRequiredKycDocsUploaded,
  hasCompletedWizardKycDocuments,
} from '../kycRequiredDocs';

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
