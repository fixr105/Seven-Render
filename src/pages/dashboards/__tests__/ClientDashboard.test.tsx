import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClientDashboard } from '../ClientDashboard';
import { renderWithProviders } from '../../../test/helpers';
import * as engineClient from '../../../services/engineClient';

vi.mock('../../../services/engineClient', () => ({
  airtableGet: vi.fn(),
}));

const NOW = new Date();
const recent = new Date(NOW.getTime() - 2 * 60 * 1000).toISOString();

function form(body: Record<string, unknown>): string {
  return JSON.stringify(body);
}

const FIVE = [
  {
    id: 'rec1',
    'File ID': 'SFMWHK65WO',
    Status: 'Draft',
    Modified: recent,
    'Form Data': form({
      borrower: { customerName: 'Govind Pandey' },
      loan: { requestedAmount: 100000, productId: 'EV' },
      _meta: { pricing: { roi_pct: 28 } },
    }),
  },
  {
    id: 'rec2',
    'File ID': 'DONE1',
    Status: 'Completed',
    Modified: '2026-01-01T00:00:00.000Z',
    'Form Data': form({
      borrower: { customerName: 'Asha' },
      loan: { requestedAmount: 50000 },
      _meta: { pricing: { roi_pct: 24 } },
    }),
  },
  {
    id: 'rec3',
    'File ID': 'REJ1',
    Status: 'Rejected',
    Modified: '2026-01-02T00:00:00.000Z',
    'Form Data': form({ borrower: { customerName: 'Ravi' }, loan: { requestedAmount: 999 } }),
  },
  {
    id: 'rec4',
    'File ID': 'PEND1',
    Status: 'Pending KAM Review',
    Modified: '2026-01-03T00:00:00.000Z',
    'Form Data': form({ borrower: { customerName: 'Meera' } }),
  },
  {
    id: 'rec5',
    'File ID': 'PROC1',
    Status: 'Processing',
    Modified: '2026-01-04T00:00:00.000Z',
    'Form Data': form({
      borrower: { customerName: 'Neel' },
      loan: { requestedAmount: 25000 },
      _meta: { deadline: { deadline_at: '2099-01-01T00:00:00.000Z' } },
    }),
  },
];

describe('ClientDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, '', '/dashboard');
  });

  it('shows KPI counts and the sanctioned sum for five records', async () => {
    vi.mocked(engineClient.airtableGet).mockResolvedValue({
      ok: true,
      count: 5,
      records: FIVE,
    } as never);

    renderWithProviders(<ClientDashboard />);

    expect(screen.getAllByTestId('dashboard-kpi-skeleton').length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(screen.getByTestId('kpi-total')).toHaveTextContent('5');
    });
    expect(screen.getByTestId('kpi-active')).toHaveTextContent('3');
    expect(screen.getByTestId('kpi-sanctioned')).toHaveTextContent('₹1,50,000');
    expect(screen.getByTestId('kpi-pending')).toHaveTextContent('2');
    expect(screen.getByText('GOVIND PANDEY')).toBeInTheDocument();
    expect(screen.getAllByText('Pending').length).toBeGreaterThan(0);
    expect(screen.getAllByText('In progress').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Needs action').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Done').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Blocked').length).toBeGreaterThan(0);
  });

  it('shows zero cards and the empty state when there are no records', async () => {
    vi.mocked(engineClient.airtableGet).mockResolvedValue({
      ok: true,
      count: 0,
      records: [],
    } as never);

    renderWithProviders(<ClientDashboard />);

    await waitFor(() => {
      expect(screen.getByText('No applications yet. Start a new application.')).toBeInTheDocument();
    });
    expect(screen.getByTestId('kpi-total')).toHaveTextContent('0');
    expect(screen.getByTestId('kpi-active')).toHaveTextContent('0');
    expect(screen.getByTestId('kpi-sanctioned')).toHaveTextContent('₹0');
    expect(screen.getByTestId('kpi-pending')).toHaveTextContent('0');
  });

  it('shows an inline alert and retries the fetch', async () => {
    vi.mocked(engineClient.airtableGet)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ ok: true, count: 0, records: [] } as never);

    renderWithProviders(<ClientDashboard />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load applications. Check your connection.'
    );
    expect(screen.getByTestId('kpi-total')).toHaveTextContent('—');

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => {
      expect(engineClient.airtableGet).toHaveBeenCalledTimes(2);
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows dashes for a malformed form and keeps the other row', async () => {
    vi.mocked(engineClient.airtableGet).mockResolvedValue({
      ok: true,
      count: 2,
      records: [
        { id: 'rec-bad', 'File ID': 'BAD1', Status: 'Draft', Modified: recent, 'Form Data': '{not-json' },
        {
          id: 'rec-good',
          'File ID': 'GOOD1',
          Status: 'New',
          Modified: '2026-01-01T00:00:00.000Z',
          'Form Data': form({ borrower: { customerName: 'Sharan' }, loan: { requestedAmount: 2000 } }),
        },
      ],
    } as never);

    renderWithProviders(<ClientDashboard />);
    expect(await screen.findByText('SHARAN')).toBeInTheDocument();
    expect(screen.getByText('BAD1')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('filters by file id and applicant name', async () => {
    vi.mocked(engineClient.airtableGet).mockResolvedValue({
      ok: true,
      count: 2,
      records: FIVE.slice(0, 2),
    } as never);

    renderWithProviders(<ClientDashboard />);
    await screen.findByText('GOVIND PANDEY');
    await userEvent.type(screen.getByLabelText('Search applications'), 'asha');
    expect(screen.queryByText('GOVIND PANDEY')).not.toBeInTheDocument();
    expect(screen.getByText('ASHA')).toBeInTheDocument();
  });

  it('opens the application when a row is clicked', async () => {
    vi.mocked(engineClient.airtableGet).mockResolvedValue({
      ok: true,
      count: 1,
      records: [FIVE[0]],
    } as never);

    renderWithProviders(<ClientDashboard />);
    await userEvent.click(await screen.findByTestId('application-row-rec1'));
    expect(window.location.pathname).toBe('/applications/rec1');
  });
});
