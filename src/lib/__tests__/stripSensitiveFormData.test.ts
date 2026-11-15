import { describe, expect, it } from 'vitest';
import { stripSensitiveFormData } from '../crm/stripSensitiveFormData';

describe('stripSensitiveFormData', () => {
  it('strips array nested objects too', () => {
    const cleaned = stripSensitiveFormData({
      items: [{ score: 1, name: 'ok' }, 'plain'],
      borrower_cibil_score_band: 'A',
    });
    expect(cleaned.items).toEqual([{ name: 'ok' }, 'plain']);
    expect(cleaned.borrower_cibil_score_band).toBeUndefined();
  });
});
