import { fillLoanDocuments, offerFromPersistedLoan } from './postSubmitEngine/filledDocs';
import { filledLoanDocsOpen, stampFlowAlreadyStarted } from './kamComplianceConfirm';

type DocFiller = (payload: unknown) => Promise<string>;

const inFlight = new Map<string, Promise<{ formData: Record<string, unknown>; filled: boolean; error?: string }>>();

export async function ensureFilledLoanDocs(
  formData: Record<string, unknown>,
  fileId: string,
  fillers: {
    fillSanctionLetter: DocFiller;
    fillLoanAgreement: DocFiller;
    fillCkyc: DocFiller;
  }
): Promise<{ formData: Record<string, unknown>; filled: boolean; error?: string }> {
  const existing = inFlight.get(fileId);
  if (existing) return existing;
  const job = prepareLoanDocs(formData, fileId, fillers).finally(() => {
    inFlight.delete(fileId);
  });
  inFlight.set(fileId, job);
  return job;
}

async function prepareLoanDocs(
  formData: Record<string, unknown>,
  fileId: string,
  fillers: {
    fillSanctionLetter: DocFiller;
    fillLoanAgreement: DocFiller;
    fillCkyc: DocFiller;
  }
): Promise<{ formData: Record<string, unknown>; filled: boolean; error?: string }> {
  if (!fileId || stampFlowAlreadyStarted(formData)) {
    return { formData, filled: false };
  }
  if (await filledLoanDocsOpen(formData)) {
    return { formData, filled: false };
  }
  const offer = offerFromPersistedLoan(formData);
  if (!offer) {
    return { formData, filled: false, error: 'The accepted offer is missing.' };
  }
  try {
    const saved = await fillLoanDocuments({
      formData,
      offer,
      fileId,
      fillSanctionLetter: fillers.fillSanctionLetter,
      fillLoanAgreement: fillers.fillLoanAgreement,
      fillCkyc: fillers.fillCkyc,
    });
    if (!saved.complete) {
      return {
        formData,
        filled: false,
        error: saved.errors[0] || 'Loan documents are not ready yet.',
      };
    }
    return { formData: saved.formData, filled: true };
  } catch (err: unknown) {
    return {
      formData,
      filled: false,
      error: err instanceof Error ? err.message : 'Loan documents are not ready yet.',
    };
  }
}
