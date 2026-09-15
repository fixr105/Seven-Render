import { describe, it, expect } from '@jest/globals';
import {
  calculateChancesFromRows,
  mapScoreToLabel,
  normalizeBreRecord,
  pickRecommendedLender,
  type NbfcBreRow,
} from '../cibilChances.logic.js';

function row(partial: Partial<NbfcBreRow> & Pick<NbfcBreRow, 'lenderName'>): NbfcBreRow {
  return {
    minCibil: 300,
    maxCibil: 900,
    eligible: true,
    roi: 35,
    pf: 8,
    active: true,
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
  it('unwraps Airtable fields shape', () => {
    const normalized = normalizeBreRecord({
      id: 'rec1',
      fields: {
        'NBFC Partner': 'Alpha NBFC',
        'Min CIBIL': 600,
        'Max CIBIL': 750,
        Eligible: true,
        ROI: 28,
        PF: 6,
        Active: true,
      },
    });
    expect(normalized).toEqual({
      lenderName: 'Alpha NBFC',
      minCibil: 600,
      maxCibil: 750,
      eligible: true,
      roi: 28,
      pf: 6,
      active: true,
      loanProduct: undefined,
    });
  });

  it('returns null when lender or CIBIL band missing', () => {
    expect(normalizeBreRecord({ fields: { 'Min CIBIL': 300, 'Max CIBIL': 900 } })).toBeNull();
  });
});

describe('calculateChancesFromRows', () => {
  it('returns 0 / Almost No Chance when no matching lenders', () => {
    const result = calculateChancesFromRows(720, []);
    expect(result).toEqual({
      score: 0,
      label: 'Almost No Chance',
      recommendedLender: null,
    });
  });

  it('returns 100 when all matching lenders are eligible', () => {
    const rows = [
      row({ lenderName: 'A', minCibil: 700, maxCibil: 800, eligible: true, roi: 30 }),
      row({ lenderName: 'B', minCibil: 700, maxCibil: 800, eligible: true, roi: 32 }),
    ];
    const result = calculateChancesFromRows(720, rows);
    expect(result.score).toBe(100);
    expect(result.label).toBe('High Chance');
    expect(result.recommendedLender).toBe('A');
  });

  it('computes mixed eligibility score', () => {
    const rows = [
      row({ lenderName: 'A', minCibil: 600, maxCibil: 800, eligible: true }),
      row({ lenderName: 'B', minCibil: 600, maxCibil: 800, eligible: false }),
      row({ lenderName: 'C', minCibil: 600, maxCibil: 800, eligible: true }),
      row({ lenderName: 'Inactive', minCibil: 600, maxCibil: 800, eligible: true, active: false }),
    ];
    const result = calculateChancesFromRows(650, rows);
    expect(result.score).toBe(67);
    expect(result.label).toBe('High Chance');
    expect(Object.keys(result)).toEqual(['score', 'label', 'recommendedLender']);
  });

  it('client-safe shape has no lender list beyond recommendedLender field for staff helper', () => {
    const { score, label } = calculateChancesFromRows(650, [
      row({ lenderName: 'Secret Lender', eligible: true }),
    ]);
    const clientSafe = { score, label };
    expect(JSON.stringify(clientSafe)).not.toContain('Secret Lender');
  });
});

describe('pickRecommendedLender', () => {
  it('prefers lowest ROI then lowest PF then name', () => {
    expect(
      pickRecommendedLender([
        row({ lenderName: 'Zeta', roi: 30, pf: 8 }),
        row({ lenderName: 'Alpha', roi: 28, pf: 9 }),
        row({ lenderName: 'Beta', roi: 28, pf: 6 }),
      ])
    ).toBe('Beta');
  });
});
