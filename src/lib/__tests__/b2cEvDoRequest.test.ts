import { describe, it, expect } from 'vitest';
import { buildDoRequestMessage, isDoRequested } from '../b2cEvDoRequest';

describe('b2cEvDoRequest', () => {
  it('detects when DO has been requested', () => {
    expect(isDoRequested({})).toBe(false);
    expect(isDoRequested({ '_meta.doRequest.requestedAt': '2026-01-01T00:00:00.000Z' })).toBe(
      true
    );
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
