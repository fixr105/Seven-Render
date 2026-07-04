import React, { useMemo, useState } from 'react';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import {
  calculateLoanPreview,
  freezeLoanPreview,
  isDisbursementOverBudget,
  parseMoneyInput,
  type LoanFrozenValues,
  type LoanTenureMonths,
} from '../../lib/loanCalculator';

const TENURE_OPTIONS = [
  { value: '12', label: '12 months' },
  { value: '18', label: '18 months' },
];

const EMPTY_PLACEHOLDER = 'Freeze values in calculator first.';

function formatRupee(value: number): string {
  return `₹${value.toLocaleString('en-IN')}`;
}

interface LoanCalculatorStage1Props {
  frozenValues: LoanFrozenValues | null;
  onFreeze: (values: LoanFrozenValues) => void;
  onUnfreeze: () => void;
}

const LoanCalculatorStage1: React.FC<LoanCalculatorStage1Props> = ({
  frozenValues,
  onFreeze,
  onUnfreeze,
}) => {
  const isFrozen = frozenValues != null;
  const [invoiceValue, setInvoiceValue] = useState('');
  const [upfrontPayment, setUpfrontPayment] = useState('');
  const [disbursementToDealer, setDisbursementToDealer] = useState('');
  const [tenureMonths, setTenureMonths] = useState<LoanTenureMonths>(12);

  const inputs = useMemo(
    () => ({
      invoiceValue: parseMoneyInput(invoiceValue),
      upfrontPayment: parseMoneyInput(upfrontPayment),
      disbursementToDealer: parseMoneyInput(disbursementToDealer),
      tenureMonths,
    }),
    [invoiceValue, upfrontPayment, disbursementToDealer, tenureMonths]
  );

  const preview = useMemo(() => calculateLoanPreview(inputs), [inputs]);
  const overBudget = isDisbursementOverBudget(inputs);

  const handleFreeze = () => {
    onFreeze(freezeLoanPreview(preview));
  };

  return (
    <div className="space-y-6" data-testid="loan-calculator-stage1">
      <div>
        <h3 className="text-sm font-semibold text-neutral-900">Loan calculator</h3>
        <p className="mt-1 text-sm text-neutral-600">
          Enter invoice and disbursement details. Values update live. Freeze to lock them into the
          application form below.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input
          label="Invoice Value (₹)"
          type="text"
          inputMode="decimal"
          value={invoiceValue}
          disabled={isFrozen}
          onChange={(e) => setInvoiceValue(e.target.value)}
          data-testid="loan-calc-invoice"
        />
        <Input
          label="Upfront Payment (₹)"
          type="text"
          inputMode="decimal"
          value={upfrontPayment}
          disabled={isFrozen}
          onChange={(e) => setUpfrontPayment(e.target.value)}
          data-testid="loan-calc-upfront"
        />
        <Input
          label="Disbursement to Dealer (₹)"
          type="text"
          inputMode="decimal"
          value={disbursementToDealer}
          disabled={isFrozen}
          onChange={(e) => setDisbursementToDealer(e.target.value)}
          data-testid="loan-calc-disbursement"
        />
        <Select
          label="Tenure"
          value={String(tenureMonths)}
          disabled={isFrozen}
          options={TENURE_OPTIONS}
          onChange={(e) =>
            setTenureMonths(e.target.value === '18' ? 18 : 12)
          }
          data-testid="loan-calc-tenure"
        />
      </div>

      {overBudget && !isFrozen && (
        <p
          className="rounded-lg border border-warning/40 bg-warning/5 px-3 py-2 text-sm text-neutral-800"
          data-testid="loan-calc-over-budget"
        >
          Disbursement to dealer exceeds invoice value minus upfront payment. You can still freeze,
          but please verify the amounts.
        </p>
      )}

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
            <dt className="text-xs text-neutral-500">Interest Rate</dt>
            <dd className="text-sm font-medium text-neutral-900">{preview.interestRate}%</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Tenure</dt>
            <dd className="text-sm font-medium text-neutral-900">{preview.tenureMonths} months</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Processing Fee ₹</dt>
            <dd className="text-sm font-medium text-neutral-900">
              {formatRupee(preview.processingFee)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">GPS/IOT ₹</dt>
            <dd className="text-sm font-medium text-neutral-900">
              {formatRupee(preview.gpsCharges)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Processing Fee %</dt>
            <dd className="text-sm font-medium text-neutral-900">
              {preview.processingFeePctDisplay}%
            </dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Disbursal Amount</dt>
            <dd className="text-sm font-medium text-neutral-900">
              {formatRupee(preview.disbursalAmount)}
            </dd>
          </div>
        </dl>
      </div>

      <div className="flex flex-wrap gap-2">
        {!isFrozen ? (
          <Button
            type="button"
            onClick={handleFreeze}
            disabled={preview.loanAmount <= 0}
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
      label: 'Interest Rate (%)',
      value: hasFrozen ? String(frozenValues.interestRate) : '',
      testId: 'loan-form-interest',
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
      label: 'GPS Charges / IOT (₹)',
      value: hasFrozen ? String(frozenValues.gpsCharges) : '',
      testId: 'loan-form-gps',
      required: true,
    },
    {
      label: 'Processing Fee %',
      value: hasFrozen ? String(frozenValues.processingFeePct) : '',
      testId: 'loan-form-processing-fee-pct',
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
    </div>
  );
};

export interface LoanCalculatorProps {
  frozenValues: LoanFrozenValues | null;
  onFrozenValuesChange: (values: LoanFrozenValues | null) => void;
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
        onFreeze={(values) => onFrozenValuesChange(values)}
        onUnfreeze={() => onFrozenValuesChange(null)}
      />
      <div className="border-t border-neutral-200 pt-8">
        <LoanCalculatorStage2 frozenValues={frozenValues} />
      </div>
    </div>
  );
};
