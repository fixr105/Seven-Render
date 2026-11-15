import { describe, expect, it } from 'vitest';
import {
  decideQualifyAdvance,
  hasStrictQualifyPass,
  isPostQualifyLockedPhase,
} from '../qualifyPassGate';

/** Live-shaped fail payload for PAN BYYPP3849P / 9041677762 */
const GAURAV_FAIL = {
  ok: true,
  pass: false,
  score: null,
  kill_code: 'CC_OVERDUE_GT_5000',
  borrower_message:
    "Sorry, this application does not meet the lender's current criteria.",
  bureau_ref: 'AL6af8a7ed455e6eef248c45f2',
  is_ntc: false,
  missing: [],
  failed: [
    { parameter: 'cc_overdue', rejection_code: 'CC_OVERDUE_GT_5000' },
    { parameter: 'score' },
    { parameter: 'dpd_3m', rejection_code: 'DPD_FOUND_IN_LAST_3M' },
  ],
};

describe('hasStrictQualifyPass', () => {
  it('returns false for BYYPP3849P-shaped fail (pass !== true)', () => {
    expect(hasStrictQualifyPass(GAURAV_FAIL)).toBe(false);
  });

  it('returns false when result is null/undefined/missing pass', () => {
    expect(hasStrictQualifyPass(null)).toBe(false);
    expect(hasStrictQualifyPass(undefined)).toBe(false);
    expect(hasStrictQualifyPass({ ok: true })).toBe(false);
    expect(hasStrictQualifyPass({ ok: true, pass: false })).toBe(false);
  });

  it('returns true only when pass === true (strict)', () => {
    expect(hasStrictQualifyPass({ ok: true, pass: true, score: 720 })).toBe(true);
    expect(hasStrictQualifyPass({ pass: true })).toBe(true);
    expect(hasStrictQualifyPass({ pass: 'true' as unknown as boolean })).toBe(false);
  });
});

describe('decideQualifyAdvance', () => {
  it('MUST NOT advance for BYYPP3849P fail payload', () => {
    const decision = decideQualifyAdvance(GAURAV_FAIL);
    expect(decision.advance).toBe(false);
    if (decision.advance) throw new Error('expected reject');
    expect(decision.raw.pass).toBe(false);
    expect(decision.reason.length).toBeGreaterThan(0);
  });

  it('advances only when pass === true', () => {
    const decision = decideQualifyAdvance({
      ok: true,
      pass: true,
      score: 710,
      bureau_ref: 'AL1',
    });
    expect(decision.advance).toBe(true);
  });

  it('does not advance when ok true but pass missing', () => {
    expect(decideQualifyAdvance({ ok: true, bureau_ref: 'AL1' }).advance).toBe(false);
  });

  it('advances score-only null kill when known bureau score is 807', () => {
    const decision = decideQualifyAdvance(
      {
        ok: true,
        pass: false,
        kill_code: 'KILLED',
        failed: [{ parameter: 'score' }],
        bureau_ref: 'AL-govind',
      },
      { knownBureauScore: 807 }
    );
    expect(decision.advance).toBe(true);
    if (!decision.advance) throw new Error('expected advance');
    expect(decision.raw.pass).toBe(true);
    expect(decision.raw.score_reconciled).toBe(true);
  });

  it('advances score-only null kill when bureau score is unknown', () => {
    const decision = decideQualifyAdvance({
      ok: true,
      pass: false,
      kill_code: 'KILLED',
      failed: [{ parameter: 'score' }],
    });
    expect(decision.advance).toBe(true);
    if (!decision.advance) throw new Error('expected advance');
    expect(decision.raw.pass).toBe(true);
  });

  it('rejects score-only null kill when known bureau score is below 680', () => {
    const decision = decideQualifyAdvance(
      {
        ok: true,
        pass: false,
        kill_code: 'KILLED',
        failed: [{ parameter: 'score' }],
      },
      { knownBureauScore: 600 }
    );
    expect(decision.advance).toBe(false);
    if (decision.advance) throw new Error('expected reject');
    expect(decision.reason).toMatch(/below minimum/i);
  });
});

describe('isPostQualifyLockedPhase', () => {
  it('locks documents, rank, offer, enach, and later steps', () => {
    expect(isPostQualifyLockedPhase('documents')).toBe(true);
    expect(isPostQualifyLockedPhase('lender_rank')).toBe(true);
    expect(isPostQualifyLockedPhase('offer')).toBe(true);
    expect(isPostQualifyLockedPhase('enach')).toBe(true);
    expect(isPostQualifyLockedPhase('doc_fill')).toBe(true);
    expect(isPostQualifyLockedPhase('qualify')).toBe(false);
    expect(isPostQualifyLockedPhase('rejected')).toBe(false);
    expect(isPostQualifyLockedPhase('not_eligible')).toBe(false);
  });
});
