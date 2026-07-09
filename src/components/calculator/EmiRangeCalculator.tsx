import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { LoanDraftInvoiceBreakdown } from '../applications/LoanDraftInvoiceBreakdown';
import {
  b2cPreviewToFrozenValues,
  calculateB2cTenureEmiRangePreviews,
  computeGstComponent,
  parseGstRateInput,
  parseMoneyInput,
  validateCustomerPaymentForFreeze,
  type B2cLoanLivePreview,
  type LoanTenureMonths,
  type VehicleGstRate,
} from '../../lib/loanCalculator';

const TENURE_OPTIONS = [
  { value: '12', label: '12 months' },
  { value: '18', label: '18 months' },
];

const GST_RATE_OPTIONS_UI = [
  { value: '0.05', label: '5%' },
  { value: '0.18', label: '18%' },
];

type EmiScenarioVariant = 'low' | 'high';

function formatRupee(value: number): string {
  return `₹${value.toLocaleString('en-IN')}`;
}

interface EmiScenarioPreviewProps {
  variant: EmiScenarioVariant;
  preview: B2cLoanLivePreview;
  heading: string;
}

const EmiScenarioPreview: React.FC<EmiScenarioPreviewProps> = ({ variant, preview, heading }) => {
  const iotWithGst = useMemo(() => computeGstComponent(preview.gpsCharges), [preview.gpsCharges]);
  const testIdPrefix = variant === 'low' ? 'emi-range-low' : 'emi-range-high';

  return (
    <div
      className="rounded-xl border border-neutral-200 bg-neutral-50 p-4"
      data-testid={`${testIdPrefix}-loan-scenario`}
    >
      <h4 className="text-sm font-semibold text-neutral-900">{heading}</h4>
      <dl className="mt-3 grid grid-cols-1 gap-3">
        <div>
          <dt className="text-xs text-neutral-500">Loan Amount</dt>
          <dd className="text-sm font-medium text-neutral-900" data-testid={`${testIdPrefix}-scenario-loan-amount`}>
            {formatRupee(preview.loanAmount)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Tenure</dt>
          <dd className="text-sm font-medium text-neutral-900" data-testid={`${testIdPrefix}-scenario-tenure`}>
            {preview.tenureMonths} months
          </dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">GPS/IOT (including GST)</dt>
          <dd className="text-sm font-medium text-neutral-900" data-testid={`${testIdPrefix}-scenario-iot-cost`}>
            {formatRupee(iotWithGst.inclusiveAmount)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Processing Fee</dt>
          <dd className="text-sm font-medium text-neutral-900" data-testid={`${testIdPrefix}-scenario-processing-fee`}>
            {formatRupee(preview.processingFee)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Disbursal Amount</dt>
          <dd className="text-sm font-medium text-neutral-900" data-testid={`${testIdPrefix}-scenario-disbursal`}>
            {formatRupee(preview.disbursalAmount)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">EMI Amount</dt>
          <dd className="text-sm font-medium text-neutral-900" data-testid={`${testIdPrefix}-scenario-emi`}>
            {formatRupee(preview.emiAmount)}
          </dd>
        </div>
      </dl>
    </div>
  );
};

export const EmiRangeCalculator: React.FC = () => {
  const { t } = useTranslation();
  const [vehiclePrice, setVehiclePrice] = useState('');
  const [gstRate, setGstRate] = useState<VehicleGstRate>(0.05);
  const [insurance, setInsurance] = useState('');
  const [registration, setRegistration] = useState('');
  const [accessories, setAccessories] = useState('');
  const [customerPayment, setCustomerPayment] = useState('');
  const [tenureMonths, setTenureMonths] = useState<LoanTenureMonths>(12);

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

  const { lowPreview, highPreview } = useMemo(
    () => calculateB2cTenureEmiRangePreviews(inputs),
    [inputs]
  );

  const customerPaymentValidation = useMemo(
    () => validateCustomerPaymentForFreeze(inputs.customerPayment, lowPreview.taxInvoiceValue),
    [inputs.customerPayment, lowPreview.taxInvoiceValue]
  );

  const taxInvoiceDisplay =
    lowPreview.taxInvoiceValue > 0 ? String(lowPreview.taxInvoiceValue) : '';

  const showCustomerPaymentWarning =
    lowPreview.taxInvoiceValue > 0 &&
    inputs.customerPayment > 0 &&
    !customerPaymentValidation.valid;

  return (
    <div className="space-y-8" data-testid="emi-range-calculator">
      <div className="space-y-6" data-testid="emi-range-calculator-stage1">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">{t('pages.calculator.heading')}</h3>
          <p className="mt-1 text-sm text-neutral-600">{t('pages.calculator.description')}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            label={t('pages.calculator.vehiclePrice')}
            type="text"
            inputMode="decimal"
            value={vehiclePrice}
            onChange={(e) => setVehiclePrice(e.target.value)}
            data-testid="emi-range-vehicle-price"
          />
          <Select
            label={t('pages.calculator.gstRate')}
            value={String(gstRate)}
            options={GST_RATE_OPTIONS_UI}
            onChange={(e) => setGstRate(parseGstRateInput(e.target.value))}
            data-testid="emi-range-gst-rate"
          />
          <Input
            label={t('pages.calculator.insurance')}
            type="text"
            inputMode="decimal"
            value={insurance}
            onChange={(e) => setInsurance(e.target.value)}
            data-testid="emi-range-insurance"
          />
          <Input
            label={t('pages.calculator.registration')}
            type="text"
            inputMode="decimal"
            value={registration}
            onChange={(e) => setRegistration(e.target.value)}
            data-testid="emi-range-registration"
          />
          <Input
            label={t('pages.calculator.accessories')}
            type="text"
            inputMode="decimal"
            value={accessories}
            onChange={(e) => setAccessories(e.target.value)}
            data-testid="emi-range-accessories"
          />
          <Input
            label={t('pages.calculator.downpayment')}
            type="text"
            inputMode="decimal"
            value={customerPayment}
            onChange={(e) => setCustomerPayment(e.target.value)}
            error={showCustomerPaymentWarning ? customerPaymentValidation.message : undefined}
            data-testid="emi-range-customer-payment"
          />
          <Input
            label={t('pages.calculator.taxInvoiceValue')}
            type="text"
            value={taxInvoiceDisplay}
            readOnly
            disabled
            data-testid="emi-range-tax-invoice"
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

        {showCustomerPaymentWarning ? (
          <p
            className="rounded-lg border border-error/30 bg-error/5 px-4 py-3 text-sm text-error"
            data-testid="emi-range-customer-payment-error"
            role="alert"
          >
            {customerPaymentValidation.message}
          </p>
        ) : null}

        <div>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="text-sm font-semibold text-neutral-900">
              {t('pages.calculator.resultsHeading')}
            </h4>
            <p className="text-xs text-neutral-500" data-testid="emi-range-tenure-preview">
              {t('pages.calculator.scenarioTenure', { months: tenureMonths })}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <EmiScenarioPreview
              variant="low"
              preview={lowPreview}
              heading={t('pages.calculator.lowestScenario')}
            />
            <EmiScenarioPreview
              variant="high"
              preview={highPreview}
              heading={t('pages.calculator.highestScenario')}
            />
          </div>
        </div>
      </div>

      {lowPreview.taxInvoiceValue > 0 && customerPaymentValidation.valid ? (
        <div className="border-t border-neutral-200 pt-8" data-testid="emi-range-calculator-stage2">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">
              {t('pages.calculator.draftInvoiceHeading')}
            </h3>
            <p className="mt-1 text-sm text-neutral-600">
              {t('pages.calculator.draftInvoiceDescription')}
            </p>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-6 xl:grid-cols-2">
            <LoanDraftInvoiceBreakdown
              frozen={b2cPreviewToFrozenValues(lowPreview)}
              scenarioLabel={t('pages.calculator.lowestScenario')}
              testIdPrefix="emi-range-low"
              referenceCode="EMI-RANGE-LOW"
              sampleSubtitle={t('pages.calculator.draftInvoiceSubtitle')}
            />
            <LoanDraftInvoiceBreakdown
              frozen={b2cPreviewToFrozenValues(highPreview)}
              scenarioLabel={t('pages.calculator.highestScenario')}
              testIdPrefix="emi-range-high"
              referenceCode="EMI-RANGE-HIGH"
              sampleSubtitle={t('pages.calculator.draftInvoiceSubtitle')}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
};
