import { beforeEach, describe, expect, it, vi } from 'vitest';
import { airtableGet, airtableWrite } from '../../services/engineClient';
import { ensureDeadlineMissFlag } from '../kamFlagsDeadline';

vi.mock('../../services/engineClient', () => ({
  airtableGet: vi.fn(),
  airtableWrite: vi.fn(),
}));

describe('ensureDeadlineMissFlag', () => {
  const started = '2026-01-01T00:00:00.000Z';
  const expiredDeadline = '2026-01-01T01:00:00.000Z';
  const now = new Date('2026-01-02T12:00:00.000Z');
  const baseForm = {
    '_meta.deadline': {
      started_at: started,
      deadline_at: expiredDeadline,
      missed_count: 0,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (airtableGet as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, count: 0, records: [] });
    (airtableWrite as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, id: 'recFlag1' });
  });

  it('always resets deadline and writes Form Data before flag create', async () => {
    const result = await ensureDeadlineMissFlag({
      fileId: 'SFMTEST',
      formData: baseForm,
      recordId: 'recLoan1',
      pendingDetails: 'delivery — IoT',
      now,
    });

    expect(result.deadline.missed_count).toBe(1);
    expect(Date.parse(result.deadline.deadline_at) - now.getTime()).toBe(24 * 60 * 60 * 1000);
    expect(result.flagged).toBe(true);
    expect(result.deadline.flag_pending).toBeUndefined();

    const writes = (airtableWrite as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
    const formWrite = writes.find((w) => w.table === 'Loan Applications');
    expect(formWrite).toBeTruthy();
    expect(formWrite.record_id).toBe('recLoan1');
    const parsed = JSON.parse(formWrite.fields['Form Data'] as string);
    expect(parsed['_meta.deadline'].missed_count).toBe(1);

    const flagWrite = writes.find((w) => w.table === 'KAM Flags');
    expect(flagWrite.fields.flag_id).toBe('SFMTEST-D1');
  });

  it('on flag create failure still resets deadline, sets flag_pending, and does not throw', async () => {
    (airtableWrite as ReturnType<typeof vi.fn>).mockImplementation(async (input: { table: string }) => {
      if (input.table === 'KAM Flags') {
        throw new Error('Forbidden - perhaps check your credentials?');
      }
      return { ok: true };
    });

    const result = await ensureDeadlineMissFlag({
      fileId: 'SFMTEST',
      formData: baseForm,
      recordId: 'recLoan1',
      pendingDetails: 'delivery — IoT',
      now,
    });

    expect(result.flagged).toBe(false);
    expect(result.deadline.missed_count).toBe(1);
    expect(result.deadline.flag_pending).toBe('SFMTEST-D1');
    expect(result.formData['_meta.deadline']).toMatchObject({
      missed_count: 1,
      flag_pending: 'SFMTEST-D1',
    });
  });

  it('retries flag create when flag_pending is set and clears it on success', async () => {
    const formWithPending = {
      '_meta.deadline': {
        started_at: started,
        deadline_at: new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString(),
        missed_count: 1,
        flag_pending: 'SFMTEST-D1',
      },
    };

    const result = await ensureDeadlineMissFlag({
      fileId: 'SFMTEST',
      formData: formWithPending,
      recordId: 'recLoan1',
      pendingDetails: 'delivery — IoT',
      now,
    });

    expect(result.flagged).toBe(true);
    expect(result.deadline.flag_pending).toBeUndefined();
    expect(result.deadline.missed_count).toBe(1);
    const flagWrite = (airtableWrite as ReturnType<typeof vi.fn>).mock.calls
      .map((c) => c[0])
      .find((w) => w.table === 'KAM Flags');
    expect(flagWrite.fields.flag_id).toBe('SFMTEST-D1');
  });
});
