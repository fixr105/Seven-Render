import { describe, it, expect } from 'vitest';
import {
  applySupportPersonManualProfilePhase,
  buildSupportPersonManualProfilePatch,
  isSupportPanLookupManual,
  isSupportPanLookupProfileReady,
} from '../b2cEvSupportPanLookup';
import { createInitialB2cEvFormData } from '../../config/forms/b2cEvFormSchema';

describe('b2cEvSupportPanLookup manual profile', () => {
  it('seeds profile fields from PAN lookup inputs', () => {
    const formData = {
      ...createInitialB2cEvFormData(),
      '_meta.supportPersonType': 'co_applicant',
      '_meta.supportPanLookup.mobileNumber': '9876543211',
      '_meta.supportPanLookup.panNumber': 'FGHIJ5678K',
      '_meta.supportPanLookup.fullName': 'PRIYA SHARMA',
      '_meta.supportPanLookup.email': 'priya@example.com',
    };

    expect(buildSupportPersonManualProfilePatch(formData, 'coApplicant')).toEqual({
      'coApplicant.name': 'PRIYA SHARMA',
      'coApplicant.pan': 'FGHIJ5678K',
      'coApplicant.mobile': '9876543211',
      'coApplicant.email': 'priya@example.com',
    });
  });

  it('enters manual profile phase with status manual', () => {
    const formData = {
      ...createInitialB2cEvFormData(),
      '_meta.supportPersonType': 'co_applicant',
      '_meta.supportPanLookup.mobileNumber': '9876543211',
      '_meta.supportPanLookup.panNumber': 'FGHIJ5678K',
      '_meta.supportPanLookup.fullName': 'PRIYA SHARMA',
    };

    const next = applySupportPersonManualProfilePhase(formData, 'coApplicant', 'hash-1');

    expect(next['_meta.supportPanLookup.status']).toBe('manual');
    expect(next['_meta.supportPanLookup.phase']).toBe('profile');
    expect(next['coApplicant.name']).toBe('PRIYA SHARMA');
    expect(next['coApplicant.pan']).toBe('FGHIJ5678K');
    expect(isSupportPanLookupManual(next)).toBe(true);
    expect(isSupportPanLookupProfileReady(next)).toBe(true);
  });
});
