import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { B2cEvWizardStepper } from '../B2cEvWizardStepper';

const STEPS = [
  { id: 'product', label: 'Loan Product' },
  { id: 'borrower', label: 'Borrower' },
  { id: 'loan', label: 'Loan Details' },
  { id: 'dealer', label: 'Dealer' },
  { id: 'support-person', label: 'Co-applicant / Guarantor' },
  { id: 'geo-photos', label: 'Geo-tagged Photos' },
  { id: 'insurance', label: 'Insurance' },
  { id: 'vehicle', label: 'Vehicle Details' },
];

describe('B2cEvWizardStepper', () => {
  it('color-codes Request DO (geo-photos) with purple and stages 7–8 with green', () => {
    render(
      <B2cEvWizardStepper
        steps={STEPS}
        currentStep={5}
        completedSteps={[0, 1, 2, 3, 4]}
        lockedSteps={[6, 7]}
        onStepClick={vi.fn()}
      />
    );

    expect(screen.getByTestId('b2c-stepper-step-geo-photos')).toHaveAttribute(
      'data-step-accent',
      'purple'
    );
    expect(screen.getByTestId('b2c-stepper-step-insurance')).toHaveAttribute(
      'data-step-accent',
      'green'
    );
    expect(screen.getByTestId('b2c-stepper-step-vehicle')).toHaveAttribute(
      'data-step-accent',
      'green'
    );
    expect(screen.getByTestId('b2c-stepper-step-product')).toHaveAttribute(
      'data-step-accent',
      'default'
    );
  });

  it('greys out locked insurance and vehicle steps', () => {
    render(
      <B2cEvWizardStepper
        steps={STEPS}
        currentStep={5}
        completedSteps={[0, 1, 2, 3, 4]}
        lockedSteps={[6, 7]}
        onStepClick={vi.fn()}
      />
    );

    expect(screen.getByTestId('b2c-stepper-step-insurance')).toBeDisabled();
    expect(screen.getByTestId('b2c-stepper-step-vehicle')).toBeDisabled();
    expect(screen.getByTestId('b2c-stepper-step-geo-photos')).not.toBeDisabled();
  });
});
