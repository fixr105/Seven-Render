import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddDealerModal } from '../AddDealerModal';
import { apiService } from '../../../services/api';

vi.mock('../../../auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'USER-kam',
      kamId: 'USER-1767430965768-xkughnmb6',
      email: 'kam@test.local',
      role: 'kam',
    },
    loading: false,
  }),
}));

vi.mock('../../../services/api', () => ({
  apiService: {
    createDealer: vi.fn(),
    listLoanProducts: vi.fn().mockResolvedValue({
      success: true,
      data: [{ id: 'recP', productId: 'LP012', productName: 'B2C EV', active: true }],
    }),
  },
}));

async function fillKyc(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByRole('textbox', { name: 'Dealer Contact' }), '9043963606');
  await user.type(screen.getByRole('textbox', { name: 'GST Number' }), '34gufps3547k1z3');
  await user.type(screen.getByRole('textbox', { name: 'Dealer PAN' }), 'gufps3547k');
  await user.type(screen.getByRole('textbox', { name: 'Dealer Pincode' }), '605008');
  await user.type(screen.getByRole('textbox', { name: 'Dealer IFSC Code' }), 'sbin0000900');
}

describe('AddDealerModal', () => {
  beforeEach(() => {
    vi.mocked(apiService.createDealer).mockReset();
  });

  it('keeps Add Dealer disabled until the password and KYC fields are valid', async () => {
    const user = userEvent.setup();
    render(<AddDealerModal isOpen onClose={() => {}} />);

    const submit = screen.getByRole('button', { name: 'Add Dealer' });
    expect(submit).toBeDisabled();
    expect(screen.queryByText(/pass@123/i)).not.toBeInTheDocument();

    await user.type(screen.getByRole('textbox', { name: 'Client Name' }), 'Jo');
    await user.type(screen.getByRole('textbox', { name: 'Login Email' }), 'a@b.co');
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText('Password'), 'Secret123');
    expect(submit).toBeDisabled();

    await fillKyc(user);
    expect(submit).toBeEnabled();
  });

  it('sends the entered password and autofilled name and email', async () => {
    const user = userEvent.setup();
    vi.mocked(apiService.createDealer).mockResolvedValue({
      success: true,
      data: { email: 'a@b.co', name: 'QA MOTORS', role: 'client', clientId: 'USER-1' },
    });

    render(<AddDealerModal isOpen onClose={() => {}} />);

    await user.type(screen.getByRole('textbox', { name: 'Client Name' }), 'Qa Motors');
    expect(screen.getByRole('textbox', { name: 'Primary Contact Name' })).toHaveValue('Qa Motors');
    expect(screen.getByRole('textbox', { name: 'Trade Name' })).toHaveValue('Qa Motors');
    expect(screen.getByRole('textbox', { name: 'Name in Bank' })).toHaveValue('Qa Motors');

    await user.type(screen.getByRole('textbox', { name: 'Login Email' }), 'A@B.co');
    expect(screen.getByRole('textbox', { name: 'Dealer Email' })).toHaveValue('A@B.co');

    await user.clear(screen.getByRole('textbox', { name: 'Dealer Email' }));
    await user.type(screen.getByRole('textbox', { name: 'Dealer Email' }), 'desk@b.co');
    await user.type(screen.getByRole('textbox', { name: 'Client Name' }), ' Two');
    expect(screen.getByRole('textbox', { name: 'Dealer Email' })).toHaveValue('desk@b.co');

    await user.type(screen.getByLabelText('Password'), 'Secret123');
    await user.type(screen.getByRole('textbox', { name: 'Dealer Contact' }), '9043963606');
    await user.type(screen.getByRole('textbox', { name: 'GST Number' }), '34GUFPS3547K1Z3');
    await user.type(screen.getByRole('textbox', { name: 'Dealer PAN' }), 'GUFPS3547K');
    await user.type(screen.getByRole('textbox', { name: 'Dealer Pincode' }), '605008');
    await user.type(screen.getByRole('textbox', { name: 'Dealer IFSC Code' }), 'SBIN0000900');
    await user.click(screen.getByRole('button', { name: 'Add Dealer' }));

    expect(apiService.createDealer).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'a@b.co',
        password: 'Secret123',
        clientName: 'QA MOTORS TWO',
        primaryContactName: 'QA MOTORS TWO',
        dealerEmail: 'desk@b.co',
        products: 'LP012',
        enabledModules: ['M1', 'M3', 'M4', 'M5'],
        commissionRate: '0',
        status: 'Active',
      })
    );
    expect(screen.queryByText(/pass@123/i)).not.toBeInTheDocument();
  });
});
