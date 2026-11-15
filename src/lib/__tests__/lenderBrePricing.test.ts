import { describe, expect, it, vi } from 'vitest';
import {
  getPricing,
  loanProductApplies,
  pickLenderBreBand,
  PRICING_NOT_ELIGIBLE_MESSAGE,
  PRICING_UNAVAILABLE_MESSAGE,
  type LenderBreRow,
} from '../lenderBrePricing';
import type { AirtableFlatRecord } from '../../services/engineClient';

const FINTREE_BANDS: LenderBreRow[] = [
  {
    ruleId: 2,
    nbfcPartner: 'Fintree',
    minCibil: 650,
    maxCibil: 700,
    eligible: true,
    roi: 32,
    pf: 8,
    active: true,
    loanProduct: '',
  },
  {
    ruleId: 5,
    nbfcPartner: 'Fintree',
    minCibil: 701,
    maxCibil: 750,
    eligible: true,
    roi: 30,
    pf: 7,
    active: true,
    loanProduct: '',
  },
  {
    ruleId: 6,
    nbfcPartner: 'Fintree',
    minCibil: 751,
    maxCibil: 775,
    eligible: true,
    roi: 28,
    pf: 7.5,
    active: true,
    loanProduct: '',
  },
  {
    ruleId: 7,
    nbfcPartner: 'Fintree',
    minCibil: 776,
    maxCibil: 900,
    eligible: true,
    roi: 28,
    pf: 6.75,
    active: true,
    loanProduct: '',
  },
  {
    ruleId: 0,
    nbfcPartner: 'Fintree',
    minCibil: -1,
    maxCibil: -1,
    eligible: true,
    roi: 32,
    pf: 8,
    active: true,
    loanProduct: '',
  },
];

function breRecord(row: Partial<AirtableFlatRecord>): AirtableFlatRecord {
  return { id: 'recX', ...row };
}

describe('pickLenderBreBand', () => {
  it('score 807 picks 776–900; boundaries 700→first, 701→second', () => {
    expect(pickLenderBreBand(FINTREE_BANDS, 807, 'Fintree', 'LP012')?.ruleId).toBe(7);
    expect(pickLenderBreBand(FINTREE_BANDS, 700, 'Fintree', 'LP012')?.ruleId).toBe(2);
    expect(pickLenderBreBand(FINTREE_BANDS, 701, 'Fintree', 'LP012')?.ruleId).toBe(5);
  });

  it('is_ntc score -1 picks -1/-1 band', () => {
    expect(pickLenderBreBand(FINTREE_BANDS, -1, 'Fintree', 'LP012')?.ruleId).toBe(0);
  });

  it('ignores inactive and other lenders; Active absent = inactive', () => {
    const rows: LenderBreRow[] = [
      {
        ...FINTREE_BANDS[3],
        ruleId: 99,
        active: false,
      },
      {
        ...FINTREE_BANDS[3],
        ruleId: 88,
        nbfcPartner: 'ENN ENN Capital',
        active: true,
      },
      FINTREE_BANDS[3],
    ];
    expect(pickLenderBreBand(rows, 807, 'Fintree', 'LP012')?.ruleId).toBe(7);
  });

  it('product-specific band beats all-products band', () => {
    const rows: LenderBreRow[] = [
      { ...FINTREE_BANDS[3], ruleId: 10, loanProduct: '', roi: 40, pf: 9 },
      { ...FINTREE_BANDS[3], ruleId: 11, loanProduct: 'LP012', roi: 28, pf: 6.75 },
    ];
    const picked = pickLenderBreBand(rows, 807, 'Fintree', 'LP012');
    expect(picked?.ruleId).toBe(11);
    expect(picked?.roi).toBe(28);
  });
});

describe('loanProductApplies', () => {
  it('matches empty, exact, or comma-separated token', () => {
    expect(loanProductApplies('', 'LP012')).toBe(true);
    expect(loanProductApplies('LP012', 'LP012')).toBe(true);
    expect(loanProductApplies('LP012, LP016', 'LP012')).toBe(true);
    expect(loanProductApplies('LP012, LP016', 'LP099')).toBe(false);
  });
});

describe('getPricing', () => {
  it('returns eligible band fields only; no score leak', async () => {
    const airtableGet = vi.fn(async (input: { table: string }) => {
      if (input.table === 'Bureau Cache') {
        return {
          ok: true,
          count: 1,
          records: [
            {
              id: 'recCache',
              pan: 'HSJPP5704A',
              result_json: JSON.stringify({
                score: 807,
                is_ntc: false,
                fields: { score: 807, cibil_score: 807 },
                bureau_ref: 'AL-TEST',
              }),
            },
          ],
        };
      }
      return {
        ok: true,
        count: FINTREE_BANDS.length,
        records: FINTREE_BANDS.map((b) =>
          breRecord({
            'Rule ID': b.ruleId,
            'NBFC Partner': b.nbfcPartner,
            'Min CIBIL': b.minCibil,
            'Max CIBIL': b.maxCibil,
            Eligible: b.eligible,
            ROI: b.roi,
            PF: b.pf,
            Active: b.active,
            'Loan Product': b.loanProduct,
          })
        ),
      };
    });

    const result = await getPricing('hsjpp5704a', 'Fintree', 'LP012', { airtableGet });
    expect(result).toEqual({
      rule_id: 7,
      nbfc_partner: 'Fintree',
      roi_pct: 28,
      pf_pct: 6.75,
      eligible: true,
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toMatch(/score/i);
    expect(serialized).not.toContain('807');
  });

  it('is_ntc true picks NTC band', async () => {
    const airtableGet = vi.fn(async (input: { table: string }) => {
      if (input.table === 'Bureau Cache') {
        return {
          ok: true,
          count: 1,
          records: [
            {
              id: 'recCache',
              result_json: JSON.stringify({ is_ntc: true, fields: { is_ntc: true } }),
            },
          ],
        };
      }
      return {
        ok: true,
        count: 1,
        records: [
          breRecord({
            'Rule ID': 0,
            'NBFC Partner': 'Fintree',
            'Min CIBIL': -1,
            'Max CIBIL': -1,
            Eligible: true,
            ROI: 32,
            PF: 8,
            Active: true,
            'Loan Product': 'LP012, LP016',
          }),
        ],
      };
    });
    const result = await getPricing('HSJPP5704A', 'Fintree', 'LP012', { airtableGet });
    expect(result).toMatchObject({ rule_id: 0, eligible: true, roi_pct: 32, pf_pct: 8 });
  });

  it('Eligible absent → not eligible result', async () => {
    const airtableGet = vi.fn(async (input: { table: string }) => {
      if (input.table === 'Bureau Cache') {
        return {
          ok: true,
          count: 1,
          records: [{ id: 'c', result_json: JSON.stringify({ score: 500 }) }],
        };
      }
      return {
        ok: true,
        count: 1,
        records: [
          breRecord({
            'Rule ID': 1,
            'NBFC Partner': 'Fintree',
            'Min CIBIL': 300,
            'Max CIBIL': 649,
            // Eligible absent
            ROI: null,
            PF: null,
            Active: true,
            'Loan Product': '',
          }),
        ],
      };
    });
    const result = await getPricing('HSJPP5704A', 'Fintree', 'LP012', { airtableGet });
    expect(result).toMatchObject({ eligible: false, rule_id: 1 });
    expect(PRICING_NOT_ELIGIBLE_MESSAGE).toMatch(/not eligible/i);
  });

  it('no matching band → unavailable; no fallback rate', async () => {
    const airtableGet = vi.fn(async (input: { table: string }) => {
      if (input.table === 'Bureau Cache') {
        return {
          ok: true,
          count: 1,
          records: [{ id: 'c', result_json: JSON.stringify({ score: 950 }) }],
        };
      }
      return {
        ok: true,
        count: 1,
        records: [
          breRecord({
            'Rule ID': 7,
            'NBFC Partner': 'Fintree',
            'Min CIBIL': 776,
            'Max CIBIL': 900,
            Eligible: true,
            ROI: 28,
            PF: 6.75,
            Active: true,
            'Loan Product': '',
          }),
        ],
      };
    });
    const result = await getPricing('HSJPP5704A', 'Fintree', 'LP012', { airtableGet });
    expect(result).toEqual({
      unavailable: true,
      message: PRICING_UNAVAILABLE_MESSAGE,
    });
  });

  it('no cache row → unavailable with retry message', async () => {
    const airtableGet = vi.fn(async (input: { table: string }) => {
      if (input.table === 'Bureau Cache') {
        return { ok: true, count: 0, records: [] };
      }
      return { ok: true, count: 0, records: [] };
    });
    const result = await getPricing('HSJPP5704A', 'Fintree', 'LP012', { airtableGet });
    expect(result).toEqual({
      unavailable: true,
      message: PRICING_UNAVAILABLE_MESSAGE,
    });
  });
});
