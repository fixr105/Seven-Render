import React, { useEffect, useMemo, useState } from 'react';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import {
  buildLoanMathBreakdown,
  calculateLoanPreview,
  computeGstComponent,
  freezeLoanPreview,
  parseMoneyInput,
  type LoanCalculatorSnapshot,
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
  onFreeze: (values: LoanFrozenValues, snapshot: LoanCalculatorSnapshot) => void;
  onUnfreeze: () => void;
}

const LoanCalculatorStage1: React.FC<LoanCalculatorStage1Props> = ({
  frozenValues,
  onFreeze,
  onUnfreeze,
}) => {
  const isFrozen = frozenValues != null;
  const [downpayment, setDownpayment] = useState('');
  const [disbursementToDealer, setDisbursementToDealer] = useState('');
  const [tenureMonths, setTenureMonths] = useState<LoanTenureMonths>(
    frozenValues?.tenureMonths ?? 12
  );

  useEffect(() => {
    if (frozenValues?.tenureMonths) {
      setTenureMonths(frozenValues.tenureMonths);
    }
  }, [frozenValues?.tenureMonths]);

  const inputs = useMemo(
    () => ({
      upfrontPayment: parseMoneyInput(downpayment),
      disbursementToDealer: parseMoneyInput(disbursementToDealer),
      tenureMonths,
    }),
    [downpayment, disbursementToDealer, tenureMonths]
  );

  const preview = useMemo(() => calculateLoanPreview(inputs), [inputs]);
  const iotWithGst = useMemo(() => computeGstComponent(preview.gpsCharges), [preview.gpsCharges]);

  const handleFreeze = () => {
    onFreeze(freezeLoanPreview(preview), {
      downpayment: inputs.upfrontPayment,
      disbursementToDealer: inputs.disbursementToDealer,
      invoiceValue: preview.invoiceValue,
      emiAmount: preview.emiAmount,
    });
  };

  const invoiceDisplay =
    preview.invoiceValue > 0 ? String(preview.invoiceValue) : '';

  return (
    <div className="space-y-6" data-testid="loan-calculator-stage1">
      <div>
        <h3 className="text-sm font-semibold text-neutral-900">Loan calculator</h3>
        <p className="mt-1 text-sm text-neutral-600">
          Enter payment from customer and disbursement to dealer. Invoice value is computed automatically.
          Values update live. Freeze to lock them into the application form below.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input
          label="Payment from Customer (₹)"
          type="text"
          inputMode="decimal"
          value={downpayment}
          disabled={isFrozen}
          onChange={(e) => setDownpayment(e.target.value)}
          data-testid="loan-calc-downpayment"
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
        <Input
          label="Invoice Value (₹)"
          type="text"
          value={invoiceDisplay}
          readOnly
          disabled
          data-testid="loan-calc-invoice"
          className="bg-neutral-100 text-neutral-700"
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
  const mathBreakdown = hasFrozen ? buildLoanMathBreakdown(frozenValues) : null;
  const iotWithGst = hasFrozen ? computeGstComponent(frozenValues.gpsCharges) : null;

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

      {mathBreakdown && (
        <div
          className="rounded-xl border border-neutral-200 bg-neutral-50 p-4"
          data-testid="loan-form-math-breakdown"
        >
          <h4 className="mb-3 text-sm font-semibold text-neutral-900">Calculation breakdown</h4>
          <dl className="space-y-2 text-sm text-neutral-700">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <dt>IOT/GPS charges ({mathBreakdown.tenureMonths} months, including GST)</dt>
              <dd className="font-medium text-neutral-900" data-testid="loan-form-math-iot">
                {formatRupee(iotWithGst?.inclusiveAmount ?? mathBreakdown.gpsCharges)}
              </dd>
              <dd className="text-xs text-neutral-500" data-testid="loan-form-math-iot-gst">
                Base {formatRupee(iotWithGst?.baseAmount ?? mathBreakdown.gpsCharges)} + GST{' '}
                {formatRupee(iotWithGst?.gstAmount ?? 0)}
              </dd>
            </div>
            <div className="border-t border-neutral-200 pt-2">
              <p className="text-xs text-neutral-500">Loan amount composition</p>
              <p className="mt-1 font-medium text-neutral-900" data-testid="loan-form-math-equation">
                {formatRupee(mathBreakdown.loanAmount)} = {formatRupee(mathBreakdown.disbursalAmount)}{' '}
                + {formatRupee(mathBreakdown.processingFee)} + {formatRupee(mathBreakdown.gpsCharges)}
              </p>
              <p className="mt-1 text-xs text-neutral-600">
                Disbursal to dealer + Processing fee (8%) + IOT/GPS
              </p>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-neutral-200 pt-2">
              <dt>EMI @ 35% p.a.</dt>
              <dd className="font-medium text-neutral-900" data-testid="loan-form-math-emi">
                {formatRupee(mathBreakdown.emiAmount)}/month for {mathBreakdown.tenureMonths} months
              </dd>
            </div>
          </dl>
        </div>
      )}
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
      <p
        className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        data-testid="loan-extra-costs-disclaimer"
      >
        Insurance and vehicle registration costs are extra and are not included in the loan amount
        shown in this calculator.
      </p>
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
