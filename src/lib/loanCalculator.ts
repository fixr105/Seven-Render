export const INTEREST_RATE_MIN = 30;
export const INTEREST_RATE_MAX = 35;
export const FEE_PCT_MIN = 0.06;
export const FEE_PCT_MAX = 0.08;
export const INTEREST_RATE = INTEREST_RATE_MAX;
/** @deprecated Legacy EMI range calculator — B2C wizard uses PF_PCT */
export const FEE_PCT = FEE_PCT_MAX;
export const PF_PCT = 0.08;
export const LOAN_GROSSUP_FACTOR = 1.09;
export const MIN_CUSTOMER_PAYMENT_OF_TAX_INVOICE_PCT = 0.1;
export const GST_RATE_OPTIONS = [0.05, 0.18] as const;
export type VehicleGstRate = (typeof GST_RATE_OPTIONS)[number];
export const GST_PCT = 0.05;
export const GPS_CHARGES: Record<12 | 18, number> = {
  12: 2000,
  18: 2500,
};

export type LoanTenureMonths = 12 | 18;

/** Legacy disbursement-input model — used only by /calculator EMI range page */
export interface LoanCalculatorInputs {
  upfrontPayment: number;
  disbursementToDealer: number;
  tenureMonths: LoanTenureMonths;
}

/** B2C EV wizard — vehicle price + GST methodology */
export interface B2cLoanCalculatorInputs {
  vehiclePrice: number;
  gstRate: VehicleGstRate;
  insurance: number;
  registration: number;
  accessories: number;
  customerPayment: number;
  tenureMonths: LoanTenureMonths;
}

export interface EmiRangeInputs {
  upfrontPayment: number;
  disbursementToDealer: number;
}

export interface TenureEmiRangeInputs extends EmiRangeInputs {
  tenureMonths: LoanTenureMonths;
}

export interface EmiRangePreview {
  invoiceValue: number;
  lowestEmi: number;
  highestEmi: number;
  lowestProcessingFee: number;
  highestProcessingFee: number;
  lowestLoanAmount: number;
  highestLoanAmount: number;
  lowestDisbursalAmount: number;
  highestDisbursalAmount: number;
  lowestIotInclusive: number;
  highestIotInclusive: number;
}

export interface LoanFrozenValues {
  vehiclePrice: number;
  gstRate: VehicleGstRate;
  insurance: number;
  registration: number;
  accessories: number;
  customerPayment: number;
  taxInvoiceValue: number;
  loanAmount: number;
  interestRate: number;
  tenureMonths: LoanTenureMonths;
  processingFee: number;
  gpsCharges: number;
  disbursalAmount: number;
}

/** Legacy live preview — EMI range calculator */
export interface LoanLivePreview {
  invoiceValue: number;
  loanAmount: number;
  interestRate: number;
  tenureMonths: LoanTenureMonths;
  processingFee: number;
  gpsCharges: number;
  processingFeePctDisplay: number;
  disbursalAmount: number;
  emiAmount: number;
}

export interface B2cLoanLivePreview {
  vehiclePrice: number;
  gstRate: VehicleGstRate;
  insurance: number;
  registration: number;
  accessories: number;
  customerPayment: number;
  vehiclePriceWithGST: number;
  taxInvoiceValue: number;
  assumedDisbursement: number;
  loanAmount: number;
  interestRate: number;
  tenureMonths: LoanTenureMonths;
  processingFee: number;
  gpsCharges: number;
  disbursalAmount: number;
  emiAmount: number;
}

export function roundRupee(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
}

export function parseMoneyInput(value: string): number {
  const cleaned = value.replace(/,/g, '').trim();
  if (!cleaned) return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function parseGstRateInput(value: string): VehicleGstRate {
  const n = Number(value);
  if (n === 0.18) return 0.18;
  return 0.05;
}

export function getIotChargeForTenure(tenureMonths: LoanTenureMonths): number {
  return GPS_CHARGES[tenureMonths === 18 ? 18 : 12];
}

export function computeInvoiceValue(downpayment: number, disbursement: number): number {
  return roundRupee(Math.max(0, downpayment) + Math.max(0, disbursement));
}

export interface GstComponent {
  baseAmount: number;
  gstAmount: number;
  inclusiveAmount: number;
}

export function computeGstComponent(baseAmount: number): GstComponent {
  const base = roundRupee(Math.max(0, baseAmount));
  const gstAmount = roundRupee(base * GST_PCT);
  return {
    baseAmount: base,
    gstAmount,
    inclusiveAmount: roundRupee(base + gstAmount),
  };
}

export interface FinalInvoiceBreakdown {
  invoiceValue: number;
  iot: GstComponent;
  insurance: GstComponent;
  registration: GstComponent;
  gstAmount: number;
  finalInvoiceAmount: number;
}

export function computeFinalInvoiceBreakdown(
  invoiceValue: number,
  insuranceCost: number,
  registrationCost: number,
  iotBaseCost = 0
): FinalInvoiceBreakdown {
  const iot = computeGstComponent(iotBaseCost);
  const insurance = computeGstComponent(insuranceCost);
  const registration = computeGstComponent(registrationCost);
  const gstAmount = roundRupee(iot.gstAmount + insurance.gstAmount + registration.gstAmount);
  const finalInvoiceAmount = roundRupee(
    Math.max(0, invoiceValue) +
      iot.inclusiveAmount +
      insurance.inclusiveAmount +
      registration.inclusiveAmount
  );

  return {
    invoiceValue: roundRupee(Math.max(0, invoiceValue)),
    iot,
    insurance,
    registration,
    gstAmount,
    finalInvoiceAmount,
  };
}

export function computeFinalInvoiceAmount(
  invoiceValue: number,
  insuranceCost: number,
  registrationCost: number,
  iotCost = 0
): number {
  return computeFinalInvoiceBreakdown(invoiceValue, insuranceCost, registrationCost, iotCost)
    .finalInvoiceAmount;
}

export function calculateEmi(
  loanAmount: number,
  tenureMonths: LoanTenureMonths,
  interestRate: number = INTEREST_RATE
): number {
  if (loanAmount <= 0 || tenureMonths <= 0) return 0;

  const monthlyRate = interestRate / 100 / 12;
  if (monthlyRate === 0) return roundRupee(loanAmount / tenureMonths);

  const factor = Math.pow(1 + monthlyRate, tenureMonths);
  const emi = (loanAmount * monthlyRate * factor) / (factor - 1);
  return roundRupee(emi);
}

export function getMinimumCustomerPayment(taxInvoiceValue: number): number {
  if (taxInvoiceValue <= 0) return 0;
  return roundRupee(taxInvoiceValue * MIN_CUSTOMER_PAYMENT_OF_TAX_INVOICE_PCT);
}

export interface CustomerPaymentFreezeValidation {
  valid: boolean;
  minimumPayment: number;
  message?: string;
}

export function validateCustomerPaymentForFreeze(
  customerPayment: number,
  taxInvoiceValue: number
): CustomerPaymentFreezeValidation {
  if (taxInvoiceValue <= 0) {
    return { valid: true, minimumPayment: 0 };
  }

  const minimumPayment = getMinimumCustomerPayment(taxInvoiceValue);
  if (customerPayment < minimumPayment) {
    const formattedMinimum = minimumPayment.toLocaleString('en-IN');
    const formattedTaxInvoice = taxInvoiceValue.toLocaleString('en-IN');
    return {
      valid: false,
      minimumPayment,
      message: `Payment from customer must be at least 10% of the tax invoice value (minimum ₹${formattedMinimum} on ₹${formattedTaxInvoice}).`,
    };
  }

  return { valid: true, minimumPayment };
}

export type B2cLoanAmountMode = 'wizardGrossUp' | 'feeInverse';

function resolveB2cLoanAmount(
  assumedDisbursement: number,
  processingFeePct: number,
  loanAmountMode: B2cLoanAmountMode
): number {
  if (assumedDisbursement <= 0) return 0;

  if (loanAmountMode === 'feeInverse') {
    if (processingFeePct <= 0 || processingFeePct >= 1) return 0;
    return roundRupee(assumedDisbursement / (1 - processingFeePct));
  }

  return roundRupee(assumedDisbursement * LOAN_GROSSUP_FACTOR);
}

export function calculateB2cLoanScenarioPreview(
  inputs: B2cLoanCalculatorInputs,
  interestRate: number = INTEREST_RATE,
  processingFeePct: number = PF_PCT,
  loanAmountMode: B2cLoanAmountMode = 'wizardGrossUp'
): B2cLoanLivePreview {
  const tenureMonths: LoanTenureMonths = inputs.tenureMonths === 18 ? 18 : 12;
  const vehiclePrice = Math.max(0, inputs.vehiclePrice);
  const gstRate: VehicleGstRate = inputs.gstRate === 0.18 ? 0.18 : 0.05;
  const insurance = Math.max(0, inputs.insurance);
  const registration = Math.max(0, inputs.registration);
  const accessories = Math.max(0, inputs.accessories);
  const customerPayment = Math.max(0, inputs.customerPayment);
  const iotCharge = getIotChargeForTenure(tenureMonths);

  const vehiclePriceWithGST = roundRupee(vehiclePrice * (1 + gstRate));
  const taxInvoiceValue = roundRupee(
    vehiclePriceWithGST + iotCharge + insurance + registration + accessories
  );
  const assumedDisbursement = roundRupee(taxInvoiceValue - customerPayment);
  const loanAmount = resolveB2cLoanAmount(assumedDisbursement, processingFeePct, loanAmountMode);
  const processingFee = roundRupee(loanAmount * processingFeePct);
  const disbursalAmount = roundRupee(loanAmount - processingFee);
  const emiAmount = calculateEmi(loanAmount, tenureMonths, interestRate);

  return {
    vehiclePrice,
    gstRate,
    insurance,
    registration,
    accessories,
    customerPayment,
    vehiclePriceWithGST,
    taxInvoiceValue,
    assumedDisbursement,
    loanAmount,
    interestRate,
    tenureMonths,
    processingFee,
    gpsCharges: iotCharge,
    disbursalAmount,
    emiAmount,
  };
}

export function calculateB2cLoanPreview(inputs: B2cLoanCalculatorInputs): B2cLoanLivePreview {
  return calculateB2cLoanScenarioPreview(inputs, INTEREST_RATE, PF_PCT);
}

export function calculateB2cTenureEmiRangePreviews(
  inputs: B2cLoanCalculatorInputs
): { lowPreview: B2cLoanLivePreview; highPreview: B2cLoanLivePreview } {
  return {
    lowPreview: calculateB2cLoanScenarioPreview(
      inputs,
      INTEREST_RATE_MIN,
      FEE_PCT_MIN,
      'feeInverse'
    ),
    highPreview: calculateB2cLoanScenarioPreview(
      inputs,
      INTEREST_RATE_MAX,
      FEE_PCT_MAX,
      'feeInverse'
    ),
  };
}

export function b2cPreviewToFrozenValues(preview: B2cLoanLivePreview): LoanFrozenValues {
  return {
    vehiclePrice: preview.vehiclePrice,
    gstRate: preview.gstRate,
    insurance: preview.insurance,
    registration: preview.registration,
    accessories: preview.accessories,
    customerPayment: preview.customerPayment,
    taxInvoiceValue: preview.taxInvoiceValue,
    loanAmount: preview.loanAmount,
    interestRate: preview.interestRate,
    tenureMonths: preview.tenureMonths,
    processingFee: preview.processingFee,
    gpsCharges: preview.gpsCharges,
    disbursalAmount: preview.disbursalAmount,
  };
}

export function calculateLoanScenarioPreview(
  inputs: LoanCalculatorInputs,
  interestRate: number,
  feePct: number
): LoanLivePreview {
  const tenureMonths = inputs.tenureMonths === 18 ? 18 : 12;
  const gps = GPS_CHARGES[tenureMonths];
  const disbursementToDealer = Math.max(0, inputs.disbursementToDealer);
  const upfrontPayment = Math.max(0, inputs.upfrontPayment);
  const invoiceValue = computeInvoiceValue(upfrontPayment, disbursementToDealer);
  const loanAmountRaw = (disbursementToDealer + gps) / (1 - feePct);
  const loanAmount = roundRupee(loanAmountRaw);
  const processingFee = roundRupee(loanAmount * feePct);
  const gpsCharges = roundRupee(gps);
  const disbursalAmount = roundRupee(loanAmount - processingFee - gpsCharges);
  const emiAmount = calculateEmi(loanAmount, tenureMonths, interestRate);

  return {
    invoiceValue,
    loanAmount,
    interestRate,
    tenureMonths,
    processingFee,
    gpsCharges,
    processingFeePctDisplay: feePct * 100,
    disbursalAmount,
    emiAmount,
  };
}

export function calculateTenureEmiRangePreviews(
  inputs: TenureEmiRangeInputs
): { lowPreview: LoanLivePreview; highPreview: LoanLivePreview } {
  const tenureMonths = inputs.tenureMonths === 18 ? 18 : 12;
  const baseInputs: LoanCalculatorInputs = {
    upfrontPayment: inputs.upfrontPayment,
    disbursementToDealer: inputs.disbursementToDealer,
    tenureMonths,
  };

  return {
    lowPreview: calculateLoanScenarioPreview(baseInputs, INTEREST_RATE_MIN, FEE_PCT_MIN),
    highPreview: calculateLoanScenarioPreview(baseInputs, INTEREST_RATE_MAX, FEE_PCT_MAX),
  };
}

export function calculateEmiRangePreview(inputs: TenureEmiRangeInputs): EmiRangePreview {
  const { lowPreview, highPreview } = calculateTenureEmiRangePreviews(inputs);
  const iotInclusive = computeGstComponent(lowPreview.gpsCharges).inclusiveAmount;

  return {
    invoiceValue: lowPreview.invoiceValue,
    lowestEmi: lowPreview.emiAmount,
    highestEmi: highPreview.emiAmount,
    lowestProcessingFee: lowPreview.processingFee,
    highestProcessingFee: highPreview.processingFee,
    lowestLoanAmount: lowPreview.loanAmount,
    highestLoanAmount: highPreview.loanAmount,
    lowestDisbursalAmount: lowPreview.disbursalAmount,
    highestDisbursalAmount: highPreview.disbursalAmount,
    lowestIotInclusive: iotInclusive,
    highestIotInclusive: iotInclusive,
  };
}

export interface LoanMathBreakdown {
  tenureMonths: LoanTenureMonths;
  taxInvoiceValue: number;
  assumedDisbursement: number;
  loanAmount: number;
  processingFee: number;
  gpsCharges: number;
  disbursalAmount: number;
  emiAmount: number;
}

export function buildLoanMathBreakdown(frozen: LoanFrozenValues): LoanMathBreakdown {
  return {
    tenureMonths: frozen.tenureMonths,
    taxInvoiceValue: frozen.taxInvoiceValue,
    assumedDisbursement: roundRupee(frozen.taxInvoiceValue - frozen.customerPayment),
    loanAmount: frozen.loanAmount,
    processingFee: frozen.processingFee,
    gpsCharges: frozen.gpsCharges,
    disbursalAmount: frozen.disbursalAmount,
    emiAmount: calculateEmi(frozen.loanAmount, frozen.tenureMonths, frozen.interestRate),
  };
}

export function freezeB2cLoanPreview(preview: B2cLoanLivePreview): LoanFrozenValues {
  return {
    vehiclePrice: preview.vehiclePrice,
    gstRate: preview.gstRate,
    insurance: preview.insurance,
    registration: preview.registration,
    accessories: preview.accessories,
    customerPayment: preview.customerPayment,
    taxInvoiceValue: preview.taxInvoiceValue,
    loanAmount: preview.loanAmount,
    interestRate: INTEREST_RATE,
    tenureMonths: preview.tenureMonths,
    processingFee: preview.processingFee,
    gpsCharges: preview.gpsCharges,
    disbursalAmount: preview.disbursalAmount,
  };
}

export interface LoanCalculatorSnapshot {
  vehiclePrice: number;
  gstRate: VehicleGstRate;
  insurance: number;
  registration: number;
  accessories: number;
  customerPayment: number;
  taxInvoiceValue: number;
  emiAmount: number;
}

export function frozenValuesToFormDataPatch(
  frozen: LoanFrozenValues,
  snapshot?: LoanCalculatorSnapshot
): Record<string, string> {
  const patch: Record<string, string> = {
    'loan.vehiclePrice': String(frozen.vehiclePrice),
    'loan.gstRate': String(frozen.gstRate),
    'loan.insurance': String(frozen.insurance),
    'loan.registration': String(frozen.registration),
    'loan.accessories': String(frozen.accessories),
    'loan.taxInvoiceValue': String(frozen.taxInvoiceValue),
    'loan.amount': String(frozen.loanAmount),
    'loan.interestRate': String(frozen.interestRate),
    'loan.tenureMonths': String(frozen.tenureMonths),
    'loan.processingFee': String(frozen.processingFee),
    'loan.gpsCharges': String(frozen.gpsCharges),
    'loan.disbursalAmount': String(frozen.disbursalAmount),
    'loan.calculator.customerPayment': String(frozen.customerPayment),
  };

  if (snapshot) {
    patch['loan.emiAmount'] = String(snapshot.emiAmount);
  }

  return patch;
}

export function formDataToFrozenValues(
  formData: Record<string, unknown>
): LoanFrozenValues | null {
  const loanAmount = parseMoneyInput(String(formData['loan.amount'] ?? ''));
  if (loanAmount <= 0) return null;

  const tenureRaw = Number(String(formData['loan.tenureMonths'] ?? ''));
  const tenureMonths: LoanTenureMonths = tenureRaw === 18 ? 18 : 12;
  const gstRate = parseGstRateInput(String(formData['loan.gstRate'] ?? '0.05'));

  return {
    vehiclePrice: parseMoneyInput(String(formData['loan.vehiclePrice'] ?? '')),
    gstRate,
    insurance: parseMoneyInput(String(formData['loan.insurance'] ?? '')),
    registration: parseMoneyInput(String(formData['loan.registration'] ?? '')),
    accessories: parseMoneyInput(String(formData['loan.accessories'] ?? '')),
    customerPayment: parseMoneyInput(
      String(formData['loan.calculator.customerPayment'] ?? formData['loan.customerPayment'] ?? '')
    ),
    taxInvoiceValue: parseMoneyInput(String(formData['loan.taxInvoiceValue'] ?? '')),
    loanAmount,
    interestRate: parseMoneyInput(String(formData['loan.interestRate'] ?? '')) || INTEREST_RATE,
    tenureMonths,
    processingFee: parseMoneyInput(String(formData['loan.processingFee'] ?? '')),
    gpsCharges: parseMoneyInput(String(formData['loan.gpsCharges'] ?? '')),
    disbursalAmount: parseMoneyInput(String(formData['loan.disbursalAmount'] ?? '')),
  };
}
