export const INTEREST_RATE = 35;
export const FEE_PCT = 0.08;
export const GPS_CHARGES: Record<12 | 18, number> = {
  12: 2000,
  18: 2500,
};

export type LoanTenureMonths = 12 | 18;

export interface LoanCalculatorInputs {
  upfrontPayment: number;
  disbursementToDealer: number;
  tenureMonths: LoanTenureMonths;
}

export interface LoanFrozenValues {
  loanAmount: number;
  interestRate: number;
  tenureMonths: LoanTenureMonths;
  processingFee: number;
  gpsCharges: number;
  processingFeePct: number;
  disbursalAmount: number;
}

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

export function computeInvoiceValue(downpayment: number, disbursement: number): number {
  return roundRupee(Math.max(0, downpayment) + Math.max(0, disbursement));
}

export function calculateEmi(loanAmount: number, tenureMonths: LoanTenureMonths): number {
  if (loanAmount <= 0 || tenureMonths <= 0) return 0;

  const monthlyRate = INTEREST_RATE / 100 / 12;
  if (monthlyRate === 0) return roundRupee(loanAmount / tenureMonths);

  const factor = Math.pow(1 + monthlyRate, tenureMonths);
  const emi = (loanAmount * monthlyRate * factor) / (factor - 1);
  return roundRupee(emi);
}

export function calculateLoanPreview(inputs: LoanCalculatorInputs): LoanLivePreview {
  const tenureMonths = inputs.tenureMonths === 18 ? 18 : 12;
  const gps = GPS_CHARGES[tenureMonths];
  const disbursementToDealer = Math.max(0, inputs.disbursementToDealer);
  const upfrontPayment = Math.max(0, inputs.upfrontPayment);
  const invoiceValue = computeInvoiceValue(upfrontPayment, disbursementToDealer);
  const loanAmountRaw = (disbursementToDealer + gps) / (1 - FEE_PCT);
  const loanAmount = roundRupee(loanAmountRaw);
  const processingFee = roundRupee(loanAmount * FEE_PCT);
  const gpsCharges = roundRupee(gps);
  const disbursalAmount = roundRupee(loanAmount - processingFee - gpsCharges);
  const emiAmount = calculateEmi(loanAmount, tenureMonths);

  return {
    invoiceValue,
    loanAmount,
    interestRate: INTEREST_RATE,
    tenureMonths,
    processingFee,
    gpsCharges,
    processingFeePctDisplay: FEE_PCT * 100,
    disbursalAmount,
    emiAmount,
  };
}

export function freezeLoanPreview(preview: LoanLivePreview): LoanFrozenValues {
  return {
    loanAmount: preview.loanAmount,
    interestRate: INTEREST_RATE,
    tenureMonths: preview.tenureMonths,
    processingFee: preview.processingFee,
    gpsCharges: preview.gpsCharges,
    processingFeePct: FEE_PCT * 100,
    disbursalAmount: preview.disbursalAmount,
  };
}

export interface LoanCalculatorSnapshot {
  downpayment: number;
  disbursementToDealer: number;
  invoiceValue: number;
  emiAmount: number;
}

export function frozenValuesToFormDataPatch(
  frozen: LoanFrozenValues,
  snapshot?: LoanCalculatorSnapshot
): Record<string, string> {
  const patch: Record<string, string> = {
    'loan.amount': String(frozen.loanAmount),
    'loan.interestRate': String(frozen.interestRate),
    'loan.tenureMonths': String(frozen.tenureMonths),
    'loan.processingFee': String(frozen.processingFee),
    'loan.gpsCharges': String(frozen.gpsCharges),
    'loan.processingFeePercent': String(frozen.processingFeePct),
    'loan.disbursalAmount': String(frozen.disbursalAmount),
  };

  if (snapshot) {
    patch['loan.calculator.downpayment'] = String(snapshot.downpayment);
    patch['loan.calculator.disbursementToDealer'] = String(snapshot.disbursementToDealer);
    patch['loan.calculator.invoiceValue'] = String(snapshot.invoiceValue);
    patch['loan.emiAmount'] = String(snapshot.emiAmount);
  }

  return patch;
}

export function formDataToFrozenValues(
  formData: Record<string, unknown>
): LoanFrozenValues | null {
  const loanAmount = parseMoneyInput(String(formData['loan.amount'] ?? ''));
  const tenureRaw = Number(String(formData['loan.tenureMonths'] ?? ''));
  const tenureMonths: LoanTenureMonths = tenureRaw === 18 ? 18 : tenureRaw === 12 ? 12 : 12;
  const processingFee = parseMoneyInput(String(formData['loan.processingFee'] ?? ''));
  const gpsCharges = parseMoneyInput(String(formData['loan.gpsCharges'] ?? ''));
  const disbursalAmount = parseMoneyInput(String(formData['loan.disbursalAmount'] ?? ''));
  const interestRate = parseMoneyInput(String(formData['loan.interestRate'] ?? ''));
  const processingFeePct = parseMoneyInput(String(formData['loan.processingFeePercent'] ?? ''));

  if (loanAmount <= 0) return null;

  return {
    loanAmount,
    interestRate: interestRate || INTEREST_RATE,
    tenureMonths,
    processingFee,
    gpsCharges,
    processingFeePct: processingFeePct || FEE_PCT * 100,
    disbursalAmount,
  };
}
