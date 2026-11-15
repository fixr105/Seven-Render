import { describe, expect, it, vi } from 'vitest';
import { buildStampRefIds, loadStampConfig } from '../stampConfig';

describe('stampConfig', () => {
  it('STOPs when a key is missing', async () => {
    const get = vi.fn().mockResolvedValue({
      records: [
        { key: 'stamp_state', value: 'Delhi' },
        { key: 'stamp_article_code', value: '5' },
      ],
    });
    const result = await loadStampConfig(get);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missingKey).toBeTruthy();
      expect(result.message).toMatch(/incomplete/i);
    }
  });

  it('loads all stamp_* keys', async () => {
    const get = vi.fn().mockResolvedValue({
      records: [
        { key: 'stamp_state', value: 'Delhi' },
        { key: 'stamp_article_code', value: '5' },
        { key: 'stamp_purpose', value: 'Loan Agreement' },
        { key: 'stamp_denomination', value: '100' },
        { key: 'stamp_first_party', value: 'Fintree Finance Pvt Ltd' },
        { key: 'stamp_project', value: 'seven_dealer_ev' },
      ],
    });
    const result = await loadStampConfig(get);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.stamp_denomination).toBe(100);
      expect(result.config.stamp_state).toBe('Delhi');
    }
  });

  it('builds S1–S3 refIds from alnum file id', () => {
    expect(buildStampRefIds('SF-MW HK')).toEqual(['SFMWHK-S1', 'SFMWHK-S2', 'SFMWHK-S3']);
  });
});
