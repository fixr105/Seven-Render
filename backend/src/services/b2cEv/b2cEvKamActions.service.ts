/**
 * Server-side extraction of pending B2C EV actions from form_data (dashboard triage).
 */

import { resolveApplicationRecordStatus } from '../../utils/loanApplicationAirtableStatus.js';

type ComplianceItemId = 'vkyc' | 'loanAgreement' | 'enach';

const COMPLIANCE_ITEMS: Array<{
  id: ComplianceItemId;
  checkboxKey: string;
  requestedAtKey: string;
  requestLabel: string;
}> = [
  {
    id: 'vkyc',
    checkboxKey: 'compliance.vkycDone',
    requestedAtKey: '_meta.kamRequests.vkyc.requestedAt',
    requestLabel: 'VKYC',
  },
  {
    id: 'loanAgreement',
    checkboxKey: 'compliance.loanAgreementSigned',
    requestedAtKey: '_meta.kamRequests.loanAgreement.requestedAt',
    requestLabel: 'Loan agreement signing',
  },
  {
    id: 'enach',
    checkboxKey: 'compliance.enachDone',
    requestedAtKey: '_meta.kamRequests.enach.requestedAt',
    requestLabel: 'eNACH setup',
  },
];

function readString(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

function isComplianceChecked(formData: Record<string, unknown>, checkboxKey: string): boolean {
  const value = formData[checkboxKey];
  return value === true || value === 'true';
}

function hasOpenDoRequest(formData: Record<string, unknown>): boolean {
  const requestedAt = readString(formData['_meta.doRequest.requestedAt']);
  const fulfilledAt = readString(formData['_meta.doRequest.fulfilledAt']);
  return Boolean(requestedAt && !fulfilledAt);
}

export interface PendingB2cActionRow {
  applicationId: string;
  fileId: string;
  applicantName?: string;
  type: 'compliance' | 'do';
  itemId?: ComplianceItemId;
  label: string;
  requestedAt: string;
  queryId?: string;
}

export function extractPendingB2cActionsFromFormData(
  formData: Record<string, unknown>,
  context: { applicationId: string; fileId: string; applicantName?: string }
): PendingB2cActionRow[] {
  const rows: PendingB2cActionRow[] = [];

  for (const item of COMPLIANCE_ITEMS) {
    const requestedAt = readString(formData[item.requestedAtKey]);
    if (!requestedAt) continue;
    if (isComplianceChecked(formData, item.checkboxKey)) continue;
    rows.push({
      applicationId: context.applicationId,
      fileId: context.fileId,
      applicantName: context.applicantName,
      type: 'compliance',
      itemId: item.id,
      label: item.requestLabel,
      requestedAt,
    });
  }

  const doRequestedAt = readString(formData['_meta.doRequest.requestedAt']);
  if (doRequestedAt && hasOpenDoRequest(formData)) {
    rows.push({
      applicationId: context.applicationId,
      fileId: context.fileId,
      applicantName: context.applicantName,
      type: 'do',
      label: 'Disbursement Order (DO)',
      requestedAt: doRequestedAt,
      queryId: readString(formData['_meta.doRequest.queryId']) || undefined,
    });
  }

  return rows;
}

export function scanApplicationsForPendingB2cActions(
  applications: Record<string, unknown>[],
  options?: { activeStatuses?: Set<string>; limit?: number }
): PendingB2cActionRow[] {
  const limit = options?.limit ?? 20;
  const activeStatuses =
    options?.activeStatuses ??
    new Set(['draft', 'under_kam_review', 'query_with_client', 'pending_credit_review']);

  const rows: PendingB2cActionRow[] = [];

  for (const app of applications) {
    const status = resolveApplicationRecordStatus(app);
    if (!activeStatuses.has(status)) continue;

    const rawForm = app['Form Data'] ?? app.formData ?? app.form_data;
    let formData: Record<string, unknown> = {};
    if (typeof rawForm === 'string') {
      try {
        formData = JSON.parse(rawForm) as Record<string, unknown>;
      } catch {
        formData = {};
      }
    } else if (rawForm && typeof rawForm === 'object') {
      formData = rawForm as Record<string, unknown>;
    }

    if (readString(formData['_meta.formTemplate']) !== 'b2c_ev_v1') continue;

    const recordId = String(app.id ?? app['Record ID'] ?? '').trim();
    const fileId = String(app['File ID'] ?? app.fileId ?? '').trim();
    const applicationId = recordId || fileId;
    const applicantName = String(
      app['Applicant Name'] ?? app.applicantName ?? formData['borrower.customerName'] ?? ''
    ).trim();

    rows.push(
      ...extractPendingB2cActionsFromFormData(formData, {
        applicationId,
        fileId,
        applicantName: applicantName || undefined,
      })
    );

    if (rows.length >= limit) break;
  }

  return rows.slice(0, limit);
}
