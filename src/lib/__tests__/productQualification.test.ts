import { describe, expect, it } from 'vitest';
import {
  PAN_MOBILE_MISMATCH_MESSAGE,
  bureauRequestFromFormData,
  isNewToCreditScore,
  isPanMobileMismatchScore,
  qualificationMessage,
  readProductQualification,
  writeProductQualification,
} from '../productQualification';

describe('product qualification draft', () => {
  it('stores the assigned id and keeps it out of the result text', () => {
    const formData = writeProductQualification({}, 'LP016|pan', {
      outcome: 'approved',
      chanceLabel: 'High Chance',
      roi: 14.5,
      pf: 2.5,
      lenderName: 'Fintree',
      assignedUserId: 'NBFC-OK',
    });

    expect(formData['_meta.qualification.assignedUserId']).toBe('NBFC-OK');
    const view = readProductQualification(formData, 'LP016|pan');
    expect(view).toEqual({
      outcome: 'approved',
      chanceLabel: 'High Chance',
      roi: 14.5,
      pf: 2.5,
      lenderName: 'Fintree',
    });
    const message = qualificationMessage(view!);
    expect(message).toBe('Congratulations, we matched you with a lender');
    expect(message).not.toContain('NBFC-OK');
  });

  it('sends bureau flags and not the stored lender id', () => {
    expect(
      bureauRequestFromFormData({
        '_meta.panLookup.cibilScore': '748',
        '_meta.panLookup.bureau.dpd_3m': '0',
        '_meta.qualification.assignedUserId': 'NBFC-OK',
      })
    ).toEqual({
      cibilScore: '748',
      parameters: { dpd_3m: 0 },
    });
  });

  it('describes a pending and an ineligible result without a lender id', () => {
    expect(
      qualificationMessage({
        outcome: 'pending',
        chanceLabel: 'Almost No Chance',
        roi: null,
        pf: null,
        lenderName: null,
      })
    ).toBe('Qualification is waiting on bureau data.');
    expect(
      qualificationMessage({
        outcome: 'ineligible',
        chanceLabel: 'Chances',
        roi: null,
        pf: null,
        lenderName: null,
      })
    ).toBe('Not eligible for this product. Chances');
  });

  it('hardcodes a PAN and mobile mismatch for scores from 300 through 679', () => {
    expect(isPanMobileMismatchScore(300)).toBe(true);
    expect(isPanMobileMismatchScore(670)).toBe(true);
    expect(isPanMobileMismatchScore(679)).toBe(true);
    expect(isPanMobileMismatchScore(680)).toBe(false);
    expect(isPanMobileMismatchScore(-1)).toBe(false);
    expect(isNewToCreditScore(-1)).toBe(true);
    expect(isNewToCreditScore(670)).toBe(false);
    expect(
      qualificationMessage({
        outcome: 'pan_mobile_mismatch',
        chanceLabel: '',
        roi: null,
        pf: null,
        lenderName: null,
      })
    ).toBe(PAN_MOBILE_MISMATCH_MESSAGE);
  });
});
