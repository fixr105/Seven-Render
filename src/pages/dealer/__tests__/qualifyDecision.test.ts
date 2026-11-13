import { describe, expect, it } from 'vitest';
import { decideQualifyResult, engineQualifyBlock, engineQualifyBlockMessage } from '../qualifyDecision';

describe('decideQualifyResult', () => {
  it('continues only when the tool ran and the applicant passed', () => {
    expect(decideQualifyResult({
      ok: true,
      pass: true,
      is_ntc: false,
      kill_code: null,
      failed: [],
      score: 742,
    })).toBe('pass');
  });

  it('rejects a completed check that did not pass, including new-to-credit', () => {
    expect(decideQualifyResult({
      ok: true,
      pass: false,
      is_ntc: true,
      kill_code: 'DPD_FOUND_IN_LAST_3M',
      failed: [{ rejection_code: 'DPD_FOUND_IN_LAST_3M' }],
    })).toBe('fail');
  });

  it('treats config errors, bureau errors, and malformed payloads as retryable failures', () => {
    expect(decideQualifyResult({ ok: false, state: 'CONFIG_ERROR', error: 'missing bureau_url' })).toBe('error');
    expect(decideQualifyResult({ ok: false, state: 'BUREAU_ERROR', error: 'vendor down' })).toBe('error');
    expect(decideQualifyResult(null)).toBe('error');
    expect(decideQualifyResult({ pass: true })).toBe('error');
  });

  it('hides the score and the rejection code from the screen copy', () => {
    const rejected = {
      ok: true,
      pass: false,
      score: 569,
      kill_code: 'CIBIL_BELOW_680',
      failed: [{ rejection_code: 'CIBIL_BELOW_680' }],
    };
    expect(engineQualifyBlock(rejected)).toBe('rejected');
    expect(engineQualifyBlockMessage('rejected')).toBe(
      'This application does not meet current lending criteria.'
    );
    expect(engineQualifyBlockMessage('rejected')).not.toContain('569');
    expect(engineQualifyBlockMessage('rejected')).not.toContain('CIBIL_BELOW_680');
    expect(engineQualifyBlock({ ok: false, state: 'CONFIG_ERROR', error: 'missing bureau_url' })).toBe('config');
    expect(engineQualifyBlock({ ok: false, state: 'BUREAU_ERROR' })).toBe('bureau');
    expect(engineQualifyBlock(null)).toBe('retry');
    expect(engineQualifyBlock({ ok: true, pass: true, score: 742 })).toBeNull();
  });
});
