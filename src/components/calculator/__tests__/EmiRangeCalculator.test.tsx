import { describe, it, expect } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '../../../i18n';
import { EmiRangeCalculator } from '../EmiRangeCalculator';
import { quoteCalculatorForScore } from '../../../lib/calculatorScoreQuote';
import { PRICING_UNAVAILABLE_MESSAGE, type LenderBreRow } from '../../../lib/lenderBrePricing';
import { computeGstComponent, type B2cLoanCalculatorInputs } from '../../../lib/loanCalculator';
import type { CalculatorQuoteContext } from '../../../lib/loadCalculatorQuoteContext';

function formatRupee(value: number): string {
  return `₹${value.toLocaleString('en-IN')}`;
}

const FINTREE_BANDS: LenderBreRow[] = [
  {
    ruleId: 2,
    nbfcPartner: 'Fintree',
    minCibil: 650,
    maxCibil: 700,
    eligible: true,
    roi: 32,
    pf: 8,
    active: true,
    loanProduct: '',
  },
  {
    ruleId: 5,
    nbfcPartner: 'Fintree',
    minCibil: 701,
    maxCibil: 750,
    eligible: true,
    roi: 30,
    pf: 7,
    active: true,
    loanProduct: '',
  },
  {
    ruleId: 7,
    nbfcPartner: 'Fintree',
    minCibil: 776,
    maxCibil: 900,
    eligible: true,
    roi: 28,
    pf: 6.75,
    active: true,
    loanProduct: '',
  },
  {
    ruleId: 11,
    nbfcPartner: 'Fintree',
    minCibil: 776,
    maxCibil: 900,
    eligible: true,
    roi: 22,
    pf: 6,
    active: true,
    loanProduct: 'LP016',
  },
];

const SAMPLE_INPUTS: B2cLoanCalculatorInputs = {
  vehiclePrice: 100000,
  gstRate: 0.05,
  insurance: 2000,
  registration: 1000,
  accessories: 1000,
  customerPayment: 20000,
  tenureMonths: 12,
};

function context(overrides: Partial<CalculatorQuoteContext> = {}): CalculatorQuoteContext {
  return {
    lenderName: 'Fintree',
    rows: FINTREE_BANDS,
    products: [{ id: 'LP012', name: 'Two wheeler' }],
    tenureMonths: [12, 18],
    error: null,
    ...overrides,
  };
}

async function renderCalculator(next: CalculatorQuoteContext = context()) {
  let view!: ReturnType<typeof render>;
  await act(async () => {
    view = render(<EmiRangeCalculator loadContext={async () => next} />);
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  return view;
}

async function setScore(user: ReturnType<typeof userEvent.setup>, score: string) {
  const input = screen.getByTestId('emi-range-score-input');
  await user.clear(input);
  await user.type(input, score);
}

describe('EmiRangeCalculator', () => {
  it('prices the default score from the lender band and reprices 807 versus 700', async () => {
    const user = userEvent.setup();
    await renderCalculator();

    await user.type(screen.getByTestId('emi-range-vehicle-price'), '100000');
    await user.type(screen.getByTestId('emi-range-insurance'), '2000');
    await user.type(screen.getByTestId('emi-range-registration'), '1000');
    await user.type(screen.getByTestId('emi-range-accessories'), '1000');
    await user.type(screen.getByTestId('emi-range-customer-payment'), '20000');

    const at750 = quoteCalculatorForScore(SAMPLE_INPUTS, FINTREE_BANDS, 750, 'Fintree', 'LP012');
    expect(at750.status).toBe('ok');
    if (at750.status !== 'ok') return;

    expect(screen.getByTestId('emi-range-tax-invoice')).toHaveValue('111000');
    expect(await screen.findByTestId('emi-score-scenario-emi')).toHaveTextContent(
      formatRupee(at750.preview.emiAmount)
    );
    expect(screen.getByTestId('emi-score-band')).toHaveTextContent('701–750');
    expect(screen.getByTestId('emi-score-band')).toHaveTextContent('30%');
    expect(screen.getByTestId('emi-score-band')).toHaveTextContent('7%');
    expect(screen.queryByTestId('emi-range-low-loan-scenario')).not.toBeInTheDocument();
    expect(screen.queryByTestId('emi-range-high-loan-scenario')).not.toBeInTheDocument();

    await setScore(user, '807');
    const at807 = quoteCalculatorForScore(SAMPLE_INPUTS, FINTREE_BANDS, 807, 'Fintree', 'LP012');
    if (at807.status !== 'ok') throw new Error('expected 807 quote');
    expect(screen.getByTestId('emi-score-band')).toHaveTextContent('776–900');
    expect(screen.getByTestId('emi-score-band')).toHaveTextContent('28%');
    expect(screen.getByTestId('emi-score-band')).toHaveTextContent('6.75%');
    expect(screen.getByTestId('emi-score-scenario-emi')).toHaveTextContent(formatRupee(at807.preview.emiAmount));
    expect(screen.getByTestId('emi-score-scenario-processing-fee')).toHaveTextContent(
      formatRupee(at807.preview.processingFee)
    );
    expect(at807.preview.processingFee).toBe(Math.round(at807.preview.loanAmount * 0.0675));

    await setScore(user, '700');
    const at700 = quoteCalculatorForScore(SAMPLE_INPUTS, FINTREE_BANDS, 700, 'Fintree', 'LP012');
    if (at700.status !== 'ok') throw new Error('expected 700 quote');
    expect(screen.getByTestId('emi-score-band')).toHaveTextContent('32%');
    expect(screen.getByTestId('emi-score-scenario-emi')).toHaveTextContent(formatRupee(at700.preview.emiAmount));
    expect(at807.preview.emiAmount).toBeLessThan(at700.preview.emiAmount);
  });

  it('shows the unavailable message when no band covers the score', async () => {
    const user = userEvent.setup();
    await renderCalculator();
    await setScore(user, '300');
    expect(await screen.findByTestId('emi-range-quote-message')).toHaveTextContent(PRICING_UNAVAILABLE_MESSAGE);
    expect(screen.queryByTestId('emi-score-scenario-emi')).not.toBeInTheDocument();
  });

  it('uses a product-specific band when several products are offered', async () => {
    const user = userEvent.setup();
    await renderCalculator(
      context({
        products: [
          { id: 'LP012', name: 'Two wheeler' },
          { id: 'LP016', name: 'Cargo' },
        ],
      })
    );

    await user.type(screen.getByTestId('emi-range-vehicle-price'), '100000');
    await user.type(screen.getByTestId('emi-range-customer-payment'), '20000');
    await setScore(user, '807');

    const general = quoteCalculatorForScore(
      { ...SAMPLE_INPUTS, insurance: 0, registration: 0, accessories: 0 },
      FINTREE_BANDS,
      807,
      'Fintree',
      'LP012'
    );
    const specific = quoteCalculatorForScore(
      { ...SAMPLE_INPUTS, insurance: 0, registration: 0, accessories: 0 },
      FINTREE_BANDS,
      807,
      'Fintree',
      'LP016'
    );
    if (general.status !== 'ok' || specific.status !== 'ok') throw new Error('expected quotes');

    expect(await screen.findByTestId('emi-score-scenario-emi')).toHaveTextContent(
      formatRupee(general.preview.emiAmount)
    );
    await user.selectOptions(screen.getByTestId('emi-range-product'), 'LP016');
    expect(screen.getByTestId('emi-score-band')).toHaveTextContent('22%');
    expect(screen.getByTestId('emi-score-scenario-emi')).toHaveTextContent(
      formatRupee(specific.preview.emiAmount)
    );
  });

  it('updates the score quote when tenure changes between 12 and 18 months', async () => {
    const user = userEvent.setup();
    await renderCalculator();

    await user.type(screen.getByTestId('emi-range-vehicle-price'), '100000');
    await user.type(screen.getByTestId('emi-range-customer-payment'), '20000');

    const inputs12: B2cLoanCalculatorInputs = {
      vehiclePrice: 100000,
      gstRate: 0.05,
      insurance: 0,
      registration: 0,
      accessories: 0,
      customerPayment: 20000,
      tenureMonths: 12,
    };
    const inputs18: B2cLoanCalculatorInputs = { ...inputs12, tenureMonths: 18 };
    const range12 = quoteCalculatorForScore(inputs12, FINTREE_BANDS, 750, 'Fintree', 'LP012');
    const range18 = quoteCalculatorForScore(inputs18, FINTREE_BANDS, 750, 'Fintree', 'LP012');
    if (range12.status !== 'ok' || range18.status !== 'ok') throw new Error('expected quotes');

    expect(await screen.findByTestId('emi-score-scenario-emi')).toHaveTextContent(
      formatRupee(range12.preview.emiAmount)
    );
    expect(screen.getByTestId('emi-range-tenure-preview')).toHaveTextContent('12 months');

    await user.selectOptions(screen.getByTestId('emi-range-tenure'), '18');

    expect(screen.getByTestId('emi-score-scenario-emi')).toHaveTextContent(formatRupee(range18.preview.emiAmount));
    expect(screen.getByTestId('emi-range-tenure-preview')).toHaveTextContent('18 months');
    expect(screen.getByTestId('emi-score-scenario-iot-cost')).toHaveTextContent(
      formatRupee(computeGstComponent(range18.preview.gpsCharges).inclusiveAmount)
    );
  });

  it('does not show percentage fields or freeze controls', async () => {
    await renderCalculator();
    expect(await screen.findByTestId('emi-range-score')).toBeInTheDocument();
    expect(screen.queryByText(/^Processing Fee %$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Interest Rate/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('loan-calc-freeze')).not.toBeInTheDocument();
  });

  it('shows one draft breakup when customer payment meets the 10% minimum', async () => {
    const user = userEvent.setup();
    await renderCalculator();

    await user.type(screen.getByTestId('emi-range-vehicle-price'), '100000');
    await user.type(screen.getByTestId('emi-range-insurance'), '2000');
    await user.type(screen.getByTestId('emi-range-registration'), '1000');
    await user.type(screen.getByTestId('emi-range-accessories'), '1000');
    await user.type(screen.getByTestId('emi-range-customer-payment'), '20000');

    expect(await screen.findByTestId('emi-range-calculator-stage2')).toBeInTheDocument();
    expect(screen.getByTestId('emi-score-breakdown')).toBeInTheDocument();
    expect(screen.queryByTestId('emi-range-low-breakdown')).not.toBeInTheDocument();
    expect(screen.queryByTestId('emi-range-high-breakdown')).not.toBeInTheDocument();
    expect(screen.getByTestId('emi-score-tax-invoice')).toHaveTextContent('₹1,11,000');
  });

  it('does not show a customer payment warning before a payment amount is entered', async () => {
    const user = userEvent.setup();
    await renderCalculator();

    await user.type(screen.getByTestId('emi-range-vehicle-price'), '100000');

    expect(screen.queryByTestId('emi-range-customer-payment-error')).not.toBeInTheDocument();
  });

  it('warns when customer payment is below 10% of tax invoice value', async () => {
    const user = userEvent.setup();
    await renderCalculator();

    await user.type(screen.getByTestId('emi-range-vehicle-price'), '100000');
    await user.type(screen.getByTestId('emi-range-customer-payment'), '5000');

    expect(await screen.findByTestId('emi-range-customer-payment-error')).toBeInTheDocument();
    expect(screen.queryByTestId('emi-range-calculator-stage2')).not.toBeInTheDocument();
  });

  it('lists tenure options from the lender tenure_months field', async () => {
    await renderCalculator(context({ tenureMonths: [12, 18, 24] }));
    const tenureSelect = (await screen.findByTestId('emi-range-tenure')) as HTMLSelectElement;
    const optionValues = Array.from(tenureSelect.options).map((option) => option.value);
    expect(optionValues).toEqual(['12', '18', '24']);
  });

  it('shows the lender error and no EMI when rules cannot be loaded', async () => {
    await renderCalculator(
      context({
        lenderName: null,
        rows: [],
        products: [],
        tenureMonths: [],
        error: PRICING_UNAVAILABLE_MESSAGE,
      })
    );
    expect(await screen.findByTestId('emi-range-quote-message')).toHaveTextContent(PRICING_UNAVAILABLE_MESSAGE);
    expect(screen.queryByTestId('emi-score-scenario-emi')).not.toBeInTheDocument();
  });
});
