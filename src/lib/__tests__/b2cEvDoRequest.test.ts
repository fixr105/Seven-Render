import { describe, it, expect } from 'vitest';
import {
  arePostDoStagesUnlocked,
  buildDoRequestMessage,
  isDeliveryCardOpen,
  isDoFulfilled,
  isDoRequested,
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

  it('opens insurance and vehicle after DO approval, and the rest after signing', () => {
    const approved = { '_meta.doRequest.fulfilledAt': '2026-01-02T00:00:00.000Z' };
    expect(isDeliveryCardOpen(approved, 'insurance', false)).toBe(true);
    expect(isDeliveryCardOpen(approved, 'vehicle', false)).toBe(true);
    expect(isDeliveryCardOpen(approved, 'geo', false)).toBe(false);
    expect(isDeliveryCardOpen(approved, 'iot', false)).toBe(false);
    expect(isDeliveryCardOpen({}, 'insurance', true)).toBe(true);
    expect(isDeliveryCardOpen({}, 'geo', true)).toBe(true);
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
