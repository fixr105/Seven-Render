import React from 'react';
import {
  buildLoanMathBreakdown,
  computeGstComponent,
  roundRupee,
  type LoanFrozenValues,
} from '../../lib/loanCalculator';

function formatRupee(value: number): string {
  return `₹${value.toLocaleString('en-IN')}`;
}

function formatGstRateLabel(gstRate: number): string {
  return gstRate === 0.18 ? '18%' : '5%';
}

interface InvoiceLineProps {
  label: string;
  amount: number;
  detail?: string;
  testId?: string;
  tone?: 'default' | 'deduction' | 'total' | 'subtotal';
}

const InvoiceLine: React.FC<InvoiceLineProps> = ({
  label,
  amount,
  detail,
  testId,
  tone = 'default',
}) => {
  const amountClass =
    tone === 'deduction'
      ? 'text-rose-700'
      : tone === 'total'
        ? 'text-neutral-900'
        : tone === 'subtotal'
          ? 'text-neutral-800'
          : 'text-neutral-900';

  return (
    <tr className={tone === 'total' ? 'border-t-2 border-neutral-900' : undefined}>
      <td className="py-2.5 pr-4 align-top">
        <p
          className={
            tone === 'total'
              ? 'text-sm font-semibold uppercase tracking-wide text-neutral-900'
              : 'text-sm text-neutral-700'
          }
        >
          {label}
        </p>
        {detail ? (
          <p className="mt-0.5 text-xs text-neutral-500" data-testid={testId ? `${testId}-detail` : undefined}>
            {detail}
          </p>
        ) : null}
      </td>
      <td
        className={`py-2.5 text-right align-top text-sm tabular-nums ${tone === 'total' ? 'font-bold' : 'font-medium'} ${amountClass}`}
        data-testid={testId}
      >
        {tone === 'deduction' ? `(${formatRupee(amount)})` : formatRupee(amount)}
      </td>
    </tr>
  );
};

interface LoanDraftInvoiceBreakdownProps {
  frozen: LoanFrozenValues;
  scenarioLabel?: string;
  testIdPrefix?: string;
  referenceCode?: string;
  sampleSubtitle?: string;
}

export const LoanDraftInvoiceBreakdown: React.FC<LoanDraftInvoiceBreakdownProps> = ({
  frozen,
  scenarioLabel,
  testIdPrefix = 'loan-form-math',
  referenceCode = 'B2C-EV-LOAN',
  sampleSubtitle = 'Sample for loan application',
}) => {
  const mathBreakdown = buildLoanMathBreakdown(frozen);
  const iotWithGst = computeGstComponent(frozen.gpsCharges);
  const vehiclePriceWithGst = roundRupee(frozen.vehiclePrice * (1 + frozen.gstRate));
  const vehicleGstAmount = roundRupee(vehiclePriceWithGst - frozen.vehiclePrice);
  const assumedDisbursement = mathBreakdown.assumedDisbursement;
  const invoiceDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div
      className="overflow-hidden rounded-lg border border-neutral-300 bg-white shadow-sm"
      data-testid={`${testIdPrefix}-breakdown`}
    >
      <div className="border-b border-dashed border-neutral-300 bg-neutral-50 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
              Seven Fincorp
            </p>
            <h4 className="mt-1 font-serif text-xl font-semibold tracking-tight text-neutral-900">
              Value Breakup
            </h4>
            <p className="mt-1 text-xs text-neutral-500">
              {sampleSubtitle} · {invoiceDate}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {scenarioLabel ? (
              <span className="rounded border border-brand-primary/30 bg-brand-primary/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-primary">
                {scenarioLabel}
              </span>
            ) : null}
            <span className="rounded border border-amber-300 bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-800">
              Draft
            </span>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
          <span>Tenure: {frozen.tenureMonths} months</span>
          <span>Vehicle GST: {formatGstRateLabel(frozen.gstRate)}</span>
          <span>Ref: {referenceCode}</span>
        </div>
      </div>

      <div className="px-5 py-4">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-neutral-200">
              <th className="pb-2 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                Description
              </th>
              <th className="pb-2 text-right text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                Amount
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            <InvoiceLine label="Vehicle price (excl. GST)" amount={frozen.vehiclePrice} />
            <InvoiceLine
              label={`GST on vehicle (${formatGstRateLabel(frozen.gstRate)})`}
              amount={vehicleGstAmount}
            />
            <InvoiceLine
              label={`IOT / GPS (${frozen.tenureMonths} months, incl. GST)`}
              amount={iotWithGst.inclusiveAmount}
              detail={`Base ${formatRupee(iotWithGst.baseAmount)} + GST ${formatRupee(iotWithGst.gstAmount)}`}
              testId={`${testIdPrefix}-iot`}
            />
            <span className="sr-only" data-testid={`${testIdPrefix}-iot-gst`}>
              Base {formatRupee(iotWithGst.baseAmount)} + GST {formatRupee(iotWithGst.gstAmount)}
            </span>
            {frozen.insurance > 0 ? (
              <InvoiceLine label="Insurance" amount={frozen.insurance} />
            ) : null}
            {frozen.registration > 0 ? (
              <InvoiceLine label="Registration" amount={frozen.registration} />
            ) : null}
            {frozen.accessories > 0 ? (
              <InvoiceLine label="Accessories" amount={frozen.accessories} />
            ) : null}
            <InvoiceLine
              label="Tax invoice value"
              amount={mathBreakdown.taxInvoiceValue}
              tone="total"
              testId={`${testIdPrefix}-tax-invoice`}
            />
            {frozen.customerPayment > 0 ? (
              <InvoiceLine
                label="Less: Payment from customer"
                amount={frozen.customerPayment}
                tone="deduction"
              />
            ) : null}
            <InvoiceLine
              label="Assumed disbursement"
              amount={assumedDisbursement}
              tone="subtotal"
            />
          </tbody>
        </table>
      </div>

      <div className="border-t border-dashed border-neutral-300 bg-[#faf9f6] px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          Loan financing summary
        </p>
        <table className="mt-3 w-full border-collapse">
          <tbody className="divide-y divide-neutral-200/80">
            <InvoiceLine label="Loan amount" amount={mathBreakdown.loanAmount} />
            <InvoiceLine label="Processing fee" amount={mathBreakdown.processingFee} />
            <InvoiceLine
              label="Net disbursal to dealer"
              amount={mathBreakdown.disbursalAmount}
              tone="subtotal"
            />
          </tbody>
        </table>
        <div className="mt-4 border-t border-neutral-300 pt-3">
          <p className="text-xs text-neutral-500">Loan amount composition</p>
          <p
            className="mt-1 font-mono text-sm font-semibold text-neutral-900"
            data-testid={`${testIdPrefix}-equation`}
          >
            {formatRupee(mathBreakdown.loanAmount)} = {formatRupee(mathBreakdown.disbursalAmount)} +{' '}
            {formatRupee(mathBreakdown.processingFee)}
          </p>
          <p className="mt-1 text-xs text-neutral-600">Net disbursal to dealer + Processing fee</p>
        </div>
        <div className="mt-4 flex items-end justify-between gap-4 border-t border-neutral-300 pt-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">EMI</p>
            <p className="mt-0.5 text-xs text-neutral-600">Monthly instalment · {frozen.tenureMonths} months</p>
          </div>
          <p className="text-lg font-semibold tabular-nums text-neutral-900" data-testid={`${testIdPrefix}-emi`}>
            {formatRupee(mathBreakdown.emiAmount)}
            <span className="text-sm font-normal text-neutral-600">/mo</span>
          </p>
        </div>
      </div>

      <div className="border-t border-neutral-200 bg-neutral-50 px-5 py-2.5 text-center text-[10px] uppercase tracking-widest text-neutral-400">
        Not a tax invoice · For application reference only
      </div>
    </div>
  );
};
