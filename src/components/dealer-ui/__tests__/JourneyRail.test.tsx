import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JourneyRail } from '../JourneyRail';

const APPLICATION_LABELS = [
  'Loan product',
  'Borrower',
  'Loan details',
  'Dealer',
  'Co-applicant',
  'KYC & documents',
];

const APPROVAL_LABELS = [
  'Eligibility',
  'NTC upload',
  'Offer',
  'eNACH',
  'Documents',
  'Stamps',
  'Signing',
];

function renderRail(props: ComponentProps<typeof JourneyRail> = {}) {
  return render(
    <main>
      <JourneyRail {...props} />
    </main>
  );
}

describe('JourneyRail', () => {
  it('shows the application phase as current and locks the later phases on step 1', () => {
    renderRail({ currentIndex: 0 });

    const application = screen.getByTestId('journey-phase-application');
    const approval = screen.getByTestId('journey-phase-approval');
    const delivery = screen.getByTestId('journey-phase-delivery');

    expect(application).toHaveTextContent('Application');
    expect(application.className).toMatch(/text-dealer-navy/);
    expect(application.className).toMatch(/border-dealer-navy/);
    expect(approval.className).toMatch(/opacity-45/);
    expect(delivery.className).toMatch(/opacity-45/);
    expect(approval.querySelector('svg')).toBeTruthy();
    expect(delivery.querySelector('svg')).toBeTruthy();
    expect(screen.queryByText(/of \d+ done/i)).not.toBeInTheDocument();

    const steps = screen.getByTestId('journey-steps');
    expect(within(steps).getAllByRole('listitem')).toHaveLength(6);
    APPLICATION_LABELS.forEach((label) => {
      expect(within(steps).getByText(label)).toBeInTheDocument();
    });
    expect(within(steps).getByText('Loan product').className).toMatch(/text-dealer-navy/);
    expect(within(steps).getByText('Borrower').className).toMatch(/text-dealer-text-quiet/);
  });

  it('shows approval steps when the current step is stamps, and ticks application', () => {
    renderRail({ currentStepId: 'stamps' });

    expect(screen.getByTestId('journey-phase-approval').className).toMatch(/border-dealer-navy/);
    expect(screen.getByTestId('journey-phase-approval').className).not.toMatch(/opacity-45/);
    expect(screen.getByTestId('journey-phase-application').querySelector('svg')).toBeTruthy();

    const steps = screen.getByTestId('journey-steps');
    expect(within(steps).getAllByRole('listitem')).toHaveLength(APPROVAL_LABELS.length);
    APPROVAL_LABELS.forEach((label) => {
      expect(within(steps).getByText(label)).toBeInTheDocument();
    });
    expect(within(steps).queryByText('Loan product')).not.toBeInTheDocument();
  });

  it('lets a done step be clicked and leaves an upcoming step inert', async () => {
    const user = userEvent.setup();
    const onStepClick = vi.fn();
    renderRail({ currentIndex: 2, completedIndices: [0, 1], onStepClick });

    await user.click(screen.getByTestId('journey-step-product'));
    expect(onStepClick).toHaveBeenCalledWith(0);

    const upcoming = screen.getByTestId('journey-step-dealer');
    expect(upcoming).toBeDisabled();
    expect(upcoming.className).toMatch(/cursor-default/);
  });

  it('keeps a locked phase at 45% opacity with a lock icon', () => {
    renderRail({ currentIndex: 0 });
    const approval = screen.getByTestId('journey-phase-approval');
    expect(approval.className).toMatch(/opacity-45/);
    expect(approval.querySelector('svg')).toBeTruthy();
    expect(approval.tagName).not.toBe('BUTTON');
  });

  it('scrolls the step row instead of truncating labels', () => {
    renderRail({ currentIndex: 0 });
    const steps = screen.getByTestId('journey-steps');
    expect(steps.className).toMatch(/overflow-x-auto/);
    expect(steps.className).toMatch(/scrollbar-width:\s*none|\[scrollbar-width:none\]/);
    const label = within(steps).getByText('KYC & documents');
    expect(label.className).not.toMatch(/truncate/);
    expect(label.className).toMatch(/whitespace-nowrap/);
    expect(label.className).toMatch(/lg:text-\[13px\]|text-\[13px\]/);
    expect(screen.getByTestId('journey-phase-application').className).toMatch(/lg:text-xs/);
  });

  it('opens the phase list from the phone strip', async () => {
    const user = userEvent.setup();
    renderRail({ currentIndex: 0 });

    const strip = screen.getByTestId('journey-mobile');
    expect(strip).toHaveTextContent(/Application/i);
    expect(strip).toHaveTextContent('Step 1 of 6');
    expect(within(strip).getAllByTestId('journey-mobile-dot')).toHaveLength(6);

    await user.click(strip);
    const sheet = screen.getByRole('dialog');
    expect(within(sheet).getByText('Application')).toBeInTheDocument();
    expect(within(sheet).getByText('Approval')).toBeInTheDocument();
    expect(within(sheet).getByText('Delivery')).toBeInTheDocument();
    expect(within(sheet).getByText('Loan product')).toBeInTheDocument();
    expect(within(sheet).getAllByText('Locked').length).toBeGreaterThan(0);
  });

  it('does not let the step scroller widen the page', () => {
    renderRail({ currentIndex: 0 });
    const rail = screen.getByTestId('journey-rail');
    expect(rail.className).toMatch(/overflow-x-hidden|min-w-0/);
    expect(screen.getByTestId('journey-steps').className).toMatch(/overflow-x-auto/);
  });

  it('adds a shadow only after the page scrolls', () => {
    renderRail({ currentIndex: 0 });
    const rail = screen.getByTestId('journey-rail');
    expect(rail).not.toHaveStyle({ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)' });

    const main = document.querySelector('main');
    if (!main) throw new Error('main missing');
    main.scrollTop = 1;
    fireEvent.scroll(main);

    expect(rail).toHaveStyle({ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)' });

    main.scrollTop = 0;
    fireEvent.scroll(main);
    expect(rail).not.toHaveStyle({ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)' });
  });
});
