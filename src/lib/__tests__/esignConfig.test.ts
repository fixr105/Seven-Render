import { describe, expect, it, vi } from 'vitest';
import { loadEsignConfig, maskEmailForDisplay, isValidEmail } from '../esignConfig';

describe('esignConfig', () => {
  it('STOPs when a key is missing', async () => {
    const get = vi.fn().mockResolvedValue({
      records: [{ key: 'sign_project', value: 'seven_dealer_ev' }],
    });
    const result = await loadEsignConfig(get);
    expect(result.ok).toBe(false);
  });

  it('parses boolean text keys', async () => {
    const get = vi.fn().mockResolvedValue({
      records: [
        { key: 'sign_project', value: 'seven_dealer_ev' },
        { key: 'sign_title', value: 'Loan Agreement' },
        { key: 'sign_reason', value: 'Loan Agreement Execution' },
        { key: 'sign_method', value: 'aadhaar_otp' },
        { key: 'sign_position_default', value: 'bottom-right' },
        { key: 'sign_all_pages', value: 'TRUE' },
        { key: 'sign_order', value: 'sequential' },
        { key: 'sign_geo_required', value: 'true' },
        { key: 'sign_video_required', value: 'false' },
        { key: 'sign_position_applicant', value: 'bottom-right' },
        { key: 'sign_position_co_applicant', value: 'bottom-left' },
      ],
    });
    const result = await loadEsignConfig(get);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.sign_all_pages).toBe(true);
      expect(result.config.sign_video_required).toBe(false);
    }
  });

  it('masks emails for display', () => {
    expect(maskEmailForDisplay('govind@example.com')).toBe('g***@example.com');
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail('nope')).toBe(false);
  });
});
