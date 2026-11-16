import { hasCoApplicant } from '../../lib/postSubmitEngine/canonical';

export type OwnerRole = 'Applicant' | 'Co-applicant' | 'Guarantor';

export type DocumentOwner = {
  name: string;
  role: OwnerRole;
  initials: string;
  line: string;
};

function readString(formData: Record<string, unknown>, key: string): string {
  const value = formData[key];
  if (value == null) return '';
  return String(value).trim();
}

export function isSupportDocument(slot: { fieldId: string; label: string }): boolean {
  const id = slot.fieldId.toLowerCase();
  const label = slot.label.toLowerCase();
  return (
    id.includes('co_applicant') ||
    id.includes('co-applicant') ||
    id.includes('guarantor') ||
    label.startsWith('co-applicant') ||
    label.startsWith('guarantor')
  );
}

function initialsFrom(name: string, role: OwnerRole): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return role.slice(0, 1).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function personName(formData: Record<string, unknown>, prefix: 'borrower' | 'coApplicant' | 'guarantor'): string {
  const direct =
    prefix === 'borrower'
      ? readString(formData, 'borrower.customerName')
      : readString(formData, `${prefix}.name`);
  if (direct) return direct.toUpperCase();
  const combined = [readString(formData, `${prefix}.firstName`), readString(formData, `${prefix}.lastName`)]
    .filter(Boolean)
    .join(' ');
  return combined.toUpperCase();
}

export function documentOwner(
  formData: Record<string, unknown>,
  slot: { fieldId: string; label: string }
): DocumentOwner {
  const support = isSupportDocument(slot) && hasCoApplicant(formData);
  const supportType = readString(formData, '_meta.supportPersonType');
  const role: OwnerRole = !support
    ? 'Applicant'
    : supportType === 'guarantor'
      ? 'Guarantor'
      : 'Co-applicant';
  const name = personName(formData, role === 'Applicant' ? 'borrower' : role === 'Guarantor' ? 'guarantor' : 'coApplicant');
  return {
    name,
    role,
    initials: initialsFrom(name, role),
    line: name ? `${name} · ${role}` : role,
  };
}

export function orderDocumentSlots<T extends { fieldId: string; label: string }>(slots: T[]): T[] {
  return [...slots].sort((a, b) => Number(isSupportDocument(a)) - Number(isSupportDocument(b)));
}
