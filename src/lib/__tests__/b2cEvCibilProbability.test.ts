import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getBorrowerCibilScoreFromFormData,
  getChanceMarkerPercent,
  parseCibilScore,
  fetchCibilChances,
} from '../b2cEvCibilProbability';

vi.mock('../../services/api', () => ({
  apiService: {
    getCibilChances: vi.fn(),
  },
}));

import { apiService } from '../../services/api';

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

describe('getBorrowerCibilScoreFromFormData', () => {
  it('reads score from PAN lookup meta', () => {
    expect(
      getBorrowerCibilScoreFromFormData({ '_meta.panLookup.cibilScore': '620' })
    ).toBe(620);
  });
});

describe('getChanceMarkerPercent', () => {
  it('clamps 0–100', () => {
    expect(getChanceMarkerPercent(0)).toBe(0);
    expect(getChanceMarkerPercent(50)).toBe(50);
    expect(getChanceMarkerPercent(100)).toBe(100);
    expect(getChanceMarkerPercent(150)).toBe(100);
    expect(getChanceMarkerPercent(-10)).toBe(0);
  });
});

describe('fetchCibilChances', () => {
  beforeEach(() => {
    vi.mocked(apiService.getCibilChances).mockReset();
  });

  it('returns score and label from API', async () => {
    vi.mocked(apiService.getCibilChances).mockResolvedValue({
      success: true,
      data: { score: 67, label: 'High Chance' },
    });
    await expect(fetchCibilChances(720)).resolves.toEqual({
      score: 67,
      label: 'High Chance',
    });
  });
});
