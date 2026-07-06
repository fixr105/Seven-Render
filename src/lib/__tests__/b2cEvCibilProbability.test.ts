import { describe, it, expect } from 'vitest';
import {
  getBorrowerCibilScoreFromFormData,
  getCibilMarkerPercent,
  getCibilProbabilityLabel,
  getCibilProbabilityTier,
  parseCibilScore,
} from '../b2cEvCibilProbability';

describe('parseCibilScore', () => {
  it('parses valid integers', () => {
    expect(parseCibilScore('731')).toBe(731);
    expect(parseCibilScore(620)).toBe(620);
  });

  it('returns null for invalid values', () => {
    expect(parseCibilScore('')).toBeNull();
    expect(parseCibilScore(null)).toBeNull();
    expect(parseCibilScore('abc')).toBeNull();
    expect(parseCibilScore('-1')).toBeNull();
  });
});

describe('getCibilProbabilityTier', () => {
  it('maps boundary scores to correct tiers', () => {
    expect(getCibilProbabilityTier(575)).toBe('almost_none');
    expect(getCibilProbabilityTier(576)).toBe('co_applicant');
    expect(getCibilProbabilityTier(630)).toBe('co_applicant');
    expect(getCibilProbabilityTier(631)).toBe('chances');
    expect(getCibilProbabilityTier(674)).toBe('chances');
    expect(getCibilProbabilityTier(675)).toBe('full');
    expect(getCibilProbabilityTier(800)).toBe('full');
  });
});

describe('getCibilProbabilityLabel', () => {
  it('returns user-facing labels without score', () => {
    expect(getCibilProbabilityLabel('almost_none')).toBe('Almost No chance');
    expect(getCibilProbabilityLabel('co_applicant')).toBe('Chances with co applicant');
    expect(getCibilProbabilityLabel('chances')).toBe('Chances');
    expect(getCibilProbabilityLabel('full')).toBe('90% chance');
  });
});

describe('getBorrowerCibilScoreFromFormData', () => {
  it('reads score from PAN lookup meta', () => {
    expect(
      getBorrowerCibilScoreFromFormData({ '_meta.panLookup.cibilScore': '620' })
    ).toBe(620);
  });

  it('falls back to legacy borrower.cibilScore field', () => {
    expect(getBorrowerCibilScoreFromFormData({ 'borrower.cibilScore': '720' })).toBe(720);
  });

  it('prefers PAN lookup meta over legacy field', () => {
    expect(
      getBorrowerCibilScoreFromFormData({
        '_meta.panLookup.cibilScore': '620',
        'borrower.cibilScore': '720',
      })
    ).toBe(620);
  });

  it('returns null when no score is stored', () => {
    expect(getBorrowerCibilScoreFromFormData({})).toBeNull();
  });
});

describe('getCibilMarkerPercent', () => {
  it('maps 300–900 to 0–90', () => {
    expect(getCibilMarkerPercent(300)).toBe(0);
    expect(getCibilMarkerPercent(900)).toBe(90);
    expect(getCibilMarkerPercent(600)).toBe(50);
  });

  it('clamps out-of-range scores', () => {
    expect(getCibilMarkerPercent(100)).toBe(0);
    expect(getCibilMarkerPercent(950)).toBe(90);
  });
});
