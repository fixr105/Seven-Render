/**
 * KAM-managed form_data fields — synced from server, protected from client overwrite.
 * Keep in sync with backend/src/utils/b2cEvKamManagedFields.ts
 */

import { COMPLIANCE_ITEMS } from './b2cEvCompliance';

export const B2C_COMPLIANCE_CHECKBOX_KEYS = COMPLIANCE_ITEMS.map((item) => item.checkboxKey);

export const B2C_COMPLIANCE_REQUESTED_AT_KEYS = COMPLIANCE_ITEMS.map((item) => item.requestedAtKey);

export const B2C_COMPLIANCE_QUERY_ID_KEYS = COMPLIANCE_ITEMS.map((item) => item.queryIdKey);

export const B2C_DO_FULFILLMENT_KEYS = [
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

export function isComplianceApprovedValue(value: unknown): boolean {
  return value === true || value === 'true';
}

/** Keys whose values should be copied from server when KAM has updated them. */
export function collectKamManagedFieldPatch(
  local: Record<string, unknown>,
  server: Record<string, unknown>
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  for (let i = 0; i < COMPLIANCE_ITEMS.length; i += 1) {
    const checkboxKey = B2C_COMPLIANCE_CHECKBOX_KEYS[i];
    const requestedAtKey = B2C_COMPLIANCE_REQUESTED_AT_KEYS[i];
    const queryIdKey = B2C_COMPLIANCE_QUERY_ID_KEYS[i];

    const serverApproved = isComplianceApprovedValue(server[checkboxKey]);
    const localApproved = isComplianceApprovedValue(local[checkboxKey]);

    if (serverApproved && !localApproved) {
      patch[checkboxKey] = server[checkboxKey];
      if (requestedAtKey in server) patch[requestedAtKey] = server[requestedAtKey];
      if (queryIdKey in server) patch[queryIdKey] = server[queryIdKey];
    } else if (serverApproved && localApproved) {
      const serverRequestedAt = readString(server[requestedAtKey]);
      const localRequestedAt = readString(local[requestedAtKey]);
      if (serverRequestedAt !== localRequestedAt) {
        patch[requestedAtKey] = server[requestedAtKey];
      }
    }
  }

  const serverFulfilledAt = readString(server['_meta.doRequest.fulfilledAt']);
  const localFulfilledAt = readString(local['_meta.doRequest.fulfilledAt']);

  if (serverFulfilledAt && serverFulfilledAt !== localFulfilledAt) {
    for (const key of B2C_DO_FULFILLMENT_KEYS) {
      if (key in server) patch[key] = server[key];
    }
  } else {
    const serverStatus = readString(server['_meta.doRequest.status']);
    const localStatus = readString(local['_meta.doRequest.status']);
    const serverRequestedAt = readString(server['_meta.doRequest.requestedAt']);
    const localRequestedAt = readString(local['_meta.doRequest.requestedAt']);

    if (
      serverStatus === 'rejected' &&
      !serverRequestedAt &&
      (localRequestedAt || localStatus !== 'rejected')
    ) {
      for (const key of B2C_DO_FULFILLMENT_KEYS) {
        if (key in server) patch[key] = server[key];
      }
    } else if (serverRequestedAt && serverRequestedAt !== localRequestedAt) {
      patch['_meta.doRequest.requestedAt'] = server['_meta.doRequest.requestedAt'];
      if ('_meta.doRequest.queryId' in server) {
        patch['_meta.doRequest.queryId'] = server['_meta.doRequest.queryId'];
      }
      if ('_meta.doRequest.status' in server) {
        patch['_meta.doRequest.status'] = server['_meta.doRequest.status'];
      }
    }
  }

  return patch;
}

export function mergeKamManagedFieldsFromServer(
  local: Record<string, unknown>,
  server: Record<string, unknown>
): Record<string, unknown> {
  const patch = collectKamManagedFieldPatch(local, server);
  if (Object.keys(patch).length === 0) return local;
  return { ...local, ...patch };
}

export function hasKamManagedFieldChanges(
  local: Record<string, unknown>,
  server: Record<string, unknown>
): boolean {
  return Object.keys(collectKamManagedFieldPatch(local, server)).length > 0;
}
