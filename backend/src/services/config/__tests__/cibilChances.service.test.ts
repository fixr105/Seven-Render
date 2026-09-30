import { describe, it, expect } from '@jest/globals';
import {
  calculateChancesFromRows,
  loanProductMatches,
  mapScoreToLabel,
  normalizeBreRecord,
  pickRecommendedLender,
  selectRecommendedLender,
  type NbfcBreRow,
} from '../cibilChances.logic.js';

function row(partial: Partial<NbfcBreRow> & Pick<NbfcBreRow, 'lenderName'>): NbfcBreRow {
  return {
    userId: 'NBFC-010',
    minCibil: 300,
    maxCibil: 900,
    eligible: true,
    roi: 35,
    pf: 8,
    active: true,
    loanProductKeys: ['LP016'],
    ...partial,
  };
}

describe('mapScoreToLabel', () => {
  it('maps score boundaries to labels', () => {
    expect(mapScoreToLabel(0)).toBe('Almost No Chance');
    expect(mapScoreToLabel(1)).toBe('Chances with Co-applicant');
    expect(mapScoreToLabel(33)).toBe('Chances with Co-applicant');
    expect(mapScoreToLabel(34)).toBe('Chances');
    expect(mapScoreToLabel(66)).toBe('Chances');
    expect(mapScoreToLabel(67)).toBe('High Chance');
    expect(mapScoreToLabel(100)).toBe('High Chance');
  });
});

describe('normalizeBreRecord', () => {
  it('unwraps Airtable fields shape including UserID and loan product keys', () => {
    const normalized = normalizeBreRecord({
      id: 'rec1',
      fields: {
        'NBFC Partner': 'Alpha NBFC',
        UserID: 'NBFC-010',
        'Min CIBIL': 600,
        'Max CIBIL': 750,
        Eligible: true,
        ROI: 28,
        PF: 6,
        Active: true,
        'Loan Product': [{ id: 'recLP', name: 'Optimotion', 'Product ID': 'LP016' }],
      },
    });
    expect(normalized).toEqual({
      userId: 'NBFC-010',
      lenderName: 'Alpha NBFC',
      minCibil: 600,
      maxCibil: 750,
      eligible: true,
      roi: 28,
      pf: 6,
      active: true,
      loanProductKeys: ['recLP', 'Optimotion', 'LP016'],
    });
  });

  it('returns null when lender or CIBIL band missing', () => {
    expect(normalizeBreRecord({ fields: { 'Min CIBIL': 300, 'Max CIBIL': 900 } })).toBeNull();
  });
});

describe('loanProductMatches', () => {
  it('matches product id case-insensitively and rejects other products', () => {
    const matched = row({ lenderName: 'A', loanProductKeys: ['lp016'] });
    expect(loanProductMatches(matched, 'LP016')).toBe(true);
    expect(loanProductMatches(matched, 'LP001')).toBe(false);
    expect(loanProductMatches(row({ lenderName: 'B', loanProductKeys: [] }), 'LP016')).toBe(false);
  });
});

describe('calculateChancesFromRows', () => {
  it('returns 0 / Almost No Chance when no rows match the product and band', () => {
    const result = calculateChancesFromRows(
      720,
      [row({ lenderName: 'Other Product', loanProductKeys: ['LP001'] })],
      'LP016'
    );
    expect(result).toEqual({ score: 0, label: 'Almost No Chance' });
  });

  it('scores the row ratio for the matching product and ignores other products', () => {
    const rows = [
      row({ lenderName: 'A', eligible: true, loanProductKeys: ['LP016'] }),
      row({ lenderName: 'B', userId: 'NBFC-011', eligible: false, loanProductKeys: ['LP016'] }),
      row({ lenderName: 'C', userId: 'NBFC-012', eligible: true, loanProductKeys: ['LP016'] }),
      row({ lenderName: 'Other', userId: 'NBFC-013', eligible: true, loanProductKeys: ['LP001'] }),
      row({ lenderName: 'Inactive', eligible: true, active: false, loanProductKeys: ['LP016'] }),
    ];
    const result = calculateChancesFromRows(650, rows, 'LP016');
    expect(result).toEqual({ score: 67, label: 'High Chance' });
    expect(JSON.stringify(result)).not.toContain('NBFC-');
    expect(JSON.stringify(result)).not.toContain('Other');
  });

  it('returns 100 when every matching row is eligible', () => {
    const rows = [
      row({ lenderName: 'A', minCibil: 700, maxCibil: 800, eligible: true }),
      row({ lenderName: 'B', userId: 'NBFC-011', minCibil: 700, maxCibil: 800, eligible: true }),
    ];
    expect(calculateChancesFromRows(720, rows, 'LP016')).toEqual({
      score: 100,
      label: 'High Chance',
    });
  });
});

describe('pickRecommendedLender', () => {
  it('prefers lowest ROI then name and omits UserID', () => {
    const result = pickRecommendedLender([
      { userId: 'NBFC-010', lenderName: 'Zeta', roi: 30 },
      { userId: 'NBFC-011', lenderName: 'Alpha', roi: 28 },
      { userId: 'NBFC-012', lenderName: 'Beta', roi: 28 },
    ]);
    expect(result).toEqual({ recommendedLender: 'Alpha', recommendedLenderROI: 28 });
    expect(JSON.stringify(result)).not.toContain('NBFC-');
  });

  it('skips a lender whose checkpoints are not approved even if the CIBIL band is eligible', () => {
    const rows = [
      row({ userId: 'NBFC-010', lenderName: 'Cheap Fail', roi: 10, loanProductKeys: ['LP016'] }),
      row({ userId: 'NBFC-011', lenderName: 'Pricier Pass', roi: 22, loanProductKeys: ['LP016'] }),
    ];
    const statuses = new Map<string, string>([
      ['NBFC-010', 'BRE REJECTED'],
      ['NBFC-011', 'BRE APPROVED'],
    ]);
    const result = selectRecommendedLender(rows, 720, 'LP016', statuses);
    expect(result).toEqual({ recommendedLender: 'Pricier Pass', recommendedLenderROI: 22 });
    expect(JSON.stringify(result)).not.toContain('NBFC-');
  });

  it('returns nulls when nobody is eligible', () => {
    expect(pickRecommendedLender([])).toEqual({
      recommendedLender: null,
      recommendedLenderROI: null,
    });
  });
});
