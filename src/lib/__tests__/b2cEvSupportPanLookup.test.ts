import { describe, it, expect } from 'vitest';
import {
  applySupportPersonManualProfilePhase,
  isSupportPanLookupManual,
  isSupportPanLookupProfileReady,
  shouldRefetchSupportPanLookup,
} from '../b2cEvSupportPanLookup';
import { createInitialB2cEvFormData } from '../../config/forms/b2cEvFormSchema';

describe('b2cEvSupportPanLookup manual profile', () => {
  it('enters manual profile phase with meta only and no prefill', () => {
    const formData = {
      ...createInitialB2cEvFormData(),
      '_meta.supportPersonType': 'co_applicant',
      '_meta.supportPanLookup.mobileNumber': '9876543211',
      '_meta.supportPanLookup.panNumber': 'FGHIJ5678K',
      '_meta.supportPanLookup.fullName': 'PRIYA SHARMA',
      'coApplicant.name': 'Old Name',
      'coApplicant.pan': 'OLDPAN1234A',
    };

    const next = applySupportPersonManualProfilePhase(formData, 'coApplicant', 'hash-1');

    expect(next['_meta.supportPanLookup.status']).toBe('manual');
    expect(next['_meta.supportPanLookup.phase']).toBe('profile');
    expect(next['coApplicant.name']).toBeUndefined();
    expect(next['coApplicant.pan']).toBeUndefined();
    expect(isSupportPanLookupManual(next)).toBe(true);
    expect(isSupportPanLookupProfileReady(next)).toBe(true);
  });

  it('does not refetch when manual with same hash and no address', () => {
    const formData = {
      ...createInitialB2cEvFormData(),
      '_meta.supportPersonType': 'co_applicant',
      '_meta.supportPanLookup.mobileNumber': '9876543211',
      '_meta.supportPanLookup.panNumber': 'FGHIJ5678K',
      '_meta.supportPanLookup.fullName': 'PRIYA SHARMA',
      '_meta.supportPanLookup.email': '',
      '_meta.supportPanLookup.status': 'manual',
      '_meta.supportPanLookup.inputHash': 'co_applicant|9876543211|FGHIJ5678K|PRIYA SHARMA|',
    };

    expect(shouldRefetchSupportPanLookup(formData)).toBe(false);
  });
});
