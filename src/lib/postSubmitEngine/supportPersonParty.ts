import { hasCoApplicant } from './canonical';

export type SupportPersonParty = {
  type: 'co_applicant' | 'guarantor';
  label: string;
  name: string;
  email: string;
  mobile: string;
  prefix: 'coApplicant' | 'guarantor';
};

function str(fd: Record<string, unknown>, key: string): string {
  const v = fd[key];
  return v == null ? '' : String(v).trim();
}

function digits10(mobile: string): string {
  const digits = String(mobile || '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

/**
 * Second stamp/sign party = co-applicant or guarantor (label only).
 * STOP when name or mobile is missing.
 */
export function getSupportPersonParty(
  formData: Record<string, unknown>
): { ok: true; party: SupportPersonParty } | { ok: false; reason: string } {
  if (!hasCoApplicant(formData)) {
    return {
      ok: false,
      reason: 'Co-applicant PAN and mobile are required.',
    };
  }
  const typeRaw = str(formData, '_meta.supportPersonType');
  const type: 'co_applicant' | 'guarantor' =
    typeRaw === 'guarantor' ? 'guarantor' : 'co_applicant';
  const prefix = type === 'guarantor' ? 'guarantor' : 'coApplicant';
  const name =
    str(formData, `${prefix}.name`) ||
    str(formData, `${prefix}.customerName`) ||
    `${str(formData, `${prefix}.firstName`)} ${str(formData, `${prefix}.lastName`)}`.trim();
  const email = str(formData, `${prefix}.email`);
  const mobile = digits10(str(formData, `${prefix}.mobile`));
  if (!name || mobile.length !== 10) {
    return {
      ok: false,
      reason: 'Support person name and mobile are required for stamp papers and signing.',
    };
  }
  return {
    ok: true,
    party: {
      type,
      label: type === 'guarantor' ? 'Guarantor' : 'Co-applicant',
      name: name.toUpperCase(),
      email,
      mobile,
      prefix,
    },
  };
}

export function getApplicantParty(formData: Record<string, unknown>): {
  name: string;
  email: string;
  mobile: string;
} {
  const name =
    str(formData, 'borrower.customerName') ||
    `${str(formData, 'borrower.firstName')} ${str(formData, 'borrower.lastName')}`.trim();
  return {
    name: name.toUpperCase(),
    email: str(formData, 'borrower.email'),
    mobile: digits10(str(formData, 'borrower.mobile')),
  };
}
