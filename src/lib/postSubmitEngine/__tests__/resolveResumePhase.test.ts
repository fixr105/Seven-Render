import { describe, expect, it } from 'vitest';
import {
  buildResumeSession,
  enginePhaseForResume,
  resolveResumePhase,
  wizardUrlMayApply,
} from '../resolveResumePhase';

describe('resolveResumePhase', () => {
  it('opens delivery when esign stage is signed', () => {
    const form = { '_meta.esign': { stage: 'signed', documentId: 'doc-1' } };
    expect(resolveResumePhase(form)).toBe('delivery');
    expect(enginePhaseForResume(form)).toBe('done');
  });

  it('opens signing status when documentId exists and stage is not signed', () => {
    const form = { '_meta.esign': { documentId: 'doc-1', stage: 'pending' } };
    expect(resolveResumePhase(form)).toBe('signing');
    expect(enginePhaseForResume(form)).toBe('esign_step');
  });

  it('does not treat an empty documentId as signing', () => {
    const form = { '_meta.esign': { documentId: '' } };
    expect(resolveResumePhase(form)).toBe('wizard');
  });

  it('opens signing when the pack url exists and signing was not sent', () => {
    const form = { '_meta.signing': { pack_url: 'https://cdn.example/pack.pdf' } };
    expect(resolveResumePhase(form)).toBe('signing');
    expect(enginePhaseForResume(form)).toBe('esign_step');
  });

  it('opens stamp status when an access key exists', () => {
    const form = { '_meta.stamps': { accessKey: 'ABCD1234' } };
    expect(resolveResumePhase(form)).toBe('stamps');
    expect(enginePhaseForResume(form)).toBe('stamp_step');
  });

  it('does not open stamps for an empty stamp object or blank document urls', () => {
    expect(resolveResumePhase({ '_meta.stamps': {} })).toBe('wizard');
    expect(resolveResumePhase({ '_meta.stamps': { accessKey: '' } })).toBe('wizard');
    expect(
      resolveResumePhase({
        '_meta.docs.sanctionLetter': '',
        '_meta.docs.loanAgreement': '',
        '_meta.docs.ckyc': '',
      })
    ).toBe('wizard');
    expect(resolveResumePhase({ '_meta.docs.sanctionLetter': '' })).toBe('wizard');
  });

  it('opens stamps when all three loan documents exist', () => {
    const form = {
      '_meta.docs.sanctionLetter': 'https://files.example/sanction.pdf',
      '_meta.docs.loanAgreement': 'https://files.example/agreement.pdf',
      '_meta.docs.ckyc': 'https://files.example/ckyc.pdf',
    };
    expect(resolveResumePhase(form)).toBe('stamps');
    expect(enginePhaseForResume(form)).toBe('stamp_step');
  });

  it('opens post-offer when only some documents exist', () => {
    expect(
      resolveResumePhase({
        '_meta.docs.sanctionLetter': 'https://files.example/sanction.pdf',
        '_meta.pricing': { roi_pct: 28 },
      })
    ).toBe('post_offer');
  });

  it('opens eNACH when pricing exists and the account number is empty', () => {
    const form = { '_meta.pricing': { roi_pct: 28 }, 'enach.accountNumber': '' };
    expect(resolveResumePhase(form)).toBe('post_offer');
    expect(enginePhaseForResume(form)).toBe('enach');
  });

  it('opens document prep when pricing exists and the account number is filled', () => {
    const form = { '_meta.pricing': { roi_pct: 28 }, 'enach.accountNumber': '1234567890' };
    expect(resolveResumePhase(form)).toBe('post_offer');
    expect(enginePhaseForResume(form)).toBe('doc_fill');
  });

  it('opens offers when a qualify pass is persisted and nothing later exists', () => {
    const form = { '_meta.qualifyResult': { pass: true } };
    expect(resolveResumePhase(form)).toBe('post_qualify');
    expect(enginePhaseForResume(form)).toBe('offer');
  });

  it('opens eligibility only when the deadline has both timestamps', () => {
    expect(
      resolveResumePhase({ '_meta.deadline': { deadline_at: '2026-11-16T09:48:28.850Z' } })
    ).toBe('wizard');
    const form = {
      '_meta.deadline': {
        started_at: '2026-11-15T09:48:28.850Z',
        deadline_at: '2026-11-16T09:48:28.850Z',
      },
    };
    expect(resolveResumePhase(form)).toBe('request_do');
    expect(enginePhaseForResume(form)).toBe('qualify');
  });

  it('ignores a blank rate and a non-https pack url', () => {
    expect(resolveResumePhase({ '_meta.pricing': { roi_pct: '' } })).toBe('wizard');
    expect(resolveResumePhase({ '_meta.pricing': { roi_pct: 0 } })).toBe('wizard');
    expect(resolveResumePhase({ '_meta.signing': { pack_url: 'not-a-url' } })).toBe('wizard');
  });

  it('stays on the wizard when there is no meta', () => {
    expect(resolveResumePhase({})).toBe('wizard');
    expect(enginePhaseForResume({})).toBeNull();
    expect(buildResumeSession({ '_meta.wizard.lastStageId': 'support-person' }, 'rec1')).toBeNull();
  });

  it('builds a resume session for a stamp file', () => {
    const session = buildResumeSession(
      {
        '_meta.fileId': 'SFMWHK65WO',
        '_meta.stamps': { accessKey: 'ABCD' },
      },
      'recoa21al0APAct0k'
    );
    expect(session).toMatchObject({
      fileId: 'SFMWHK65WO',
      recordId: 'recoa21al0APAct0k',
      resumePhase: 'stamp_step',
    });
  });

  it('opens offers when rank already started and pricing is stored', () => {
    const form = {
      '_meta.postSubmitFlags': { rankStarted: true },
      '_meta.pricing': { roi_pct: 28 },
    };
    expect(enginePhaseForResume(form)).toBe('offer');
  });

  it('opens offers without calling qualify when qualify already fired and passed', () => {
    const form = {
      '_meta.postSubmitFlags': { qualifyFired: true },
      '_meta.qualifyResult': { pass: true },
    };
    expect(resolveResumePhase(form)).toBe('post_qualify');
    expect(enginePhaseForResume(form)).toBe('offer');
    expect(buildResumeSession(form, 'rec1')?.resumePhase).toBe('offer');
  });

  it('ignores a wizard stage query once all three documents exist', () => {
    const form = {
      '_meta.docs.sanctionLetter': 'https://cdn.example/sanction.pdf',
      '_meta.docs.loanAgreement': 'https://cdn.example/agreement.pdf',
      '_meta.docs.ckyc': 'https://cdn.example/ckyc.pdf',
    };
    expect(resolveResumePhase(form)).toBe('stamps');
    expect(wizardUrlMayApply(form)).toBe(false);
  });

  it('does not let a stale phase hint override a signed file', () => {
    expect(
      resolveResumePhase({
        '_meta.postSubmitPhase': 'stamps',
        '_meta.esign': { stage: 'signed' },
      })
    ).toBe('delivery');
  });
});
