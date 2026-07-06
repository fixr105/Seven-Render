import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import {
  calculateLoanPreview,
  computeFinalInvoiceBreakdown,
  computeGstComponent,
  parseMoneyInput,
  type LoanTenureMonths,
} from '../../lib/loanCalculator';

const TENURE_OPTIONS = [
  { value: '12', label: '12 months' },
  { value: '18', label: '18 months' },
];

type Stage2Tab = 'insurance' | 'registration';

function formatRupee(value: number): string {
  return `₹${value.toLocaleString('en-IN')}`;
}

export const EmiRangeCalculator: React.FC = () => {
  const { t } = useTranslation();
  const [downpayment, setDownpayment] = useState('');
  const [disbursementToDealer, setDisbursementToDealer] = useState('');
  const [tenureMonths, setTenureMonths] = useState<LoanTenureMonths>(12);
  const [activeStage2Tab, setActiveStage2Tab] = useState<Stage2Tab>('insurance');
  const [insuranceCost, setInsuranceCost] = useState('');
  const [registrationCost, setRegistrationCost] = useState('');

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

  const insuranceAmount = parseMoneyInput(insuranceCost);
  const registrationAmount = parseMoneyInput(registrationCost);
  const finalInvoice = useMemo(
    () =>
      computeFinalInvoiceBreakdown(
        preview.invoiceValue,
        insuranceAmount,
        registrationAmount,
        preview.gpsCharges
      ),
    [preview.invoiceValue, preview.gpsCharges, insuranceAmount, registrationAmount]
  );

  const invoiceDisplay = preview.invoiceValue > 0 ? String(preview.invoiceValue) : '';

  const formatOptionalRupee = (value: number): string =>
    value > 0 ? formatRupee(value) : '—';

  const stage2Tabs: Array<{ id: Stage2Tab; label: string }> = [
    { id: 'insurance', label: t('pages.calculator.insuranceTab') },
    { id: 'registration', label: t('pages.calculator.registrationTab') },
  ];

  return (
    <div className="space-y-8" data-testid="emi-range-calculator">
      <div className="space-y-6" data-testid="emi-range-calculator-stage1">
        <p
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          data-testid="emi-range-disclaimer"
        >
          {t('pages.calculator.disclaimer')}
        </p>

        <div>
          <h3 className="text-sm font-semibold text-neutral-900">{t('pages.calculator.heading')}</h3>
          <p className="mt-1 text-sm text-neutral-600">{t('pages.calculator.description')}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            label={t('pages.calculator.downpayment')}
            type="text"
            inputMode="decimal"
            value={downpayment}
            onChange={(e) => setDownpayment(e.target.value)}
            data-testid="emi-range-downpayment"
          />
          <Input
            label={t('pages.calculator.disbursement')}
            type="text"
            inputMode="decimal"
            value={disbursementToDealer}
            onChange={(e) => setDisbursementToDealer(e.target.value)}
            data-testid="emi-range-disbursement"
          />
          <Input
            label={t('pages.calculator.invoiceValue')}
            type="text"
            value={invoiceDisplay}
            readOnly
            disabled
            data-testid="emi-range-invoice"
            className="bg-neutral-100 text-neutral-700"
          />
          <Select
            label={t('pages.calculator.tenure')}
            value={String(tenureMonths)}
            options={TENURE_OPTIONS}
            onChange={(e) => setTenureMonths(e.target.value === '18' ? 18 : 12)}
            data-testid="emi-range-tenure"
          />
        </div>

        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
          <h4 className="mb-3 text-sm font-semibold text-neutral-900">
            {t('pages.calculator.resultsHeading')}
          </h4>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-neutral-500">{t('pages.calculator.loanAmount')}</dt>
              <dd className="text-sm font-medium text-neutral-900" data-testid="emi-range-loan-amount">
                {formatRupee(preview.loanAmount)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500">{t('pages.calculator.tenure')}</dt>
              <dd className="text-sm font-medium text-neutral-900" data-testid="emi-range-tenure-preview">
                {preview.tenureMonths} {t('pages.calculator.months')}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500">{t('pages.calculator.iotCost')}</dt>
              <dd className="text-sm font-medium text-neutral-900" data-testid="emi-range-iot-cost">
                {formatRupee(iotWithGst.inclusiveAmount)}
              </dd>
              <dd className="text-xs text-neutral-500" data-testid="emi-range-iot-gst-note">
                {t('pages.calculator.iotGstNote', {
                  gst: formatRupee(iotWithGst.gstAmount),
                  base: formatRupee(iotWithGst.baseAmount),
                })}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500">{t('pages.calculator.processingFee')}</dt>
              <dd
                className="text-sm font-medium text-neutral-900"
                data-testid="emi-range-processing-fee"
              >
                {formatRupee(preview.processingFee)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500">{t('pages.calculator.emiAmount')}</dt>
              <dd className="text-sm font-medium text-neutral-900" data-testid="emi-range-emi">
                {formatRupee(preview.emiAmount)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500">{t('pages.calculator.disbursalAmount')}</dt>
              <dd
                className="text-sm font-medium text-neutral-900"
                data-testid="emi-range-disbursal"
              >
                {formatRupee(preview.disbursalAmount)}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="border-t border-neutral-200 pt-8" data-testid="emi-range-calculator-stage2">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">{t('pages.calculator.stage2Heading')}</h3>
          <p className="mt-1 text-sm text-neutral-600">{t('pages.calculator.stage2Description')}</p>
        </div>

        <div
          className="mt-4 flex gap-1 overflow-x-auto pb-1"
          role="tablist"
          aria-label={t('pages.calculator.stage2TabsAriaLabel')}
        >
          {stage2Tabs.map((tab) => {
            const isSelected = activeStage2Tab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                data-testid={`emi-range-tab-${tab.id}`}
                className={`shrink-0 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                  isSelected
                    ? 'border-brand-primary bg-brand-primary text-white'
                    : 'border-neutral-300 bg-neutral-50 text-neutral-700 hover:border-neutral-400 hover:bg-neutral-100'
                }`}
                onClick={() => setActiveStage2Tab(tab.id)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {activeStage2Tab === 'insurance' ? (
            <Input
              label={t('pages.calculator.insuranceCost')}
              type="text"
              inputMode="decimal"
              value={insuranceCost}
              onChange={(e) => setInsuranceCost(e.target.value)}
              data-testid="emi-range-insurance-cost"
            />
          ) : (
            <Input
              label={t('pages.calculator.registrationCost')}
              type="text"
              inputMode="decimal"
              value={registrationCost}
              onChange={(e) => setRegistrationCost(e.target.value)}
              data-testid="emi-range-registration-cost"
            />
          )}
        </div>

        <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
          <h4 className="mb-3 text-sm font-semibold text-neutral-900">
            {t('pages.calculator.finalInvoiceHeading')}
          </h4>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-neutral-500">{t('pages.calculator.iotCost')}</dt>
              <dd className="text-sm font-medium text-neutral-900" data-testid="emi-range-final-iot">
                {formatRupee(finalInvoice.iot.inclusiveAmount)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500">{t('pages.calculator.insuranceCost')}</dt>
              <dd className="text-sm font-medium text-neutral-900" data-testid="emi-range-final-insurance">
                {formatOptionalRupee(finalInvoice.insurance.inclusiveAmount)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500">{t('pages.calculator.registrationCost')}</dt>
              <dd className="text-sm font-medium text-neutral-900" data-testid="emi-range-final-registration">
                {formatOptionalRupee(finalInvoice.registration.inclusiveAmount)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500">{t('pages.calculator.gstAmount')}</dt>
              <dd className="text-sm font-medium text-neutral-900" data-testid="emi-range-gst-amount">
                {formatRupee(finalInvoice.gstAmount)}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-neutral-500">{t('pages.calculator.finalInvoiceAmount')}</dt>
              <dd className="text-sm font-medium text-neutral-900" data-testid="emi-range-final-invoice">
                {formatOptionalRupee(finalInvoice.finalInvoiceAmount)}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
};
