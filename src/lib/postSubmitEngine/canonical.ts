function str(formData: Record<string, unknown>, key: string): string {
  const value = formData[key];
  if (value == null) return '';
  return String(value).trim();
}

function num(formData: Record<string, unknown>, key: string): number {
  const raw = formData[key];
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export type CanonicalBorrower = {
  fullName: string;
  firstName: string;
  lastName: string;
  mobile: string;
  pan: string;
  email: string;
  dob: string;
  requestedLoanAmount: number;
  preferredTenure: number;
  onRoadPrice: number;
};

export function buildCanonical(formData: Record<string, unknown>): CanonicalBorrower {
  const firstName = str(formData, 'borrower.firstName');
  const lastName = str(formData, 'borrower.lastName');
  const fullName =
    str(formData, 'borrower.customerName') ||
    [firstName, lastName].filter(Boolean).join(' ').trim();

  return {
    fullName,
    firstName,
    lastName,
    mobile: str(formData, 'borrower.mobile') || str(formData, '_meta.panLookup.mobileNumber'),
    pan: str(formData, 'borrower.pan') || str(formData, '_meta.panLookup.panNumber'),
    email: str(formData, 'borrower.email') || str(formData, '_meta.panLookup.borrowerEmail'),
    dob: str(formData, 'borrower.dob'),
    requestedLoanAmount: num(formData, 'loan.amount'),
    preferredTenure: num(formData, 'loan.tenureMonths') || 36,
    onRoadPrice: num(formData, 'loan.vehiclePrice') || num(formData, 'vehicle.cost'),
  };
}

export function hasCoApplicantForQualify(formData: Record<string, unknown>): boolean {
  const supportType = str(formData, '_meta.supportPersonType');
  if (supportType !== 'co_applicant') return false;
  const pan = str(formData, 'coApplicant.pan');
  const mobile = str(formData, 'coApplicant.mobile');
  return Boolean(pan && mobile);
}

export function calculateAge(dob: string): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age -= 1;
  return age >= 0 && age < 120 ? age : null;
}

export function formatInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
