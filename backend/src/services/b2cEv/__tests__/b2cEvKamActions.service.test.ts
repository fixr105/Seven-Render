import { describe, expect, it } from '@jest/globals';
import {
  extractPendingB2cActionsFromFormData,
  scanApplicationsForPendingB2cActions,
} from '../b2cEvKamActions.service.js';

describe('b2cEvKamActions.service', () => {
  it('extracts open compliance request', () => {
    const rows = extractPendingB2cActionsFromFormData(
      {
        '_meta.formTemplate': 'b2c_ev_v1',
        '_meta.kamRequests.vkyc.requestedAt': '2026-01-01T00:00:00.000Z',
        'compliance.vkycDone': 'false',
      },
      { applicationId: 'app-1', fileId: 'FILE-1', applicantName: 'Ajay' }
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe('compliance');
    expect(rows[0].itemId).toBe('vkyc');
  });

  it('scans applications and limits to B2C template', () => {
    const rows = scanApplicationsForPendingB2cActions([
      {
        id: 'app-1',
        'File ID': 'FILE-1',
        Status: 'under_kam_review',
        'Form Data': JSON.stringify({
          '_meta.formTemplate': 'b2c_ev_v1',
          '_meta.doRequest.requestedAt': '2026-01-02T00:00:00.000Z',
        }),
      },
      {
        id: 'app-2',
        'File ID': 'FILE-2',
        Status: 'under_kam_review',
        'Form Data': JSON.stringify({ '_meta.formTemplate': 'legacy' }),
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe('do');
  });
});
