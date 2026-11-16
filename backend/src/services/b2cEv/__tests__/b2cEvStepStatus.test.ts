import { describe, expect, it } from '@jest/globals';
import { isKamComplianceOpen } from '../b2cEvStepStatus.js';

describe('open KAM steps from real status', () => {
  it('treats an older VKYC Requested file as open', () => {
    expect(isKamComplianceOpen({ '_meta.vkyc.status': 'Requested' }, 'vkyc')).toBe(true);
    expect(isKamComplianceOpen({ '_meta.vkyc.status': 'Link Sent' }, 'vkyc')).toBe(true);
    expect(isKamComplianceOpen({ '_meta.vkyc.status': 'Done' }, 'vkyc')).toBe(false);
  });

  it('opens a saved eNACH account and an unsigned agreement', () => {
    expect(isKamComplianceOpen({ 'enach.accountNumber': '123456789012' }, 'enach')).toBe(true);
    expect(isKamComplianceOpen({ '_meta.esign': { stage: 'pending' } }, 'loanAgreement')).toBe(true);
  });

  it('closes steps that are already complete', () => {
    expect(
      isKamComplianceOpen(
        { 'enach.accountNumber': '123456789012', 'compliance.enachDone': 'true' },
        'enach'
      )
    ).toBe(false);
    expect(isKamComplianceOpen({ '_meta.esign': { stage: 'signed' } }, 'loanAgreement')).toBe(false);
  });
});
