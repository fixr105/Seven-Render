import React, { useEffect, useMemo, useState } from 'react';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import {
  calculateB2cLoanPreview,
  computeGstComponent,
  freezeB2cLoanPreview,
  parseGstRateInput,
  parseMoneyInput,
  validateCustomerPaymentForFreeze,
  type LoanCalculatorSnapshot,
  type LoanFrozenValues,
  type LoanTenureMonths,
  type VehicleGstRate,
} from '../../lib/loanCalculator';
import { LoanDraftInvoiceBreakdown } from './LoanDraftInvoiceBreakdown';

const TENURE_OPTIONS = [
  { value: '12', label: '12 months' },
  { value: '18', label: '18 months' },
];

const GST_RATE_OPTIONS_UI = [
  { value: '0.05', label: '5%' },
  { value: '0.18', label: '18%' },
];

const EMPTY_PLACEHOLDER = 'Freeze values in calculator first.';

function formatRupee(value: number): string {
  return `₹${value.toLocaleString('en-IN')}`;
}

function displayMoney(value: number): string {
  return value > 0 ? String(value) : '';
}

interface LoanCalculatorStage1Props {
  frozenValues: LoanFrozenValues | null;
  onFreeze: (values: LoanFrozenValues, snapshot: LoanCalculatorSnapshot) => void;
  onUnfreeze: () => void;
}

const LoanCalculatorStage1: React.FC<LoanCalculatorStage1Props> = ({
  frozenValues,
  onFreeze,
  onUnfreeze,
}) => {
  const isFrozen = frozenValues != null;
  const [vehiclePrice, setVehiclePrice] = useState('');
  const [gstRate, setGstRate] = useState<VehicleGstRate>(0.05);
  const [insurance, setInsurance] = useState('');
  const [registration, setRegistration] = useState('');
  const [accessories, setAccessories] = useState('');
  const [customerPayment, setCustomerPayment] = useState('');
  const [tenureMonths, setTenureMonths] = useState<LoanTenureMonths>(
    frozenValues?.tenureMonths ?? 12
  );

  useEffect(() => {
    if (!frozenValues) return;
    setVehiclePrice(displayMoney(frozenValues.vehiclePrice));
    setGstRate(frozenValues.gstRate);
    setInsurance(displayMoney(frozenValues.insurance));
    setRegistration(displayMoney(frozenValues.registration));
    setAccessories(displayMoney(frozenValues.accessories));
    setCustomerPayment(displayMoney(frozenValues.customerPayment));
    setTenureMonths(frozenValues.tenureMonths);
  }, [frozenValues]);

  const inputs = useMemo(
    () => ({
      vehiclePrice: parseMoneyInput(vehiclePrice),
      gstRate,
      insurance: parseMoneyInput(insurance),
      registration: parseMoneyInput(registration),
      accessories: parseMoneyInput(accessories),
      customerPayment: parseMoneyInput(customerPayment),
      tenureMonths,
    }),
    [vehiclePrice, gstRate, insurance, registration, accessories, customerPayment, tenureMonths]
  );

  const preview = useMemo(() => calculateB2cLoanPreview(inputs), [inputs]);
  const iotWithGst = useMemo(() => computeGstComponent(preview.gpsCharges), [preview.gpsCharges]);
  const customerPaymentValidation = useMemo(
    () => validateCustomerPaymentForFreeze(inputs.customerPayment, preview.taxInvoiceValue),
    [inputs.customerPayment, preview.taxInvoiceValue]
  );
  const showCustomerPaymentWarning =
    !isFrozen &&
    preview.taxInvoiceValue > 0 &&
    inputs.customerPayment > 0 &&
    !customerPaymentValidation.valid;
  const canFreeze =
    preview.loanAmount > 0 && customerPaymentValidation.valid;

  const handleFreeze = () => {
    if (!canFreeze) return;
    onFreeze(freezeB2cLoanPreview(preview), {
      vehiclePrice: inputs.vehiclePrice,
      gstRate: inputs.gstRate,
      insurance: inputs.insurance,
      registration: inputs.registration,
      accessories: inputs.accessories,
      customerPayment: inputs.customerPayment,
      taxInvoiceValue: preview.taxInvoiceValue,
      emiAmount: preview.emiAmount,
    });
  };

  const taxInvoiceDisplay =
    preview.taxInvoiceValue > 0 ? String(preview.taxInvoiceValue) : '';

  return (
    <div className="space-y-6" data-testid="loan-calculator-stage1">
      <div>
        <h3 className="text-sm font-semibold text-neutral-900">Loan calculator</h3>
        <p className="mt-1 text-sm text-neutral-600">
          Enter vehicle price, GST rate, add-on costs, and payment from customer. Tax invoice value
          is computed automatically. Values update live. Freeze to lock them into the application
          form below.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input
          label="Vehicle Price (₹)"
          type="text"
          inputMode="decimal"
          value={vehiclePrice}
          disabled={isFrozen}
          onChange={(e) => setVehiclePrice(e.target.value)}
          data-testid="loan-calc-vehicle-price"
        />
        <Select
          label="GST Rate"
          value={String(gstRate)}
          disabled={isFrozen}
          options={GST_RATE_OPTIONS_UI}
          onChange={(e) => setGstRate(parseGstRateInput(e.target.value))}
          data-testid="loan-calc-gst-rate"
        />
        <Input
          label="Insurance (₹)"
          type="text"
          inputMode="decimal"
          value={insurance}
          disabled={isFrozen}
          onChange={(e) => setInsurance(e.target.value)}
          data-testid="loan-calc-insurance"
        />
        <Input
          label="Registration (₹)"
          type="text"
          inputMode="decimal"
          value={registration}
          disabled={isFrozen}
          onChange={(e) => setRegistration(e.target.value)}
          data-testid="loan-calc-registration"
        />
        <Input
          label="Accessories (₹)"
          type="text"
          inputMode="decimal"
          value={accessories}
          disabled={isFrozen}
          onChange={(e) => setAccessories(e.target.value)}
          data-testid="loan-calc-accessories"
        />
        <Input
          label="Payment from Customer (₹)"
          type="text"
          inputMode="decimal"
          value={customerPayment}
          disabled={isFrozen}
          onChange={(e) => setCustomerPayment(e.target.value)}
          error={showCustomerPaymentWarning ? customerPaymentValidation.message : undefined}
          data-testid="loan-calc-customer-payment"
        />
        <Input
          label="Tax Invoice Value (₹)"
          type="text"
          value={taxInvoiceDisplay}
          readOnly
          disabled
          data-testid="loan-calc-tax-invoice"
          className="bg-neutral-100 text-neutral-700"
        />
        <Select
          label="Tenure"
          value={String(tenureMonths)}
          disabled={isFrozen}
          options={TENURE_OPTIONS}
          onChange={(e) => setTenureMonths(e.target.value === '18' ? 18 : 12)}
          data-testid="loan-calc-tenure"
        />
      </div>

      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
        <h4 className="mb-3 text-sm font-semibold text-neutral-900">Live preview</h4>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-neutral-500">Loan Amount</dt>
            <dd className="text-sm font-medium text-neutral-900" data-testid="loan-calc-preview-amount">
              {formatRupee(preview.loanAmount)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Tenure</dt>
            <dd className="text-sm font-medium text-neutral-900" data-testid="loan-calc-preview-tenure">
              {preview.tenureMonths} months
            </dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">GPS/IOT (including GST)</dt>
            <dd className="text-sm font-medium text-neutral-900" data-testid="loan-calc-preview-gps">
              {formatRupee(iotWithGst.inclusiveAmount)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">EMI Amount</dt>
            <dd className="text-sm font-medium text-neutral-900" data-testid="loan-calc-preview-emi">
              {formatRupee(preview.emiAmount)}
            </dd>
          </div>
        </dl>
      </div>

      {showCustomerPaymentWarning ? (
        <p
          className="rounded-lg border border-error/30 bg-error/5 px-4 py-3 text-sm text-error"
          data-testid="loan-calc-customer-payment-error"
          role="alert"
        >
          {customerPaymentValidation.message}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {!isFrozen ? (
          <Button
            type="button"
            onClick={handleFreeze}
            disabled={!canFreeze}
            data-testid="loan-calc-freeze"
          >
            Freeze Values
          </Button>
        ) : (
          <Button
            type="button"
            variant="secondary"
            onClick={onUnfreeze}
            data-testid="loan-calc-edit"
          >
            Edit
          </Button>
        )}
        {isFrozen && (
          <p className="self-center text-sm text-success">Values frozen for the application form.</p>
        )}
      </div>
    </div>
  );
};

interface LoanCalculatorStage2Props {
  frozenValues: LoanFrozenValues | null;
}

const LoanCalculatorStage2: React.FC<LoanCalculatorStage2Props> = ({ frozenValues }) => {
  const hasFrozen = frozenValues != null;
  const placeholder = hasFrozen ? undefined : EMPTY_PLACEHOLDER;

  const fields: Array<{ label: string; value: string; testId: string; required?: boolean }> = [
    {
      label: 'Loan Amount (₹)',
      value: hasFrozen ? String(frozenValues.loanAmount) : '',
      testId: 'loan-form-amount',
      required: true,
    },
    {
      label: 'Tenure (months)',
      value: hasFrozen ? String(frozenValues.tenureMonths) : '',
      testId: 'loan-form-tenure',
      required: true,
    },
    {
      label: 'Processing Fee (₹)',
      value: hasFrozen ? String(frozenValues.processingFee) : '',
      testId: 'loan-form-processing-fee',
      required: true,
    },
    {
      label: 'GPS Charges / IOT (₹, including GST)',
      value: hasFrozen ? String(frozenValues.gpsCharges) : '',
      testId: 'loan-form-gps',
      required: true,
    },
    {
      label: 'Disbursal Amount (₹)',
      value: hasFrozen ? String(frozenValues.disbursalAmount) : '',
      testId: 'loan-form-disbursal',
    },
  ];

  return (
    <div className="space-y-4" data-testid="loan-calculator-stage2">
      <div>
        <h3 className="text-sm font-semibold text-neutral-900">Loan application form</h3>
        <p className="mt-1 text-sm text-neutral-600">
          These fields are read-only and filled only from frozen calculator values.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {fields.map((field) => (
          <Input
            key={field.testId}
            label={field.label}
            required={field.required}
            value={field.value}
            placeholder={placeholder}
            readOnly
            disabled
            data-testid={field.testId}
            className={!hasFrozen ? 'bg-neutral-100 text-neutral-400' : undefined}
          />
        ))}
      </div>

      {hasFrozen && frozenValues ? <LoanDraftInvoiceBreakdown frozen={frozenValues} /> : null}
    </div>
  );
};

export interface LoanCalculatorProps {
  frozenValues: LoanFrozenValues | null;
  onFrozenValuesChange: (
    values: LoanFrozenValues | null,
    snapshot?: LoanCalculatorSnapshot
  ) => void;
}

/**
 * Parent holding frozen loan values. Stage 1 (calculator) freezes a snapshot;
 * Stage 2 (application form) is read-only and only shows that snapshot.
 */
export const LoanCalculator: React.FC<LoanCalculatorProps> = ({
  frozenValues,
  onFrozenValuesChange,
}) => {
  return (
    <div className="space-y-8" data-testid="loan-calculator">
      <LoanCalculatorStage1
        frozenValues={frozenValues}
        onFreeze={(values, snapshot) => onFrozenValuesChange(values, snapshot)}
        onUnfreeze={() => onFrozenValuesChange(null)}
      />
      <div className="border-t border-neutral-200 pt-8">
        <LoanCalculatorStage2 frozenValues={frozenValues} />
      </div>
    </div>
  );
};
