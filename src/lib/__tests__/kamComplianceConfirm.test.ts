import { describe, expect, it } from 'vitest';
import {
  applyKamComplianceConfirmation,
  canConfirmKamCompliance,
  isComplianceChecklistComplete,
  isKamComplianceConfirmationDone,
  kamComplianceConfirmMessage,
  kamSigningProgressLabel,
  kamStampProgressLabel,
  loanAgreementDoneSuffix,
  readKamComplianceConfirmation,
  shouldFillLoanDocs,
} from '../kamComplianceConfirm';

const done = {
  status: 'done' as const,
  confirmedBy: 'kam@test.local',
  confirmedAt: '2026-11-15T09:00:00.000Z',
};

describe('kamComplianceConfirm', () => {
  it('writes a done confirmation once and ignores a second write', () => {
    const first = applyKamComplianceConfirmation({}, 'ekyc', {
      confirmedBy: 'kam@test.local',
      confirmedAt: '2026-11-15T09:00:00.000Z',
    });
    expect(first.wrote).toBe(true);
    expect(first.formData['_meta.compliance.ekyc']).toEqual(done);
    expect(isKamComplianceConfirmationDone(first.formData, 'ekyc')).toBe(true);

    const second = applyKamComplianceConfirmation(first.formData, 'ekyc', {
      confirmedBy: 'other@test.local',
      confirmedAt: '2026-11-16T09:00:00.000Z',
    });
    expect(second.wrote).toBe(false);
    expect(readKamComplianceConfirmation(second.formData, 'ekyc')).toEqual(done);
  });

  it('reads a JSON-string confirmation', () => {
    const form = { '_meta.compliance.enach': JSON.stringify(done) };
    expect(readKamComplianceConfirmation(form, 'enach')).toEqual(done);
  });

  it('builds the confirm copy', () => {
    expect(kamComplianceConfirmMessage('ekyc', 'Ajay Kumar')).toBe(
      'Confirm eKYC is complete for Ajay Kumar on Fintree?'
    );
    expect(kamComplianceConfirmMessage('loanAgreement', 'Ajay Kumar')).toBe(
      'Confirm the loan agreement is ready for Ajay Kumar? This will start stamp ordering and e-signing.'
    );
    expect(kamComplianceConfirmMessage('enach', 'Ajay Kumar')).toBe(
      'Confirm eNACH mandate is registered for Ajay Kumar?'
    );
  });

  it('fills documents only when stamp checks have not started and a doc URL is missing', () => {
    expect(shouldFillLoanDocs({})).toBe(true);
    expect(
      shouldFillLoanDocs({
        '_meta.docs.sanctionLetter': 'https://files.example/s.pdf',
        '_meta.docs.loanAgreement': 'https://files.example/a.pdf',
        '_meta.docs.ckyc': 'https://files.example/c.pdf',
      })
    ).toBe(false);
    expect(shouldFillLoanDocs({ '_meta.stamps': { accessKey: 'uuid-already' } })).toBe(false);
    expect(
      shouldFillLoanDocs({ '_meta.signing': { pack_url: 'https://files.example/pack.pdf' } })
    ).toBe(false);
  });

  it('maps stamp and signing meta to the KAM status lines', () => {
    expect(kamStampProgressLabel({ '_meta.stamps': { accessKey: 'uuid' } })).toBe(
      'Ordering stamp papers…'
    );
    expect(
      kamStampProgressLabel({
        '_meta.stamps': {
          accessKey: 'uuid',
          orders: [{ stage: 'completed' }, { stage: 'completed' }, { stage: 'completed' }],
        },
      })
    ).toBe('3 of 3 stamps ready');
    expect(
      kamStampProgressLabel({ '_meta.signing': { pack_url: 'https://files.example/pack.pdf' } })
    ).toBe('Signing pack built');

    expect(kamSigningProgressLabel({ '_meta.esign': { documentId: 'doc-1', stage: 'pending' } })).toBe(
      'Sent for signing'
    );
    expect(
      kamSigningProgressLabel({
        '_meta.esign': {
          documentId: 'doc-1',
          stage: 'pending',
          signatories: [{ status: 'signed' }, { status: 'pending' }],
        },
      })
    ).toBe('Applicant signed');
    expect(kamSigningProgressLabel({ '_meta.esign': { documentId: 'doc-1', stage: 'signed' } })).toBe(
      'Both signed ✓'
    );
  });

  it('appends the loan-agreement progress phrase', () => {
    expect(loanAgreementDoneSuffix({})).toBe('— Stamps & signing started');
    expect(loanAgreementDoneSuffix({ '_meta.stamps': { accessKey: 'uuid' } })).toBe(
      '— Stamps & signing in progress'
    );
    expect(loanAgreementDoneSuffix({ '_meta.esign': { stage: 'signed', documentId: 'doc-1' } })).toBe(
      ''
    );
  });

  it('is complete only when VKYC and the three confirmations are done', () => {
    const form = {
      'compliance.vkycDone': 'true',
      '_meta.compliance.ekyc': done,
      '_meta.compliance.loanAgreement': done,
      '_meta.compliance.enach': done,
    };
    expect(isComplianceChecklistComplete(form)).toBe(true);
    expect(isComplianceChecklistComplete({ ...form, '_meta.compliance.enach': undefined })).toBe(
      false
    );
  });

  it('allows only kam and admin to confirm', () => {
    expect(canConfirmKamCompliance('kam')).toBe(true);
    expect(canConfirmKamCompliance('admin')).toBe(true);
    expect(canConfirmKamCompliance('client')).toBe(false);
    expect(canConfirmKamCompliance('dealer')).toBe(false);
  });
});
