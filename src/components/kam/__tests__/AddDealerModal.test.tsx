import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddDealerModal } from '../AddDealerModal';
import { apiService } from '../../../services/api';

const authMock = vi.hoisted(() => ({
  user: {
    id: 'USER-kam',
    email: 'kam@test.local',
    role: 'kam' as const,
    name: 'Test KAM' as string | null,
    kamId: undefined as string | undefined,
    associatedProfile: undefined as string | undefined,
  },
}));

vi.mock('../../../auth/AuthContext', () => ({
  useAuth: () => ({
    user: authMock.user,
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

async function fillAccount(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByRole('textbox', { name: 'Client Name' }), 'Qa Motors');
  await user.type(screen.getByRole('textbox', { name: 'Login Email' }), 'a@b.co');
  await user.type(screen.getByLabelText('Password'), 'Secret123');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled());
}

async function fillBusiness(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByRole('textbox', { name: 'Dealer Contact' }), '9043963606');
  await user.type(screen.getByRole('textbox', { name: 'Dealer PAN' }), 'GUFPS3547K');
  await user.click(screen.getByRole('button', { name: 'Next' }));
}

async function fillAddress(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByRole('textbox', { name: 'Dealer Address' }), '134 Lenin Nagar');
  await user.type(screen.getByRole('textbox', { name: 'Dealer City' }), 'Puducherry');
  await user.selectOptions(screen.getByRole('combobox', { name: 'Dealer State' }), 'Puducherry');
  await user.type(screen.getByRole('textbox', { name: 'Dealer Pincode' }), '605008');
  await user.click(screen.getByRole('button', { name: 'Next' }));
}

describe('AddDealerModal', () => {
  beforeEach(() => {
    vi.mocked(apiService.createDealer).mockReset();
    authMock.user = {
      id: 'USER-kam',
      email: 'kam@test.local',
      role: 'kam',
      name: 'Test KAM',
      kamId: undefined,
      associatedProfile: undefined,
    };
    window.history.replaceState({}, '', '/');
  });

  it('shows the KAM name and keeps the form body scrollable', () => {
    render(<AddDealerModal isOpen onClose={() => {}} />);

    expect(screen.getByRole('textbox', { name: 'Assigned KAM' })).toHaveValue('Test KAM');
    expect(screen.getByRole('textbox', { name: 'Assigned KAM' })).not.toHaveValue('USER-kam');

    const dialog = screen.getByRole('dialog', { name: 'Add dealer' });
    expect(dialog.querySelector('.max-h-\\[90vh\\]')).toBeTruthy();
    expect(dialog.querySelector('.overflow-y-auto')).toBeTruthy();
  });

  it('shows Associated Profile when the session name is a raw user id', () => {
    authMock.user = {
      id: 'recKAM',
      email: 'kam@test.local',
      role: 'kam',
      name: 'USER-1767430965768-xkughnmb6',
      kamId: 'USER-1767430965768-xkughnmb6',
      associatedProfile: 'Sagar',
    };
    render(<AddDealerModal isOpen onClose={() => {}} />);

    expect(screen.getByRole('textbox', { name: 'Assigned KAM' })).toHaveValue(
      'Sagar (USER-1767430965768-xkughnmb6)'
    );
  });

  it('keeps Next disabled until the account step is valid', async () => {
    const user = userEvent.setup();
    render(<AddDealerModal isOpen onClose={() => {}} />);

    const next = screen.getByRole('button', { name: 'Next' });
    expect(next).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: 'Client Name' }), 'Jo');
    expect(next).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: 'Login Email' }), 'a@b.co');
    await user.type(screen.getByLabelText('Password'), 'Secret123');
    await waitFor(() => expect(next).toBeEnabled());
  });

  it('copies the client name until that field is edited', async () => {
    const user = userEvent.setup();
    render(<AddDealerModal isOpen onClose={() => {}} />);

    await user.type(screen.getByRole('textbox', { name: 'Client Name' }), 'Qa Motors');
    expect(screen.getByRole('textbox', { name: 'Primary Contact Name' })).toHaveValue('Qa Motors');

    await user.clear(screen.getByRole('textbox', { name: 'Primary Contact Name' }));
    await user.type(screen.getByRole('textbox', { name: 'Primary Contact Name' }), 'Desk');
    await user.type(screen.getByRole('textbox', { name: 'Client Name' }), ' Two');
    expect(screen.getByRole('textbox', { name: 'Primary Contact Name' })).toHaveValue('Desk');
  });

  it('requires the account number confirmation to match', async () => {
    const user = userEvent.setup();
    render(<AddDealerModal isOpen onClose={() => {}} />);
    await fillAccount(user);
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await fillBusiness(user);
    await fillAddress(user);

    await user.type(screen.getByLabelText('Dealer Bank Name'), 'State Bank');
    await user.type(screen.getByLabelText('Dealer Account Number'), '44392819978');
    await user.type(screen.getByLabelText('Confirm Account Number'), '44392819979');
    await user.type(screen.getByLabelText('Dealer IFSC'), 'SBIN0000900');
    expect(screen.getByRole('button', { name: 'Create dealer' })).toBeDisabled();

    await user.clear(screen.getByLabelText('Confirm Account Number'));
    await user.type(screen.getByLabelText('Confirm Account Number'), '44392819978');
    expect(screen.getByRole('button', { name: 'Create dealer' })).toBeEnabled();
  });

  it('shows Try again after a failed step and resends the resume', async () => {
    const user = userEvent.setup();
    const resume = { clientId: 'USER-1', clientRecordId: 'recCLIENT1', kycRecordId: '' };
    vi.mocked(apiService.createDealer)
      .mockResolvedValueOnce({
        success: false,
        error_type: 'STEP_FAILED',
        step: 'B',
        error: 'airtable down',
        resume,
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          clientId: 'USER-1',
          clientRecordId: 'recCLIENT1',
          kycRecordId: 'recKYC1',
          kycRecord: 'KYC1',
          dealerId: 'DLR1',
          email: 'a@b.co',
          name: 'QA MOTORS',
          role: 'client',
        },
      });

    render(<AddDealerModal isOpen onClose={() => {}} />);
    await fillAccount(user);
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await fillBusiness(user);
    await fillAddress(user);
    await user.type(screen.getByLabelText('Dealer Bank Name'), 'State Bank');
    await user.type(screen.getByLabelText('Dealer Account Number'), '44392819978');
    await user.type(screen.getByLabelText('Confirm Account Number'), '44392819978');
    await user.type(screen.getByLabelText('Dealer IFSC'), 'SBIN0000900');
    await user.click(screen.getByRole('button', { name: 'Create dealer' }));

    expect(await screen.findByText(/Could not finish creating the dealer \(step B\)/)).toBeInTheDocument();
    expect(screen.getByText('airtable down')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(apiService.createDealer).toHaveBeenCalledTimes(2));
    const firstPayload = vi.mocked(apiService.createDealer).mock.calls[0][0] as Record<string, unknown>;
    expect(firstPayload).not.toHaveProperty('Assigned KAM');
    expect(firstPayload).not.toHaveProperty('assignedKAM');
    expect(JSON.stringify(firstPayload)).not.toContain('Test KAM');
    expect(vi.mocked(apiService.createDealer).mock.calls[1][0]).toEqual(
      expect.objectContaining({ resume })
    );
  });

  it('keeps the password out of storage and the URL', async () => {
    const user = userEvent.setup();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    render(<AddDealerModal isOpen onClose={() => {}} />);
    await user.type(screen.getByLabelText('Password'), 'Secret123');
    expect(window.location.href).not.toContain('Secret123');
    const stored = setItem.mock.calls.map((call) => `${call[0]}=${call[1]}`).join('\n');
    expect(stored).not.toContain('Secret123');
    setItem.mockRestore();
  });
});
