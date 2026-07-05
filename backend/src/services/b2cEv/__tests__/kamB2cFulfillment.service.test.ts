import { describe, expect, it } from '@jest/globals';
import {
  buildCompliancePatch,
  buildDoFulfillPatch,
  formatComplianceAuditMessage,
  hasOpenDoRequest,
} from '../kamB2cFulfillment.logic.js';

describe('kamB2cFulfillment.service', () => {
  it('fulfill compliance marks checkbox and clears request timestamp', () => {
    const existing = {
      'compliance.vkycDone': 'false',
      '_meta.kamRequests.vkyc.requestedAt': '2026-01-01T00:00:00.000Z',
    };
    const merged = buildCompliancePatch(existing, 'vkyc', 'fulfill');
    expect(merged['compliance.vkycDone']).toBe('true');
    expect(merged['_meta.kamRequests.vkyc.requestedAt']).toBe('');
  });

  it('buildDoFulfillPatch sets fulfilledAt', () => {
    const merged = buildDoFulfillPatch({ '_meta.doRequest.requestedAt': '2026-01-01' }, 'Done');
    expect(merged['_meta.doRequest.requestedAt']).toBe('2026-01-01');
    expect(merged['_meta.doRequest.fulfilledAt']).toBeTruthy();
    expect(merged['_meta.doRequest.fulfillmentNotes']).toBe('Done');
  });

  it('hasOpenDoRequest detects open DO', () => {
    expect(
      hasOpenDoRequest({
        '_meta.doRequest.requestedAt': '2026-01-01',
      })
    ).toBe(true);
    expect(
      hasOpenDoRequest({
        '_meta.doRequest.requestedAt': '2026-01-01',
        '_meta.doRequest.fulfilledAt': '2026-01-02',
      })
    ).toBe(false);
  });

  it('formatComplianceAuditMessage returns readable text', () => {
    expect(formatComplianceAuditMessage('enach', 'fulfill')).toContain('eNACH');
  });
});
