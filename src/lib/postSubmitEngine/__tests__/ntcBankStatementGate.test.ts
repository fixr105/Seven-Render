import { describe, expect, it } from 'vitest';
import {
  formatAllFailedReasons,
  isOnlyNtcBankStatementRequired,
  routeAfterQualifyFail,
} from '../ntcBankStatementGate';

describe('isOnlyNtcBankStatementRequired', () => {
  it('returns true when every failed rule is NTC_BANK_STATEMENT_REQUIRED', () => {
    expect(
      isOnlyNtcBankStatementRequired({
        ok: true,
        pass: false,
        kill_code: 'NTC_BANK_STATEMENT_REQUIRED',
        failed: [
          {
            parameter: 'ntc',
            rejection_code: 'NTC_BANK_STATEMENT_REQUIRED',
          },
        ],
      })
    ).toBe(true);
  });

  it('returns true when multiple failed rows are all NTC', () => {
    expect(
      isOnlyNtcBankStatementRequired({
        pass: false,
        failed: [
          { rejection_code: 'NTC_BANK_STATEMENT_REQUIRED' },
          { rejection_code: 'NTC_BANK_STATEMENT_REQUIRED' },
        ],
      })
    ).toBe(true);
  });

  it('returns true when NTC is accompanied only by a score-floor code', () => {
    expect(
      isOnlyNtcBankStatementRequired({
        pass: false,
        failed: [
          { rejection_code: 'NTC_BANK_STATEMENT_REQUIRED' },
          { rejection_code: 'CIBIL_BELOW_680' },
        ],
      })
    ).toBe(true);
  });

  it('returns true when NTC is accompanied only by a bare score parameter', () => {
    expect(
      isOnlyNtcBankStatementRequired({
        pass: false,
        failed: [
          { parameter: 'ntc', rejection_code: 'NTC_BANK_STATEMENT_REQUIRED' },
          { parameter: 'score' },
        ],
      })
    ).toBe(true);
  });

  it('returns false when any non-NTC rejection_code is present', () => {
    expect(
      isOnlyNtcBankStatementRequired({
        pass: false,
        kill_code: 'CC_OVERDUE_GT_5000',
        failed: [
          { rejection_code: 'NTC_BANK_STATEMENT_REQUIRED' },
          { rejection_code: 'CC_OVERDUE_GT_5000' },
        ],
      })
    ).toBe(false);
  });

  it('returns false for empty failed array (every() footgun)', () => {
    expect(isOnlyNtcBankStatementRequired({ pass: false, failed: [] })).toBe(false);
  });

  it('returns false when failed is missing', () => {
    expect(
      isOnlyNtcBankStatementRequired({
        pass: false,
        kill_code: 'NTC_BANK_STATEMENT_REQUIRED',
      })
    ).toBe(false);
  });

  it('returns false for BYYPP3849P-shaped multi-fail payload', () => {
    expect(
      isOnlyNtcBankStatementRequired({
        ok: true,
        pass: false,
        kill_code: 'CC_OVERDUE_GT_5000',
        failed: [
          { parameter: 'cc_overdue', rejection_code: 'CC_OVERDUE_GT_5000' },
          { parameter: 'score' },
          { parameter: 'dpd_3m', rejection_code: 'DPD_FOUND_IN_LAST_3M' },
        ],
      })
    ).toBe(false);
  });
});

describe('routeAfterQualifyFail', () => {
  it('routes to ntc_upload when only NTC failed', () => {
    expect(
      routeAfterQualifyFail({
        pass: false,
        failed: [{ rejection_code: 'NTC_BANK_STATEMENT_REQUIRED' }],
      })
    ).toBe('ntc_upload');
  });

  it('routes to ntc_upload when NTC is accompanied only by CIBIL_BELOW_680', () => {
    expect(
      routeAfterQualifyFail({
        pass: false,
        failed: [
          { rejection_code: 'NTC_BANK_STATEMENT_REQUIRED' },
          { rejection_code: 'CIBIL_BELOW_680' },
        ],
      })
    ).toBe('ntc_upload');
  });

  it('routes to ntc_upload when NTC is accompanied only by a bare score parameter', () => {
    expect(
      routeAfterQualifyFail({
        pass: false,
        failed: [
          { rejection_code: 'NTC_BANK_STATEMENT_REQUIRED' },
          { parameter: 'cibil_score' },
        ],
      })
    ).toBe('ntc_upload');
  });

  it('routes to rejected when NTC is accompanied by a non-score failure', () => {
    expect(
      routeAfterQualifyFail({
        pass: false,
        failed: [
          { rejection_code: 'NTC_BANK_STATEMENT_REQUIRED' },
          { rejection_code: 'CC_OVERDUE_GT_5000' },
        ],
      })
    ).toBe('rejected');
  });

  it('routes to rejected when pass is true (caller should not use this)', () => {
    expect(routeAfterQualifyFail({ pass: true, failed: [] })).toBe('rejected');
  });
});

describe('formatAllFailedReasons', () => {
  it('lists all unique rejection codes', () => {
    const text = formatAllFailedReasons({
      pass: false,
      failed: [
        { rejection_code: 'CC_OVERDUE_GT_5000' },
        { rejection_code: 'DPD_FOUND_IN_LAST_3M' },
        { rejection_code: 'CC_OVERDUE_GT_5000' },
      ],
    });
    expect(text).toContain('CC_OVERDUE_GT_5000');
    expect(text).toContain('DPD_FOUND_IN_LAST_3M');
  });
});
