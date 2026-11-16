import { describe, expect, it } from 'vitest';
import { buildDashboard, filterDashboardRows, mapAirtableStatus } from '../dealerDashboard';

const NOW = new Date('2026-11-15T12:00:00.000Z');

function record(partial: Record<string, unknown>): Record<string, unknown> {
  return {
    id: 'rec',
    'File ID': 'FILE1',
    Status: 'Draft',
    Modified: '2026-11-15T10:00:00.000Z',
    'Form Data': '{}',
    ...partial,
  };
}

describe('dealer dashboard data', () => {
  it('maps Airtable status text onto the five badges', () => {
    expect(mapAirtableStatus('Draft')).toBe('pending');
    expect(mapAirtableStatus('Processing')).toBe('in_progress');
    expect(mapAirtableStatus('Pending KAM Review')).toBe('needs_action');
    expect(mapAirtableStatus('Disbursed')).toBe('done');
    expect(mapAirtableStatus('Approved')).toBe('done');
    expect(mapAirtableStatus('Rejected')).toBe('blocked');
    expect(mapAirtableStatus('Qualified')).toBe('pending');
  });

  it('counts active work and sums only done amounts', () => {
    const { kpis, rows } = buildDashboard(
      [
        record({
          id: 'rec1',
          'File ID': 'AAA',
          Status: 'Draft',
          Modified: '2026-11-15T11:00:00.000Z',
          'Form Data': JSON.stringify({
            borrower: { customerName: 'Govind Pandey' },
            loan: { requestedAmount: 100000, productId: 'EV' },
            _meta: { pricing: { roi_pct: 28 } },
          }),
        }),
        record({
          id: 'rec2',
          'File ID': 'BBB',
          Status: 'Completed',
          Modified: '2026-11-15T09:00:00.000Z',
          'Form Data': JSON.stringify({
            borrower: { customerName: 'Asha' },
            loan: { requestedAmount: 50000 },
            _meta: { pricing: { roi_pct: 24 } },
          }),
        }),
        record({
          id: 'rec3',
          Status: 'Rejected',
          'Form Data': JSON.stringify({
            borrower: { customerName: 'Ravi' },
            loan: { requestedAmount: 99999 },
          }),
        }),
        record({
          id: 'rec4',
          Status: 'Pending KAM Review',
          'Form Data': JSON.stringify({ borrower: { customerName: 'Meera' }, loan: { requestedAmount: 10 } }),
        }),
        record({
          id: 'rec5',
          Status: 'Processing',
          'Form Data': JSON.stringify({
            borrower: { customerName: 'Neel' },
            loan: { requestedAmount: 25000 },
            _meta: { deadline: { deadline_at: '2026-11-16T00:00:00.000Z' } },
          }),
        }),
      ],
      NOW
    );

    expect(kpis.total).toBe(5);
    expect(kpis.active).toBe(3);
    expect(kpis.sanctionedLabel).toBe('₹50,000');
    expect(kpis.pendingAction).toBe(2);
    expect(rows[0]?.fileId).toBe('AAA');
    expect(rows[0]?.applicant).toBe('GOVIND PANDEY');
  });

  it('treats disbursed as done and leaves it out of active', () => {
    const { kpis, rows } = buildDashboard(
      [
        record({
          id: 'rec-disbursed',
          Status: 'Disbursed',
          'Form Data': JSON.stringify({
            borrower: { customerName: 'Sharan' },
            loan: { requestedAmount: 80000 },
          }),
        }),
      ],
      NOW
    );
    expect(rows[0]?.badge).toBe('done');
    expect(kpis.active).toBe(0);
    expect(kpis.sanctionedLabel).toBe('₹80,000');
  });

  it('returns zeros and no rows when the table is empty', () => {
    const { kpis, rows } = buildDashboard([], NOW);
    expect(kpis).toMatchObject({ total: 0, active: 0, pendingAction: 0, sanctionedLabel: '₹0' });
    expect(rows).toEqual([]);
  });

  it('keeps a malformed form row and shows dashes for name and amount', () => {
    const { rows, kpis } = buildDashboard(
      [
        record({
          id: 'rec-bad',
          'File ID': 'BAD1',
          Status: 'Draft',
          'Form Data': '{not-json',
        }),
        record({
          id: 'rec-good',
          'File ID': 'GOOD1',
          Status: 'New',
          Modified: '2026-11-15T08:00:00.000Z',
          'Form Data': JSON.stringify({
            borrower: { customerName: 'Sharan' },
            loan: { requestedAmount: 2000 },
          }),
        }),
      ],
      NOW
    );
    const bad = rows.find((row) => row.fileId === 'BAD1');
    const good = rows.find((row) => row.fileId === 'GOOD1');
    expect(bad).toMatchObject({ applicant: '—', amountLabel: '—' });
    expect(good?.applicant).toBe('SHARAN');
    expect(good?.amountLabel).toBe('₹2,000');
    expect(kpis.total).toBe(2);
  });

  it('filters by file id and applicant name without case', () => {
    const { rows } = buildDashboard(
      [
        record({
          id: 'rec1',
          'File ID': 'SFMWHK65WO',
          'Form Data': JSON.stringify({ borrower: { customerName: 'Govind Pandey' } }),
        }),
        record({
          id: 'rec2',
          'File ID': 'OTHER',
          'Form Data': JSON.stringify({ borrower: { customerName: 'Sharan Krishnan' } }),
        }),
      ],
      NOW
    );
    expect(filterDashboardRows(rows, 'sfmwhk', []).map((row) => row.fileId)).toEqual(['SFMWHK65WO']);
    expect(filterDashboardRows(rows, 'sharan', []).map((row) => row.applicant)).toEqual([
      'SHARAN KRISHNAN',
    ]);
  });
});
