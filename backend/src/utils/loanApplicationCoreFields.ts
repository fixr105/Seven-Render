/**
 * Resolve top-level loan application columns from merged form data and/or an existing record.
 */

export interface LoanApplicationCoreFields {
  applicantName: string;
  productId: string;
  requestedLoanAmount: string;
}

export interface LoanApplicationPromotedFields extends LoanApplicationCoreFields {
  mobileNumber: string;
  emailId: string;
  documents: string;
}

const GEO_PHOTO_URL_KEYS = [
  'geoPhotos.withSupportPerson.url',
  'geoPhotos.withVehicle.url',
  'geoPhotos.atResidence.url',
] as const;

const GEO_PHOTO_FILE_NAME_KEYS: Record<(typeof GEO_PHOTO_URL_KEYS)[number], string> = {
  'geoPhotos.withSupportPerson.url': 'geoPhotos.withSupportPerson.fileName',
  'geoPhotos.withVehicle.url': 'geoPhotos.withVehicle.fileName',
  'geoPhotos.atResidence.url': 'geoPhotos.atResidence.fileName',
};

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

function isHttpDocumentUrl(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.startsWith('http://') || trimmed.startsWith('https://');
}

function isBase64DataUrl(value: string): boolean {
  return value.trim().startsWith('data:');
}

/** Remove inline base64 geo photo payloads from Form Data before persistence. */
export function stripBase64GeoPhotoUrls(
  formData: Record<string, unknown>
): Record<string, unknown> {
  const next = { ...formData };
  for (const urlKey of GEO_PHOTO_URL_KEYS) {
    const url = firstNonEmpty(next[urlKey]);
    if (!url || !isBase64DataUrl(url)) continue;
    delete next[urlKey];
    const fileNameKey = GEO_PHOTO_FILE_NAME_KEYS[urlKey];
    delete next[fileNameKey];
  }
  return next;
}

function slotIdFromGeoPhotoUrlKey(urlKey: string): string {
  const match = urlKey.match(/^geoPhotos\.([^.]+)\.url$/);
  return match?.[1] ?? urlKey;
}

export function resolveDocumentsFromFormData(
  mergedFormData: Record<string, unknown>,
  existingRecord?: Record<string, unknown>
): string {
  const existingDocuments = firstNonEmpty(
    existingRecord?.Documents,
    existingRecord?.documents
  );

  const entries = new Map<string, string>();
  if (existingDocuments) {
    for (const part of existingDocuments.split(',')) {
      const trimmed = part.trim();
      if (trimmed) entries.set(trimmed, trimmed);
    }
  }

  for (const urlKey of GEO_PHOTO_URL_KEYS) {
    const url = firstNonEmpty(mergedFormData[urlKey]);
    if (!url || !isHttpDocumentUrl(url)) continue;

    const fileNameKey = GEO_PHOTO_FILE_NAME_KEYS[urlKey];
    const fileName = firstNonEmpty(mergedFormData[fileNameKey]) || slotIdFromGeoPhotoUrlKey(urlKey);
    const slotId = slotIdFromGeoPhotoUrlKey(urlKey);
    entries.set(`${slotId}:${url}|${fileName}`, `${slotId}:${url}|${fileName}`);
  }

  return Array.from(entries.values()).join(',');
}

export function resolveLoanApplicationCoreFields(
  mergedFormData: Record<string, unknown>,
  existingRecord?: Record<string, unknown>
): LoanApplicationCoreFields {
  const existingFormData = parseExistingFormData(existingRecord);

  const applicantName = firstNonEmpty(
    mergedFormData.applicantName,
    mergedFormData.applicant_name,
    mergedFormData['borrower.customerName'],
    existingRecord?.['Applicant Name'],
    existingRecord?.applicantName,
    existingFormData.applicantName,
    existingFormData.applicant_name,
    existingFormData['borrower.customerName']
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
    mergedFormData['loan.amount'],
    existingRecord?.['Requested Loan Amount'],
    existingRecord?.requestedLoanAmount,
    existingFormData.requestedLoanAmount,
    existingFormData.requested_loan_amount,
    existingFormData['loan.amount']
  );

  return { applicantName, productId, requestedLoanAmount };
}

export function resolveLoanApplicationPromotedFields(
  mergedFormData: Record<string, unknown>,
  existingRecord?: Record<string, unknown>
): LoanApplicationPromotedFields {
  const core = resolveLoanApplicationCoreFields(mergedFormData, existingRecord);
  const existingFormData = parseExistingFormData(existingRecord);

  const mobileNumber = firstNonEmpty(
    mergedFormData['borrower.mobile'],
    mergedFormData['_meta.panLookup.mobileNumber'],
    mergedFormData._mobileNumber,
    existingRecord?.['Mobile Number'],
    existingRecord?.mobileNumber,
    existingFormData['borrower.mobile'],
    existingFormData['_meta.panLookup.mobileNumber'],
    existingFormData._mobileNumber
  );

  const emailId = firstNonEmpty(
    mergedFormData['borrower.email'],
    mergedFormData['_meta.panLookup.borrowerEmail'],
    mergedFormData._email,
    existingRecord?.['Email Id'],
    existingRecord?.['Email ID'],
    existingRecord?.emailId,
    existingFormData['borrower.email'],
    existingFormData['_meta.panLookup.borrowerEmail'],
    existingFormData._email
  );

  const documents = resolveDocumentsFromFormData(mergedFormData, existingRecord);

  return {
    ...core,
    mobileNumber,
    emailId,
    documents,
  };
}

export function mergeFormDataJson(
  existingRecord: Record<string, unknown>,
  incomingFormData: Record<string, unknown>
): Record<string, unknown> {
  const existingFormData = parseExistingFormData(existingRecord);
  return stripBase64GeoPhotoUrls({ ...existingFormData, ...incomingFormData });
}

export function buildPromotedApplicationRecord(
  existingRecord: Record<string, unknown>,
  formDataToStore: Record<string, unknown>,
  promoted: LoanApplicationPromotedFields,
  extraFields?: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...existingRecord,
    ...extraFields,
    'Applicant Name': promoted.applicantName,
    'Loan Product': promoted.productId,
    'Requested Loan Amount': String(promoted.requestedLoanAmount ?? ''),
    'Mobile Number': promoted.mobileNumber,
    'Email Id': promoted.emailId,
    Documents: promoted.documents,
    'Form Data': JSON.stringify(stripBase64GeoPhotoUrls(formDataToStore)),
    Remarks:
      formDataToStore.Remarks != null
        ? String(formDataToStore.Remarks)
        : existingRecord['Remarks'] ?? '',
  };
}
