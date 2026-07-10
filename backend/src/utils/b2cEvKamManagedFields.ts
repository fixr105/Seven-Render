/**
 * Preserve KAM-managed form_data when clients save drafts.
 * Keep in sync with src/lib/b2cEvKamManagedFields.ts
 */

const COMPLIANCE_CHECKBOX_KEYS = [
  'compliance.vkycDone',
  'compliance.loanAgreementSigned',
  'compliance.enachDone',
] as const;

const COMPLIANCE_REQUESTED_AT_KEYS: Record<(typeof COMPLIANCE_CHECKBOX_KEYS)[number], string> = {
  'compliance.vkycDone': '_meta.kamRequests.vkyc.requestedAt',
  'compliance.loanAgreementSigned': '_meta.kamRequests.loanAgreement.requestedAt',
  'compliance.enachDone': '_meta.kamRequests.enach.requestedAt',
};

const COMPLIANCE_QUERY_ID_KEYS: Record<(typeof COMPLIANCE_CHECKBOX_KEYS)[number], string> = {
  'compliance.vkycDone': '_meta.kamRequests.vkyc.queryId',
  'compliance.loanAgreementSigned': '_meta.kamRequests.loanAgreement.queryId',
  'compliance.enachDone': '_meta.kamRequests.enach.queryId',
};

const DO_META_KEYS = [
  '_meta.doRequest.requestedAt',
  '_meta.doRequest.queryId',
  '_meta.doRequest.fulfilledAt',
  '_meta.doRequest.fulfilledBy',
  '_meta.doRequest.status',
  '_meta.doRequest.fulfillmentNotes',
  '_meta.doRequest.rejectionReason',
  '_meta.doRequest.rejectedAt',
  '_meta.doRequest.rejectedBy',
] as const;

function readString(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

function isComplianceApproved(value: unknown): boolean {
  return value === true || value === 'true';
}

function copyKeysFromExisting(
  target: Record<string, unknown>,
  existing: Record<string, unknown>,
  keys: readonly string[]
): void {
  for (const key of keys) {
    if (key in existing) target[key] = existing[key];
  }
}

export function preserveB2cKamManagedFields(
  existing: Record<string, unknown>,
  merged: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...merged };

  for (const checkboxKey of COMPLIANCE_CHECKBOX_KEYS) {
    if (!isComplianceApproved(existing[checkboxKey])) continue;

    result[checkboxKey] = existing[checkboxKey];
    const requestedAtKey = COMPLIANCE_REQUESTED_AT_KEYS[checkboxKey];
    const queryIdKey = COMPLIANCE_QUERY_ID_KEYS[checkboxKey];
    if (requestedAtKey in existing) result[requestedAtKey] = existing[requestedAtKey];
    if (queryIdKey in existing) result[queryIdKey] = existing[queryIdKey];
  }

  const existingFulfilledAt = readString(existing['_meta.doRequest.fulfilledAt']);
  if (existingFulfilledAt) {
    copyKeysFromExisting(result, existing, DO_META_KEYS);
    return result;
  }

  const existingStatus = readString(existing['_meta.doRequest.status']);
  const existingRequestedAt = readString(existing['_meta.doRequest.requestedAt']);

  if (existingStatus === 'rejected' && !existingRequestedAt) {
    copyKeysFromExisting(result, existing, DO_META_KEYS);
    return result;
  }

  if (existingRequestedAt && !existingFulfilledAt) {
    const incomingRequestedAt = readString(merged['_meta.doRequest.requestedAt']);
    const incomingFulfilledAt = readString(merged['_meta.doRequest.fulfilledAt']);
    if (incomingRequestedAt !== existingRequestedAt || incomingFulfilledAt) {
      result['_meta.doRequest.requestedAt'] = existing['_meta.doRequest.requestedAt'];
      if ('_meta.doRequest.queryId' in existing) {
        result['_meta.doRequest.queryId'] = existing['_meta.doRequest.queryId'];
      }
      if ('_meta.doRequest.status' in existing) {
        result['_meta.doRequest.status'] = existing['_meta.doRequest.status'];
      }
      result['_meta.doRequest.fulfilledAt'] = existing['_meta.doRequest.fulfilledAt'] ?? '';
      result['_meta.doRequest.fulfilledBy'] = existing['_meta.doRequest.fulfilledBy'] ?? '';
    }
  }

  return result;
}
