import { beforeEach, describe, expect, it, vi } from 'vitest';
import { airtableGet, airtableWrite } from '../../services/engineClient';
import { markLoanFileVkycRequested } from '../vkycLinks';

vi.mock('../../services/engineClient', () => ({
  airtableGet: vi.fn(),
  airtableWrite: vi.fn(),
  readAirtableField: (record: { [key: string]: unknown } | null, column: string) =>
    record ? record[column] : undefined,
}));

describe('markLoanFileVkycRequested', () => {
  beforeEach(() => {
    vi.mocked(airtableGet).mockReset();
    vi.mocked(airtableWrite).mockReset();
  });

  it('writes Requested onto the loan file the KAM checklist reads', async () => {
    vi.mocked(airtableGet).mockResolvedValue({
      ok: true,
      records: [
        {
          id: 'recc7504s7D0ZUj0V',
          'File ID': 'SFMWJHW7BR',
          'Form Data': JSON.stringify({
            '_meta.formTemplate': 'b2c_ev_v1',
            '_meta.kamRequests.vkyc.requestedAt': '',
          }),
        },
      ],
    });
    vi.mocked(airtableWrite).mockResolvedValue({ ok: true, id: 'recc7504s7D0ZUj0V' });

    await markLoanFileVkycRequested('SFMWJHW7BR', {
      id: 'recFaSd3BFQT0O3BZ',
      status: 'Requested',
      requested_at: '2026-11-16T17:43:55.895Z',
    });

    expect(airtableWrite).toHaveBeenCalledWith(
      expect.objectContaining({
        table: 'Loan Applications',
        record_id: 'recc7504s7D0ZUj0V',
      })
    );
    const fields = vi.mocked(airtableWrite).mock.calls[0][0].fields as { 'Form Data': string };
    const stored = JSON.parse(fields['Form Data']) as Record<string, string>;
    expect(stored['_meta.vkyc.status']).toBe('Requested');
    expect(stored['_meta.kamRequests.vkyc.requestedAt']).toBe('2026-11-16T17:43:55.895Z');
    expect(stored['_meta.vkyc.recordId']).toBe('recFaSd3BFQT0O3BZ');
  });
});
