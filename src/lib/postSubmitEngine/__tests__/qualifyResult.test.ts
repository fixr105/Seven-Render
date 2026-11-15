import { describe, expect, it } from 'vitest';
import {
  interpretQualifyResult,
  normalizeQualifyPayload,
} from '../qualifyResult';

describe('normalizeQualifyPayload', () => {
  it('unwraps n8n array responses', () => {
    const normalized = normalizeQualifyPayload([
      { ok: true, pass: false, borrower_message: 'Not eligible' },
    ]);
    expect(normalized).toEqual({
      ok: true,
      pass: false,
      borrower_message: 'Not eligible',
    });
  });

  it('unwraps nested data objects', () => {
    expect(
      normalizeQualifyPayload({
        data: { ok: true, pass: true, score: 720 },
      })
    ).toMatchObject({ ok: true, pass: true, score: 720 });
  });
});

describe('interpretQualifyResult', () => {
  it('passes only when ok and pass are true with a credit check signal', () => {
    const result = interpretQualifyResult({
      ok: true,
      pass: true,
      score: 720,
      bureau_ref: 'AL123',
    });
    expect(result).toEqual({
      outcome: 'pass',
      reason: null,
      raw: expect.objectContaining({ ok: true, pass: true }),
    });
  });

  it('fails with borrower_message when Experian pass is false', () => {
    const result = interpretQualifyResult({
      ok: true,
      pass: false,
      kill_code: 'KILLED',
      failed: [{ parameter: 'score' }],
      borrower_message:
        "Sorry, this application does not meet the lender's current criteria.",
      bureau_ref: 'AL6af841759a8661b36059f197',
    });
    expect(result.outcome).toBe('fail');
    expect(result.reason).toBe(
      "Sorry, this application does not meet the lender's current criteria."
    );
  });

  it('fails when there is no Experian / credit check result', () => {
    const result = interpretQualifyResult({ ok: true, pass: true });
    expect(result.outcome).toBe('fail');
    expect(result.reason).toMatch(/no experian|no credit check/i);
  });

  it('fails when ok is false', () => {
    const result = interpretQualifyResult({
      ok: false,
      borrower_message: 'Bureau unavailable',
    });
    expect(result.outcome).toBe('fail');
    expect(result.reason).toBe('Bureau unavailable');
  });

  it('fails when payload is empty / unusable', () => {
    const result = interpretQualifyResult(null);
    expect(result.outcome).toBe('fail');
    expect(result.reason).toMatch(/no experian|no credit check/i);
  });

  it('builds reason from failed parameters when borrower_message missing', () => {
    const result = interpretQualifyResult({
      ok: true,
      pass: false,
      failed: [{ parameter: 'score' }, { parameter: 'income' }],
      bureau_ref: 'AL1',
    });
    expect(result.outcome).toBe('fail');
    expect(result.reason).toMatch(/score/i);
    expect(result.reason).toMatch(/income/i);
  });
});
