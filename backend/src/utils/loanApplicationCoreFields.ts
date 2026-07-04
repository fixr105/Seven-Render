/**
 * Resolve top-level loan application columns from merged form data and/or an existing record.
 */

export interface LoanApplicationCoreFields {
  applicantName: string;
  productId: string;
  requestedLoanAmount: string;
}

function firstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const str = String(value).trim();
    if (str !== '') return str;
  }
  return '';
}

function parseExistingFormData(record: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!record) return {};
  const raw = record['Form Data'] ?? record.formData ?? record['form_data'];
  if (raw == null) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === 'string' && raw.trim() !== '') {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

export function resolveLoanApplicationCoreFields(
  mergedFormData: Record<string, unknown>,
  existingRecord?: Record<string, unknown>
): LoanApplicationCoreFields {
  const existingFormData = parseExistingFormData(existingRecord);

  const applicantName = firstNonEmpty(
    mergedFormData.applicantName,
    mergedFormData.applicant_name,
    existingRecord?.['Applicant Name'],
    existingRecord?.applicantName,
    existingFormData.applicantName,
    existingFormData.applicant_name
  );

  const productId = firstNonEmpty(
    mergedFormData.productId,
    mergedFormData.loan_product_id,
    existingRecord?.['Loan Product'],
    existingRecord?.loanProduct,
    existingFormData.productId,
    existingFormData.loan_product_id
  );

  const requestedLoanAmount = firstNonEmpty(
    mergedFormData.requestedLoanAmount,
    mergedFormData.requested_loan_amount,
    existingRecord?.['Requested Loan Amount'],
    existingRecord?.requestedLoanAmount,
    existingFormData.requestedLoanAmount,
    existingFormData.requested_loan_amount
  );

  return { applicantName, productId, requestedLoanAmount };
}

export function mergeFormDataJson(
  existingRecord: Record<string, unknown>,
  incomingFormData: Record<string, unknown>
): Record<string, unknown> {
  const existingFormData = parseExistingFormData(existingRecord);
  return { ...existingFormData, ...incomingFormData };
}
