import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { LoanDraftInvoiceBreakdown } from '../applications/LoanDraftInvoiceBreakdown';
import { quoteCalculatorForScore, type ScoreQuote } from '../../lib/calculatorScoreQuote';
import {
  loadCalculatorQuoteContext,
  type CalculatorQuoteContext,
} from '../../lib/loadCalculatorQuoteContext';
import { PRICING_UNAVAILABLE_MESSAGE } from '../../lib/lenderBrePricing';
import {
  b2cPreviewToFrozenValues,
  calculateB2cLoanScenarioPreview,
  computeGstComponent,
  parseGstRateInput,
  parseMoneyInput,
  tenureSelectOptions,
  validateCustomerPaymentForFreeze,
  type LoanTenureMonths,
  type VehicleGstRate,
} from '../../lib/loanCalculator';

const SCORE_MIN = 300;
const SCORE_MAX = 900;
const SCORE_DEFAULT = 750;

const GST_RATE_OPTIONS_UI = [
  { value: '0.05', label: '5%' },
  { value: '0.18', label: '18%' },
];

function formatRupee(value: number): string {
  return `₹${value.toLocaleString('en-IN')}`;
}

function formatPercent(value: number): string {
  return `${value}%`;
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return SCORE_DEFAULT;
  return Math.min(SCORE_MAX, Math.max(SCORE_MIN, Math.round(value)));
}

interface EmiRangeCalculatorProps {
  loadContext?: () => Promise<CalculatorQuoteContext>;
}

export const EmiRangeCalculator: React.FC<EmiRangeCalculatorProps> = ({
  loadContext = loadCalculatorQuoteContext,
}) => {
  const { t } = useTranslation();
  const [vehiclePrice, setVehiclePrice] = useState('');
  const [gstRate, setGstRate] = useState<VehicleGstRate>(0.05);
  const [insurance, setInsurance] = useState('');
  const [registration, setRegistration] = useState('');
  const [accessories, setAccessories] = useState('');
  const [customerPayment, setCustomerPayment] = useState('');
  const [tenureMonths, setTenureMonths] = useState<LoanTenureMonths>(0);
  const [score, setScore] = useState(SCORE_DEFAULT);
  const [scoreText, setScoreText] = useState(String(SCORE_DEFAULT));
  const [productId, setProductId] = useState('');
  const [context, setContext] = useState<CalculatorQuoteContext | null>(null);
  const [loadingRules, setLoadingRules] = useState(true);
  const loadContextRef = useRef(loadContext);
  loadContextRef.current = loadContext;

  useEffect(() => {
    let cancelled = false;
    setLoadingRules(true);
    loadContextRef
      .current()
      .then((next) => {
        if (cancelled) return;
        setContext(next);
        if (next.products.length > 0) {
          setProductId(next.products[0].id);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setContext({
          lenderName: null,
          rows: [],
          products: [],
          tenureMonths: [],
          error: PRICING_UNAVAILABLE_MESSAGE,
        });
      })
      .finally(() => {
        if (!cancelled) setLoadingRules(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const tenureOptions = context?.tenureMonths ?? [];

  useEffect(() => {
    if (tenureOptions.length === 0) return;
    setTenureMonths((current) => (tenureOptions.includes(current) ? current : tenureOptions[0]));
  }, [tenureOptions]);

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

  const quote: ScoreQuote | null = useMemo(() => {
    if (!context?.lenderName || context.error) return null;
    return quoteCalculatorForScore(inputs, context.rows, score, context.lenderName, productId);
  }, [context, inputs, productId, score]);

  const invoicePreview = useMemo(() => {
    if (quote?.status === 'ok') return quote.preview;
    // Tax invoice does not depend on rate. This preview is only used for that total.
    return calculateB2cLoanScenarioPreview(inputs, 0, 0.06, 'feeInverse');
  }, [inputs, quote]);
  const taxInvoiceValue = invoicePreview.taxInvoiceValue;
  const customerPaymentValidation = useMemo(
    () => validateCustomerPaymentForFreeze(inputs.customerPayment, taxInvoiceValue),
    [inputs.customerPayment, taxInvoiceValue]
  );

  const taxInvoiceDisplay = taxInvoiceValue > 0 ? String(taxInvoiceValue) : '';
  const showCustomerPaymentWarning =
    taxInvoiceValue > 0 && inputs.customerPayment > 0 && !customerPaymentValidation.valid;

  const commitScore = (value: number) => {
    const next = clampScore(value);
    setScore(next);
    setScoreText(String(next));
  };

  const products = context?.products ?? [];
  const quoteMessage = quote && quote.status !== 'ok' ? quote.message : context?.error ?? null;

  return (
    <div className="space-y-8" data-testid="emi-range-calculator">
      <div className="space-y-6" data-testid="emi-range-calculator-stage1">
        <div>
          <h1 className="sf-page-title">Calculator</h1>
          <p className="mt-1 text-sm leading-5 text-sf-quiet">{t('pages.calculator.description')}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            tone="dealer"
            label={t('pages.calculator.vehiclePrice')}
            type="text"
            inputMode="decimal"
            value={vehiclePrice}
            onChange={(e) => setVehiclePrice(e.target.value)}
            data-testid="emi-range-vehicle-price"
          />
          <Select
            tone="dealer"
            label={t('pages.calculator.gstRate')}
            value={String(gstRate)}
            options={GST_RATE_OPTIONS_UI}
            onChange={(e) => setGstRate(parseGstRateInput(e.target.value))}
            data-testid="emi-range-gst-rate"
          />
          <Input
            tone="dealer"
            label={t('pages.calculator.insurance')}
            type="text"
            inputMode="decimal"
            value={insurance}
            onChange={(e) => setInsurance(e.target.value)}
            data-testid="emi-range-insurance"
          />
          <Input
            tone="dealer"
            label={t('pages.calculator.registration')}
            type="text"
            inputMode="decimal"
            value={registration}
            onChange={(e) => setRegistration(e.target.value)}
            data-testid="emi-range-registration"
          />
          <Input
            tone="dealer"
            label={t('pages.calculator.accessories')}
            type="text"
            inputMode="decimal"
            value={accessories}
            onChange={(e) => setAccessories(e.target.value)}
            data-testid="emi-range-accessories"
          />
          <Input
            tone="dealer"
            label={t('pages.calculator.downpayment')}
            type="text"
            inputMode="decimal"
            value={customerPayment}
            onChange={(e) => setCustomerPayment(e.target.value)}
            error={showCustomerPaymentWarning ? customerPaymentValidation.message : undefined}
            data-testid="emi-range-customer-payment"
          />
          <Input
            tone="dealer"
            label={t('pages.calculator.taxInvoiceValue')}
            type="text"
            value={taxInvoiceDisplay}
            readOnly
            disabled
            data-testid="emi-range-tax-invoice"
            className="bg-neutral-100 text-neutral-700"
          />
          <Select
            tone="dealer"
            label={t('pages.calculator.tenure')}
            value={tenureMonths > 0 ? String(tenureMonths) : ''}
            disabled={tenureOptions.length === 0}
            options={tenureSelectOptions(tenureOptions)}
            onChange={(e) => {
              const next = Number(e.target.value);
              if (tenureOptions.includes(next)) setTenureMonths(next);
            }}
            data-testid="emi-range-tenure"
          />
          {products.length > 1 ? (
            <Select
              tone="dealer"
              label={t('pages.calculator.loanProduct')}
              value={productId}
              options={products.map((product) => ({ value: product.id, label: product.name }))}
              onChange={(e) => setProductId(e.target.value)}
              data-testid="emi-range-product"
            />
          ) : null}
          <div className="md:col-span-2">
            <label htmlFor="emi-range-score" className="mb-1 block text-sm font-medium text-dealer-text">
              {t('pages.calculator.creditScore')}
            </label>
            <div className="flex items-center gap-3">
              <input
                id="emi-range-score"
                type="range"
                min={SCORE_MIN}
                max={SCORE_MAX}
                step={1}
                value={score}
                onChange={(e) => commitScore(Number(e.target.value))}
                className="h-11 min-w-0 flex-1 accent-sf-navy"
                data-testid="emi-range-score"
                aria-valuemin={SCORE_MIN}
                aria-valuemax={SCORE_MAX}
                aria-valuenow={score}
              />
              <input
                type="text"
                inputMode="numeric"
                value={scoreText}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 3);
                  setScoreText(digits);
                  const next = Number(digits);
                  if (digits.length > 0 && next >= SCORE_MIN && next <= SCORE_MAX) {
                    setScore(next);
                  }
                }}
                onBlur={() => commitScore(scoreText === '' ? score : Number(scoreText))}
                className="h-10 w-20 rounded border border-dealer-border bg-white px-3 text-base text-dealer-text focus:outline-none focus:ring-2 focus:ring-dealer-navy"
                data-testid="emi-range-score-input"
                aria-label={t('pages.calculator.creditScore')}
              />
            </div>
            <p className="mt-1 text-xs text-sf-quiet">
              {SCORE_MIN}–{SCORE_MAX}
            </p>
          </div>
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
            <h4 className="text-sm font-semibold text-neutral-900">{t('pages.calculator.quoteHeading')}</h4>
            <p className="text-xs text-neutral-500" data-testid="emi-range-tenure-preview">
              {t('pages.calculator.scenarioTenure', { months: tenureMonths })}
            </p>
          </div>

          {loadingRules ? (
            <p className="text-sm text-sf-quiet" data-testid="emi-range-rules-loading">
              {t('pages.calculator.loadingRules')}
            </p>
          ) : null}

          {!loadingRules && quoteMessage ? (
            <p
              className="rounded-lg border border-sf-border bg-sf-soft px-4 py-3 text-sm text-sf-text"
              data-testid="emi-range-quote-message"
              role="status"
            >
              {quoteMessage}
            </p>
          ) : null}

          {!loadingRules && quote?.status === 'ok' ? (
            <ScoreQuotePreview
              quote={quote}
            />
          ) : null}
        </div>
      </div>

      {!loadingRules &&
      quote?.status === 'ok' &&
      quote.preview.taxInvoiceValue > 0 &&
      customerPaymentValidation.valid ? (
        <div className="border-t border-neutral-200 pt-8" data-testid="emi-range-calculator-stage2">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">
              {t('pages.calculator.draftInvoiceHeading')}
            </h3>
            <p className="mt-1 text-sm text-neutral-600">{t('pages.calculator.draftInvoiceDescription')}</p>
          </div>
          <div className="mt-4">
            <LoanDraftInvoiceBreakdown
              frozen={b2cPreviewToFrozenValues(quote.preview)}
              scenarioLabel={t('pages.calculator.quoteHeading')}
              testIdPrefix="emi-score"
              referenceCode={`BRE-${quote.band.ruleId}`}
              sampleSubtitle={t('pages.calculator.draftInvoiceSubtitle')}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
};

function ScoreQuotePreview({
  quote,
}: {
  quote: Extract<ScoreQuote, { status: 'ok' }>;
}) {
  const { t } = useTranslation();
  const { band, preview } = quote;
  const iotWithGst = computeGstComponent(preview.gpsCharges);

  return (
    <div className="rounded-xl border border-sf-border bg-sf-soft p-4" data-testid="emi-score-loan-scenario">
      <h4 className="text-sm font-semibold text-neutral-900">Seven Fincorp</h4>
      <p className="mt-1 text-xs text-neutral-500" data-testid="emi-score-band">
        {t('pages.calculator.scoreBand')} {band.minCibil}–{band.maxCibil}
        {' · '}
        {t('pages.calculator.rule')} BRE-{band.ruleId}
        {' · '}
        {t('pages.calculator.roi')} {formatPercent(band.roi ?? 0)}
        {' · '}
        {t('pages.calculator.pfPercent')} {formatPercent(band.pf ?? 0)}
      </p>
      <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-neutral-500">{t('pages.calculator.loanAmount')}</dt>
          <dd className="text-sm font-medium text-neutral-900" data-testid="emi-score-scenario-loan-amount">
            {formatRupee(preview.loanAmount)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">{t('pages.calculator.tenure')}</dt>
          <dd className="text-sm font-medium text-neutral-900" data-testid="emi-score-scenario-tenure">
            {preview.tenureMonths} months
          </dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">{t('pages.calculator.iotCost')}</dt>
          <dd className="text-sm font-medium text-neutral-900" data-testid="emi-score-scenario-iot-cost">
            {formatRupee(iotWithGst.inclusiveAmount)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">{t('pages.calculator.processingFee')}</dt>
          <dd className="text-sm font-medium text-neutral-900" data-testid="emi-score-scenario-processing-fee">
            {formatRupee(preview.processingFee)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">{t('pages.calculator.disbursalAmount')}</dt>
          <dd className="text-sm font-medium text-neutral-900" data-testid="emi-score-scenario-disbursal">
            {formatRupee(preview.disbursalAmount)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">{t('pages.calculator.emiAmount')}</dt>
          <dd className="text-[24px] font-semibold leading-8 text-sf-navy" data-testid="emi-score-scenario-emi">
            {formatRupee(preview.emiAmount)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
