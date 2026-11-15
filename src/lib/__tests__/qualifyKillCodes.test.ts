import { describe, expect, it } from 'vitest';
import {
  collectHumanQualifyReasons,
  decideSection1LenderOutcome,
  humanizeQualifyCode,
  SCORE_UNVERIFIED_MESSAGE,
} from '../qualifyKillCodes';

const SCORE_ONLY_NULL_KILL = {
  ok: true,
  pass: false,
  kill_code: 'KILLED',
  failed: [{ parameter: 'score' }],
  bureau_ref: 'AL-govind',
};

describe('humanizeQualifyCode', () => {
  it('maps known kill codes', () => {
    expect(humanizeQualifyCode('CC_OVERDUE_GT_5000')).toBe(
      'Credit card overdue amount exceeds limit'
    );
  });

  it('falls back for unknown codes', () => {
    expect(humanizeQualifyCode('SOMETHING_NEW')).toBe(
      'Does not meet current lending criteria'
    );
  });
});

describe('decideSection1LenderOutcome', () => {
  it('returns found when pass === true', () => {
    const outcome = decideSection1LenderOutcome({
      ok: true,
      pass: true,
      score: 807,
      bureau_ref: 'AL1',
    });
    expect(outcome.kind).toBe('found');
  });

  it('returns ntc when only NTC_BANK_STATEMENT_REQUIRED failed', () => {
    const outcome = decideSection1LenderOutcome({
      ok: true,
      pass: false,
      failed: [{ rejection_code: 'NTC_BANK_STATEMENT_REQUIRED' }],
    });
    expect(outcome.kind).toBe('ntc');
  });

  it('soft-blocks when 2 or fewer failed criteria', () => {
    const outcome = decideSection1LenderOutcome({
      ok: true,
      pass: false,
      kill_code: 'KILLED',
      failed: [{ parameter: 'score' }, { rejection_code: 'CC_OVERDUE_GT_5000' }],
    });
    expect(outcome.kind).toBe('soft_block');
    if (outcome.kind !== 'soft_block') throw new Error('expected soft_block');
    expect(outcome.reasons).toContain(SCORE_UNVERIFIED_MESSAGE);
    expect(outcome.reasons.some((r) => /credit card overdue/i.test(r))).toBe(true);
    expect(outcome.reasons).not.toContain('Does not meet current lending criteria');
  });

  it('hard-rejects when more than 2 failed criteria and splits preview/overflow', () => {
    const outcome = decideSection1LenderOutcome({
      ok: true,
      pass: false,
      failed: [
        { rejection_code: 'CC_OVERDUE_GT_5000' },
        { rejection_code: 'DPD_FOUND_IN_LAST_3M' },
        { rejection_code: 'DPD_FOUND_IN_LAST_6M' },
        { rejection_code: 'OVERDUE_FOUND_IN_LAST_12M' },
      ],
    });
    expect(outcome.kind).toBe('hard_reject');
    if (outcome.kind !== 'hard_reject') throw new Error('expected hard_reject');
    expect(outcome.preview).toHaveLength(2);
    expect(outcome.overflow.length).toBeGreaterThanOrEqual(1);
    expect(outcome.reasons.length).toBe(outcome.preview.length + outcome.overflow.length);
  });

  it('treats score-only null kill + known 807 as found', () => {
    const outcome = decideSection1LenderOutcome(SCORE_ONLY_NULL_KILL, {
      knownBureauScore: 807,
    });
    expect(outcome.kind).toBe('found');
  });

  it('soft-blocks score-only null kill when known score is below 680', () => {
    const outcome = decideSection1LenderOutcome(SCORE_ONLY_NULL_KILL, {
      knownBureauScore: 600,
    });
    expect(outcome.kind).toBe('soft_block');
    if (outcome.kind !== 'soft_block') throw new Error('expected soft_block');
    expect(outcome.reasons).toEqual(['Does not meet current lending criteria']);
  });

  it('treats score-only null kill with unknown bureau score as found', () => {
    const outcome = decideSection1LenderOutcome(SCORE_ONLY_NULL_KILL);
    expect(outcome.kind).toBe('found');
  });

  it('still soft-blocks real CIBIL_BELOW_680 rejection_code', () => {
    const outcome = decideSection1LenderOutcome({
      ok: true,
      pass: false,
      failed: [{ rejection_code: 'CIBIL_BELOW_680' }],
    });
    expect(outcome.kind).toBe('soft_block');
    if (outcome.kind !== 'soft_block') throw new Error('expected soft_block');
    expect(outcome.reasons).toEqual(['Does not meet current lending criteria']);
  });
});

describe('collectHumanQualifyReasons', () => {
  it('dedupes plain-English reasons', () => {
    const reasons = collectHumanQualifyReasons({
      pass: false,
      failed: [
        { rejection_code: 'CIBIL_BELOW_680' },
        { rejection_code: 'CIBIL_BELOW_650' },
      ],
    });
    expect(reasons).toEqual(['Does not meet current lending criteria']);
  });

  it('does not say below minimum when score is null; does not stack KILLED', () => {
    const reasons = collectHumanQualifyReasons(SCORE_ONLY_NULL_KILL);
    expect(reasons).toEqual([SCORE_UNVERIFIED_MESSAGE]);
  });

  it('never shows both unverified and below-minimum for the same fail', () => {
    const reasons = collectHumanQualifyReasons({
      ok: true,
      pass: false,
      score: null,
      failed: [
        { parameter: 'score' },
        { parameter: 'cibil_score', rejection_code: 'CIBIL_BELOW_680' },
        { rejection_code: 'CC_OVERDUE_GT_5000' },
      ],
    });
    expect(reasons).toContain('Does not meet current lending criteria');
    expect(reasons).toContain('Credit card overdue amount exceeds limit');
    expect(reasons).not.toContain(SCORE_UNVERIFIED_MESSAGE);
  });
});
