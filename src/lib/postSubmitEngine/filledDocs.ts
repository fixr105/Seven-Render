import type { EnachDetails } from './enach';
import { buildDocPayload } from './docPayload';
import type { DisplayOffer, FilledDocs } from './types';

const DOC_KEYS = {
  sanctionLetter: '_meta.docs.sanctionLetter',
  loanAgreement: '_meta.docs.loanAgreement',
  ckyc: '_meta.docs.ckyc',
} as const;

type DocName = keyof typeof DOC_KEYS;

export type FilledDocUrlInput = Partial<Record<DocName, string | null | undefined>>;

function readNum(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function httpsUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.startsWith('https://') ? trimmed : null;
}

/** The accepted offer is the loan.* values already stored on the file. */
export function offerFromPersistedLoan(formData: Record<string, unknown>): DisplayOffer | null {
  const amount = readNum(formData['loan.amount']);
  if (amount <= 0) return null;
  const roi = readNum(formData['loan.interestRate']);
  const emi = readNum(formData['loan.emiAmount'] ?? formData['loan.emi']);
  return {
    id: 'persisted-offer',
    label: 'Accepted offer',
    amount,
    roi,
    pf: readNum(formData['loan.processingFee']),
    emi,
    tenure: readNum(formData['loan.tenureMonths']),
    apr: roi,
    real_lender_id: 'Fintree',
    source: {},
  };
}

export function applyFilledDocUrls(
  formData: Record<string, unknown>,
  incoming: FilledDocUrlInput
): { formData: Record<string, unknown>; filled: FilledDocs; complete: boolean } {
  const next: Record<string, unknown> = { ...formData };
  (Object.keys(DOC_KEYS) as DocName[]).forEach((name) => {
    const url = httpsUrl(incoming[name]);
    if (url) next[DOC_KEYS[name]] = url;
  });
  const filled: FilledDocs = {
    sanctionLetter: String(next[DOC_KEYS.sanctionLetter] || ''),
    loanAgreement: String(next[DOC_KEYS.loanAgreement] || ''),
    ckyc: String(next[DOC_KEYS.ckyc] || ''),
  };
  const complete = Boolean(
    httpsUrl(filled.sanctionLetter) && httpsUrl(filled.loanAgreement) && httpsUrl(filled.ckyc)
  );
  return { formData: next, filled, complete };
}

export async function fillLoanDocuments(input: {
  formData: Record<string, unknown>;
  offer: DisplayOffer;
  fileId: string;
  enach?: EnachDetails | null;
  fillSanctionLetter: (payload: unknown) => Promise<string>;
  fillLoanAgreement: (payload: unknown) => Promise<string>;
  fillCkyc: (payload: unknown) => Promise<string>;
}): Promise<{
  formData: Record<string, unknown>;
  filled: FilledDocs;
  complete: boolean;
  errors: string[];
}> {
  const payload = buildDocPayload(input.formData, input.offer, input.fileId, input.enach);
  const jobs: Array<[DocName, (payload: unknown) => Promise<string>]> = [
    ['sanctionLetter', input.fillSanctionLetter],
    ['loanAgreement', input.fillLoanAgreement],
    ['ckyc', input.fillCkyc],
  ];
  const incoming: FilledDocUrlInput = {};
  const errors: string[] = [];
  for (const [name, fill] of jobs) {
    try {
      incoming[name] = await fill(payload);
    } catch (err) {
      errors.push(err instanceof Error && err.message ? err.message : `${name} failed`);
    }
  }
  const saved = applyFilledDocUrls(input.formData, incoming);
  return { ...saved, errors };
}
