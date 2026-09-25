import { describe, it, expect } from '@jest/globals';
import {
  evaluateCheckpoints,
  normalizeCheckpointRecord,
  type ApplicantParameters,
  type LenderBreCheckpoint,
} from '../lenderBreCheckpoints.logic.js';

function checkpoint(partial: Partial<LenderBreCheckpoint> & Pick<LenderBreCheckpoint, 'parameter' | 'rejectionCode' | 'operator'>): LenderBreCheckpoint {
  return {
    userId: 'NBFC-010',
    threshold: null,
    active: true,
    ...partial,
  };
}

const applicant: ApplicantParameters = {
  cibil_score: 720,
  dpd_3m: 0,
  dpd_6m: 1,
  overdue_12m: 0,
  dpd_60plus_24m: 0,
  dpd_90plus_36m: 0,
  emi_overdue: 0,
  cc_overdue: 0,
  enquiries_30d: 2,
  written_off_3y: 0,
  loan_amount: 400000,
  ntc_bank_statement: false,
};

describe('normalizeCheckpointRecord', () => {
  it('reads Airtable fields and UserID', () => {
    expect(
      normalizeCheckpointRecord({
        fields: {
          UserID: 'NBFC-010',
          Parameter: 'dpd_3m',
          'Rejection Code': 'DPD_3M',
          Operator: 'greater_than',
          Threshold: 0,
          Active: true,
        },
      })
    ).toEqual({
      userId: 'NBFC-010',
      parameter: 'dpd_3m',
      rejectionCode: 'DPD_3M',
      operator: 'greater_than',
      threshold: 0,
      active: true,
    });
  });

  it('returns null when operator or parameter is missing', () => {
    expect(normalizeCheckpointRecord({ fields: { UserID: 'NBFC-010', Active: true } })).toBeNull();
  });
});

describe('evaluateCheckpoints', () => {
  it('returns Pending when the bureau report is missing', () => {
    expect(
      evaluateCheckpoints([checkpoint({ parameter: 'cibil_score', rejectionCode: 'CIBIL', operator: 'less_than', threshold: 650 })], applicant, {
        bureauReportMissing: true,
      })
    ).toEqual({ status: 'Pending', reason: 'BUREAU_REPORT_MISSING' });
  });

  it('approves when every active checkpoint passes', () => {
    const rules = [
      checkpoint({ parameter: 'cibil_score', rejectionCode: 'LOW_CIBIL', operator: 'less_than', threshold: 650 }),
      checkpoint({ parameter: 'ntc_bank_statement', rejectionCode: 'NTC', operator: 'boolean_true' }),
    ];
    expect(evaluateCheckpoints(rules, applicant)).toEqual({
      status: 'BRE APPROVED',
      reason: 'ELIGIBLE',
    });
  });

  it('rejects on the first failed rule and lists every failed rejection code', () => {
    const rules = [
      checkpoint({ parameter: 'dpd_3m', rejectionCode: 'DPD_3M', operator: 'greater_than', threshold: 0 }),
      checkpoint({ parameter: 'enquiries_30d', rejectionCode: 'ENQ', operator: 'greater_than', threshold: 1 }),
      checkpoint({ parameter: 'loan_amount', rejectionCode: 'AMOUNT', operator: 'less_than', threshold: 100000 }),
    ];
    const result = evaluateCheckpoints(rules, { ...applicant, dpd_3m: 2, enquiries_30d: 5 });
    expect(result).toEqual({
      status: 'BRE REJECTED',
      reason: 'DPD_3M',
      failedRules: ['DPD_3M', 'ENQ'],
    });
  });

  it('fails boolean_false when the applicant value is false', () => {
    const result = evaluateCheckpoints(
      [checkpoint({ parameter: 'ntc_bank_statement', rejectionCode: 'NEED_STATEMENT', operator: 'boolean_false' })],
      applicant
    );
    expect(result.status).toBe('BRE REJECTED');
    expect(result).toMatchObject({ reason: 'NEED_STATEMENT', failedRules: ['NEED_STATEMENT'] });
  });

  it('does not include lender name or UserID in the decision', () => {
    const result = evaluateCheckpoints(
      [checkpoint({ userId: 'NBFC-010', parameter: 'cibil_score', rejectionCode: 'LOW_CIBIL', operator: 'less_than', threshold: 800 })],
      applicant
    );
    expect(JSON.stringify(result)).not.toContain('NBFC-010');
  });

  it('ignores inactive checkpoints', () => {
    expect(
      evaluateCheckpoints(
        [checkpoint({ parameter: 'cibil_score', rejectionCode: 'LOW_CIBIL', operator: 'less_than', threshold: 900, active: false })],
        applicant
      )
    ).toEqual({ status: 'BRE APPROVED', reason: 'ELIGIBLE' });
  });
});
