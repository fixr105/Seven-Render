/**
 * Routes application status changes to the correct backend POST handler per role/status.
 */

import { apiService, type ApiResponse, type UserRole } from '../services/api.js';
import { normalizeStatus } from './statusUtils.js';

export interface ApplyStatusChangeParams {
  applicationId: string;
  userRole: UserRole | string | null;
  newStatus: string;
  notes?: string;
  disbursedAmount?: string;
  disbursedDate?: string;
}

export interface ApplyStatusChangeResult extends ApiResponse {
  requiresDisbursementFields?: boolean;
}

export function statusRequiresDisbursementFields(status: string): boolean {
  return normalizeStatus(status) === 'disbursed';
}

export async function applyApplicationStatusChange(
  params: ApplyStatusChangeParams
): Promise<ApplyStatusChangeResult> {
  const { applicationId, userRole, newStatus, notes, disbursedAmount, disbursedDate } = params;
  const statusKey = normalizeStatus(newStatus);

  if (!userRole) {
    return { success: false, error: 'User role is required' };
  }

  if (statusKey === 'disbursed') {
    if (!disbursedAmount?.trim()) {
      return {
        success: false,
        error: 'Disbursed amount is required',
        requiresDisbursementFields: true,
      };
    }
    const date = disbursedDate?.trim() || new Date().toISOString().split('T')[0];
    const payload = { disbursedAmount: disbursedAmount.trim(), disbursedDate: date };

    if (userRole === 'nbfc') {
      return apiService.markDisbursedNBFC(applicationId, payload);
    }
    if (userRole === 'credit_team' || userRole === 'admin') {
      return apiService.markDisbursed(applicationId, payload);
    }
    return { success: false, error: 'Only credit team or NBFC can mark applications as disbursed' };
  }

  switch (userRole) {
    case 'credit_team':
    case 'admin':
      if (statusKey === 'in_negotiation') {
        return apiService.markInNegotiation(applicationId);
      }
      if (statusKey === 'closed') {
        return apiService.closeApplication(applicationId, notes);
      }
      return apiService.updateCreditApplicationStatus(applicationId, newStatus, notes);

    case 'kam':
      return apiService.updateKAMApplicationStatus(applicationId, newStatus, notes);

    case 'nbfc':
      return {
        success: false,
        error: 'Use the decision modal to update NBFC application status',
      };

    default:
      return { success: false, error: 'Insufficient permissions to update status' };
  }
}
