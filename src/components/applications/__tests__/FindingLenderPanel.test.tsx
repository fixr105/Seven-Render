import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FindingLenderPanel } from '../FindingLenderPanel';

describe('FindingLenderPanel', () => {
  it('expands +N chip to reveal overflow reasons on tap', async () => {
    const user = userEvent.setup();
    render(
      <FindingLenderPanel
        phase="hard_reject"
        preview={['Credit card overdue amount exceeds limit', 'Recent payment delays found in last 3 months']}
        overflow={[
          'Payment delays found in last 6 months',
          'Overdue payments found in last 12 months',
        ]}
        reasons={[
          'Credit card overdue amount exceeds limit',
          'Recent payment delays found in last 3 months',
          'Payment delays found in last 6 months',
          'Overdue payments found in last 12 months',
        ]}
      />
    );

    expect(screen.getByTestId('qualify-overflow-chip')).toHaveTextContent('+2');
    expect(screen.queryByTestId('qualify-overflow-list')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('qualify-overflow-chip'));

    const list = screen.getByTestId('qualify-overflow-list');
    expect(list).toHaveTextContent(/Payment delays found in last 6 months/i);
    expect(list).toHaveTextContent(/Overdue payments found in last 12 months/i);
  });
});
