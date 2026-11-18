import { describe, it, expect } from 'vitest';
import {
  arePostDoStagesUnlocked,
  buildDoRequestMessage,
  deliveryBanner,
  deliveryLockReason,
  isDeliveryCardOpen,
  isDoFulfilled,
  isDoRequested,
  isLoanPackSigned,
} from '../b2cEvDoRequest';

describe('b2cEvDoRequest', () => {
  it('detects when DO has been requested', () => {
    expect(isDoRequested({})).toBe(false);
    expect(isDoRequested({ '_meta.doRequest.requestedAt': '2026-01-01T00:00:00.000Z' })).toBe(
      true
    );
  });

  it('detects when DO has been fulfilled by KAM', () => {
    expect(isDoFulfilled({})).toBe(false);
    expect(isDoFulfilled({ '_meta.doRequest.fulfilledAt': '2026-01-02T00:00:00.000Z' })).toBe(
      true
    );
    expect(isDoFulfilled({ '_meta.doRequest.status': 'approved' })).toBe(true);
    expect(arePostDoStagesUnlocked({ '_meta.doRequest.fulfilledAt': '2026-01-02T00:00:00.000Z' })).toBe(
      true
    );
  });

  it('opens insurance and vehicle after DO approval, photos after signing, and IoT after vehicle is done', () => {
    const approved = { '_meta.doRequest.fulfilledAt': '2026-01-02T00:00:00.000Z' };
    const signed = { ...approved, '_meta.esign.stage': 'signed' };
    const signingSentOnly = { '_meta.signing.sentAt': '2026-01-03T00:00:00.000Z' };

    expect(isLoanPackSigned(signed)).toBe(true);
    expect(isLoanPackSigned({ 'compliance.loanAgreementSigned': true })).toBe(true);
    expect(isLoanPackSigned({ 'compliance.loanAgreementSigned': 'true' })).toBe(true);
    expect(isLoanPackSigned(signingSentOnly)).toBe(false);

    for (const card of ['insurance', 'vehicle', 'geo', 'iot'] as const) {
      expect(isDeliveryCardOpen({}, card, true)).toBe(false);
      expect(deliveryLockReason({}, card, true)).toBe(
        'Opens after the disbursement order is approved.'
      );
    }

    expect(isDeliveryCardOpen(approved, 'insurance', false)).toBe(true);
    expect(isDeliveryCardOpen(approved, 'vehicle', false)).toBe(true);
    expect(isDeliveryCardOpen(approved, 'geo', false)).toBe(false);
    expect(isDeliveryCardOpen(approved, 'iot', true)).toBe(false);
    expect(deliveryLockReason(approved, 'geo', false)).toBe(
      'Opens after both people have signed the loan documents.'
    );
    expect(isDeliveryCardOpen(signingSentOnly, 'geo', true)).toBe(false);
    expect(isDeliveryCardOpen(signingSentOnly, 'iot', true)).toBe(false);

    expect(isDeliveryCardOpen(signed, 'geo', false)).toBe(true);
    expect(isDeliveryCardOpen(signed, 'iot', false)).toBe(false);
    expect(deliveryLockReason(signed, 'iot', false)).toBe(
      'Opens after vehicle details are saved.'
    );
    expect(isDeliveryCardOpen(signed, 'iot', true)).toBe(true);
    expect(deliveryLockReason(signed, 'iot', true)).toBeNull();
  });

  it('builds the delivery banner from DO and signing only', () => {
    expect(deliveryBanner({})).toBe('Waiting for disbursement order approval.');
    expect(
      deliveryBanner({ '_meta.doRequest.status': 'approved' })
    ).toBe(
      'Disbursement order approved. Fill insurance and vehicle details. Photos and IoT open after signing.'
    );
    expect(
      deliveryBanner({
        '_meta.doRequest.fulfilledAt': '2026-01-02T00:00:00.000Z',
        '_meta.esign.stage': 'signed',
      })
    ).toBe('Ready for delivery.');
  });

  it('builds DO request message for KAM', () => {
    const message = buildDoRequestMessage({
      applicantName: 'Rahul Sharma',
      applicationId: 'APP123',
    });
    expect(message).toContain('Disbursement Order');
    expect(message).toContain('Rahul Sharma');
    expect(message).toContain('APP123');
  });
});
