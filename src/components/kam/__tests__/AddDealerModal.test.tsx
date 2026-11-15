import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddDealerModal } from '../AddDealerModal';
import { apiService } from '../../../services/api';

vi.mock('../../../services/api', () => ({
  apiService: {
    createDealer: vi.fn(),
  },
}));

describe('AddDealerModal', () => {
  beforeEach(() => {
    vi.mocked(apiService.createDealer).mockReset();
  });

  it('enables Add Dealer only for a valid email and a name of at least 2 characters', async () => {
    const user = userEvent.setup();
    render(<AddDealerModal isOpen onClose={() => {}} />);

    const submit = screen.getByRole('button', { name: 'Add Dealer' });
    const email = screen.getByRole('textbox', { name: 'Email' });
    const dealerName = screen.getByRole('textbox', { name: 'Dealer Name' });

    expect(submit).toBeDisabled();

    await user.type(email, 'not-an-email');
    await user.type(dealerName, 'J');
    expect(submit).toBeDisabled();

    await user.clear(email);
    await user.clear(dealerName);
    await user.type(email, 'a@b.co');
    expect(submit).toBeDisabled();

    await user.type(dealerName, 'Jo');
    expect(submit).toBeEnabled();
  });

  it('sends a lowercased email and an uppercased name', async () => {
    const user = userEvent.setup();
    vi.mocked(apiService.createDealer).mockResolvedValue({
      success: true,
      data: { email: 'a@b.co', name: 'JO', role: 'client' },
    });

    render(<AddDealerModal isOpen onClose={() => {}} />);

    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'A@B.co');
    await user.type(screen.getByRole('textbox', { name: 'Dealer Name' }), 'Jo');
    await user.click(screen.getByRole('button', { name: 'Add Dealer' }));

    expect(apiService.createDealer).toHaveBeenCalledWith({
      email: 'a@b.co',
      name: 'JO',
    });
  });
});
