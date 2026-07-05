import { describe, expect, it } from 'vitest';
import { extractPendingB2cActions } from '../b2cEvKamActions';

describe('b2cEvKamActions', () => {
  it('returns pending compliance and DO actions', () => {
    const result = extractPendingB2cActions(
      {
        '_meta.kamRequests.enach.requestedAt': '2026-01-01T00:00:00.000Z',
        'compliance.enachDone': 'false',
        '_meta.doRequest.requestedAt': '2026-01-02T00:00:00.000Z',
      },
      { applicationId: 'app-1', fileId: 'FILE-1' }
    );
    expect(result.complianceRequests).toHaveLength(1);
    expect(result.doRequest?.requestedAt).toBeTruthy();
    expect(result.pendingActions.length).toBeGreaterThanOrEqual(2);
  });
});
