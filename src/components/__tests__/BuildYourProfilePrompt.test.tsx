import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BuildYourProfilePrompt } from '../BuildYourProfilePrompt';
import { UserContext } from '../../auth/types';
import { TestWrapper } from '../../test/helpers';

const baseUser: UserContext = {
  id: 'u1',
  email: 'test@user.com',
  role: 'client',
  name: '',
  phone: '',
  company: '',
};

describe('BuildYourProfilePrompt', () => {
  it('renders company field for roles that require it', () => {
    render(
      <TestWrapper>
        <BuildYourProfilePrompt
          isOpen
          user={baseUser}
          missingFields={['name', 'phone', 'company']}
          onDismiss={vi.fn()}
          onSave={vi.fn(async () => {})}
        />
      </TestWrapper>
    );
    expect(screen.getByPlaceholderText(/Enter company name/i)).toBeInTheDocument();
  });

  it('calls save with required payload', async () => {
    const onSave = vi.fn(async () => {});
    render(
      <TestWrapper>
        <BuildYourProfilePrompt
          isOpen
          user={baseUser}
          missingFields={['name', 'phone', 'company']}
          onDismiss={vi.fn()}
          onSave={onSave}
        />
      </TestWrapper>
    );

    fireEvent.change(screen.getByPlaceholderText(/Enter your full name/i), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByPlaceholderText(/\+91 9876543210/i), { target: { value: '+919876543210' } });
    fireEvent.change(screen.getByPlaceholderText(/Enter company name/i), { target: { value: 'Seven' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Profile/i }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        name: 'Test User',
        phone: '+919876543210',
        company: 'Seven',
      })
    );
  });

  it('calls dismiss when maybe later clicked', () => {
    const onDismiss = vi.fn();
    render(
      <TestWrapper>
        <BuildYourProfilePrompt
          isOpen
          user={{ ...baseUser, role: 'kam' }}
          missingFields={['name', 'phone']}
          onDismiss={onDismiss}
          onSave={vi.fn(async () => {})}
        />
      </TestWrapper>
    );
    fireEvent.click(screen.getByRole('button', { name: /Maybe Later/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
