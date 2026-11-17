import { describe, expect, it } from 'vitest';
import {
  doStatusLabel,
  isKamComplianceOpen,
  kamComplianceStatusLabel,
} from '../b2cEvStepStatus';

describe('b2cEvStepStatus', () => {
  it('treats a VKYC Links status of Requested as an open KAM request', () => {
    const formData = { '_meta.vkyc.status': 'Requested' };
    expect(isKamComplianceOpen(formData, 'vkyc')).toBe(true);
    expect(kamComplianceStatusLabel(formData, 'vkyc')).toBe('Requested');
  });

  it('treats Link Sent as open and Done as complete', () => {
    expect(isKamComplianceOpen({ '_meta.vkyc.status': 'Link Sent' }, 'vkyc')).toBe(true);
    expect(isKamComplianceOpen({ '_meta.vkyc.status': 'Done' }, 'vkyc')).toBe(false);
    expect(kamComplianceStatusLabel({ 'compliance.vkycDone': 'true' }, 'vkyc')).toBe('Done');
  });

  it('treats a KAM eNACH or loan agreement confirmation as done', () => {
    const done = { status: 'done', confirmedBy: 'kam@test.local', confirmedAt: '2026-11-15T09:00:00.000Z' };
    expect(kamComplianceStatusLabel({ '_meta.compliance.enach': done }, 'enach')).toBe('Done');
    expect(isKamComplianceOpen({ '_meta.compliance.enach': done }, 'enach')).toBe(false);
    expect(
      kamComplianceStatusLabel({ '_meta.compliance.loanAgreement': done }, 'loanAgreement')
    ).toBe('Done');
    expect(
      isKamComplianceOpen({ '_meta.compliance.loanAgreement': done }, 'loanAgreement')
    ).toBe(false);
  });

  it('opens eNACH when an account is saved and closes it when confirmed', () => {
    const saved = { 'enach.accountNumber': '123456789012' };
    expect(isKamComplianceOpen(saved, 'enach')).toBe(true);
    expect(kamComplianceStatusLabel(saved, 'enach')).toBe('Needs confirmation');
    expect(
      isKamComplianceOpen({ ...saved, 'compliance.enachDone': 'true' }, 'enach')
    ).toBe(false);
  });

  it('opens an unsigned agreement and treats a signed stage as complete', () => {
    expect(isKamComplianceOpen({ '_meta.esign': { stage: 'pending' } }, 'loanAgreement')).toBe(true);
    expect(kamComplianceStatusLabel({ '_meta.esign': { stage: 'pending' } }, 'loanAgreement')).toBe(
      'pending'
    );
    expect(isKamComplianceOpen({ '_meta.esign': { stage: 'signed' } }, 'loanAgreement')).toBe(false);
    expect(kamComplianceStatusLabel({ '_meta.esign': { stage: 'signed' } }, 'loanAgreement')).toBe(
      'signed'
    );
  });

  it('reads DO status from the request record', () => {
    expect(doStatusLabel({ '_meta.doRequest.requestedAt': '2026-01-01' })).toBe('Requested');
    expect(doStatusLabel({ '_meta.doRequest.status': 'approved' })).toBe('approved');
    expect(doStatusLabel({ '_meta.doRequest.status': 'rejected' })).toBe('rejected');
  });
});
