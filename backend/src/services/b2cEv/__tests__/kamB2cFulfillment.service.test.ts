import { describe, expect, it } from '@jest/globals';
import {
  buildCompliancePatch,
  buildDoChecklistPatch,
  buildDoClearRequestPatch,
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
    expect(merged['_meta.vkyc.status']).toBe('Done');
  });

  it('buildDoFulfillPatch sets fulfilledAt and approver metadata', () => {
    const merged = buildDoFulfillPatch(
      { '_meta.doRequest.requestedAt': '2026-01-01' },
      { notes: 'Done', fulfilledBy: 'kam@test.local' }
    );
    expect(merged['_meta.doRequest.requestedAt']).toBe('2026-01-01');
    expect(merged['_meta.doRequest.fulfilledAt']).toBeTruthy();
    expect(merged['_meta.doRequest.fulfilledBy']).toBe('kam@test.local');
    expect(merged['_meta.doRequest.status']).toBe('approved');
    expect(merged['_meta.doRequest.fulfillmentNotes']).toBe('Done');
  });

  it('saves the checklist without fulfilling the DO', () => {
    const approval = {
      checklist: ['Aadhaar OTP done on Fintree'],
      approvedBy: 'kam@test.local',
      approvedAt: '2026-11-17T10:00:00.000Z',
    };
    const merged = buildDoChecklistPatch(
      { '_meta.doRequest.requestedAt': '2026-01-01' },
      approval
    );
    expect(merged['_meta.doApproval']).toMatchObject(approval);
    expect(merged['_meta.doRequest.fulfilledAt']).toBeUndefined();
  });

  it('fulfills only when the PDF approval is included', () => {
    const approval = {
      checklist: ['eNACH done'],
      approvedBy: 'kam@test.local',
      approvedAt: '2026-11-17T10:00:00.000Z',
      doUrl: 'https://files.example/do.pdf',
      doFileName: 'DO.pdf',
      doGeneratedAt: '2026-11-17T10:01:00.000Z',
    };
    const merged = buildDoFulfillPatch(
      { '_meta.doRequest.requestedAt': '2026-01-01' },
      { fulfilledBy: 'kam@test.local', doApproval: approval }
    );
    expect(merged['_meta.doRequest.fulfilledAt']).toBeTruthy();
    expect(merged['_meta.doRequest.status']).toBe('approved');
    expect(merged['_meta.doApproval']).toMatchObject(approval);
  });

  it('buildDoClearRequestPatch stores rejection metadata', () => {
    const merged = buildDoClearRequestPatch(
      { '_meta.doRequest.requestedAt': '2026-01-01', '_meta.doRequest.queryId': 'Q-1' },
      { rejectionReason: 'Missing docs', rejectedBy: 'kam@test.local' }
    );
    expect(merged['_meta.doRequest.requestedAt']).toBe('');
    expect(merged['_meta.doRequest.status']).toBe('rejected');
    expect(merged['_meta.doRequest.rejectionReason']).toBe('Missing docs');
    expect(merged['_meta.doRequest.rejectedBy']).toBe('kam@test.local');
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
