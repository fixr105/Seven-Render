import type { CanonicalApplication, CanonicalPerson } from './formModel';

function text(formData: Record<string, unknown>, key: string): string {
  const value = formData[key];
  if (value == null) return '';
  return String(value).trim();
}

function money(formData: Record<string, unknown>, key: string): number {
  const raw = text(formData, key).replace(/,/g, '');
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function supportIsCoApplicant(formData: Record<string, unknown>): boolean {
  return text(formData, '_meta.supportPersonType') === 'co_applicant';
}

function coApplicantFromForm(formData: Record<string, unknown>): CanonicalPerson | null {
  if (!supportIsCoApplicant(formData)) return null;
  const person: CanonicalPerson = {
    name: text(formData, 'coApplicant.name'),
    pan: text(formData, 'coApplicant.pan').toUpperCase(),
    mobile: text(formData, 'coApplicant.mobile').replace(/\D/g, '').slice(0, 10),
    email: text(formData, 'coApplicant.email'),
    dob: text(formData, 'coApplicant.dob'),
  };
  if (!person.pan && !person.mobile && !person.name) return null;
  return person;
}

/** Map the finished B2C EV wizard form_data into the Engine qualify/rank shape. */
export function canonicalFromWizardFormData(
  formData: Record<string, unknown>,
  requestedLoanAmount: number | string = 0
): CanonicalApplication {
  const fullName =
    text(formData, 'borrower.customerName') ||
    [text(formData, 'borrower.firstName'), text(formData, 'borrower.lastName')].filter(Boolean).join(' ') ||
    text(formData, '_meta.panLookup.fullName');
  const pan =
    text(formData, 'borrower.pan').toUpperCase() || text(formData, '_meta.panLookup.panNumber').toUpperCase();
  const mobile =
    text(formData, 'borrower.mobile').replace(/\D/g, '').slice(0, 10) ||
    text(formData, '_meta.panLookup.mobileNumber').replace(/\D/g, '').slice(0, 10);
  const email = text(formData, 'borrower.email') || text(formData, '_meta.panLookup.borrowerEmail');
  const amountFromForm = money(formData, 'loan.amount');
  const requested =
    amountFromForm > 0
      ? amountFromForm
      : Number(String(requestedLoanAmount).replace(/,/g, '')) || 0;
  const tenure = money(formData, 'loan.tenureMonths');

  return {
    fullName,
    pan,
    mobile,
    email,
    dob: text(formData, 'borrower.dob'),
    employmentType: text(formData, 'borrower.employmentType') || 'Salaried',
    monthlyIncome: money(formData, 'borrower.monthlyIncome'),
    existingObligations: money(formData, 'borrower.existingObligations'),
    requestedLoanAmount: requested,
    preferredTenure: tenure > 0 ? tenure : 36,
    onRoadPrice: money(formData, 'vehicle.cost') || money(formData, 'loan.onRoadPrice'),
    selectType: 'EMI',
    coApplicant: coApplicantFromForm(formData),
  };
}
