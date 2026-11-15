import { describe, expect, it } from 'vitest';
import { buildCreditFailRejectFields } from '../rejectOnCreditFail';

describe('buildCreditFailRejectFields', () => {
  it('sets Status Rejected and stores the exact reason', () => {
    const formData = { 'borrower.pan': 'KMPPS3552C' };
    const fields = buildCreditFailRejectFields(
      formData,
      "Sorry, this application does not meet the lender's current criteria."
    );

    expect(fields.Status).toBe('Rejected');
    expect(fields['Lender Decision Status']).toBe('Rejected');
    expect(String(fields['Lender Decision Remarks'])).toContain(
      "does not meet the lender's current criteria"
    );
    expect(fields['Last Updated']).toEqual(expect.any(String));

    const parsed = JSON.parse(String(fields['Form Data'])) as Record<string, unknown>;
    expect(parsed['_meta.creditCheck.status']).toBe('failed');
    expect(parsed['_meta.creditCheck.reason']).toContain('does not meet');
    expect(parsed['borrower.pan']).toBe('KMPPS3552C');
  });
});
