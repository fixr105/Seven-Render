/**
 * KAM fulfillment persistence for B2C EV compliance and DO requests.
 */

import type { AuthUser } from '../../types/auth.js';
import { n8nClient } from '../airtable/n8nClient.js';
import { parseFormDataField } from '../../utils/mergeFormDataPatch.js';

export type { ComplianceItemId } from './kamB2cFulfillment.logic.js';
export {
  buildCompliancePatch,
  buildDoFulfillPatch,
  buildDoClearRequestPatch,
  formatComplianceAuditMessage,
  formatDoAuditMessage,
  hasOpenDoRequest,
} from './kamB2cFulfillment.logic.js';

export async function persistApplicationFormData(
  application: Record<string, unknown>,
  mergedFormData: Record<string, unknown>,
  kamUser: AuthUser,
  auditMessage: string
): Promise<void> {
  const updatedData = {
    ...application,
    'Form Data': JSON.stringify(mergedFormData),
    'Last Updated': new Date().toISOString(),
  };

  await n8nClient.postLoanApplication(updatedData);

  await n8nClient.postFileAuditLog({
    id: `AUDIT-${Date.now()}`,
    'Log Entry ID': `AUDIT-${Date.now()}`,
    File: application['File ID'],
    Timestamp: new Date().toISOString(),
    Actor: kamUser.email,
    'Action/Event Type': 'b2c_kam_fulfillment',
    'Details/Message': auditMessage,
    'Target User/Role': 'client',
    Resolved: 'True',
  });

  await n8nClient.postAdminActivityLog({
    id: `ACT-${Date.now()}`,
    'Activity ID': `ACT-${Date.now()}`,
    Timestamp: new Date().toISOString(),
    'Performed By': kamUser.email,
    'Action Type': 'b2c_kam_fulfillment',
    'Description/Details': auditMessage,
    'Target Entity': 'loan_application',
  });
}

export function getApplicationFormData(application: Record<string, unknown>): Record<string, unknown> {
  return parseFormDataField(application['Form Data']);
}
