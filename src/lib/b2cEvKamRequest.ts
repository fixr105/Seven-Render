import { apiService } from '../services/api';
import {
  buildComplianceKamRequestMessage,
  COMPLIANCE_ITEMS,
  type ComplianceItemId,
} from './b2cEvCompliance';

function readString(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

/** Creates the client-to-KAM query and the form keys that make Mark complete available. */
export async function openKamComplianceRequest(input: {
  applicationId: string;
  itemId: ComplianceItemId;
  applicantName?: string;
  formData: Record<string, unknown>;
}): Promise<Record<string, string>> {
  const item = COMPLIANCE_ITEMS.find((entry) => entry.id === input.itemId);
  if (!item || !input.applicationId) return {};
  if (readString(input.formData[item.requestedAtKey])) return {};

  const message = buildComplianceKamRequestMessage(item, {
    applicantName: input.applicantName,
    applicationId: input.applicationId,
  });
  let queryId = '';
  try {
    const response = await apiService.createClientQuery(input.applicationId, {
      message,
      requestKind: 'b2c_compliance',
      itemId: input.itemId,
    });
    queryId = response.data?.queryId || '';
  } catch {
    queryId = '';
  }

  const patch: Record<string, string> = {
    [item.requestedAtKey]: new Date().toISOString(),
    [`_meta.kamRequests.${input.itemId}.dismissedAt`]: '',
  };
  if (queryId) patch[item.queryIdKey] = queryId;
  return patch;
}
