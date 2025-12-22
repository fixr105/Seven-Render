/**
 * Module 3: Status History Service
 * 
 * Manages status change history and timeline
 */

import { LoanStatus } from '../../config/constants.js';
import { n8nClient } from '../airtable/n8nClient.js';
import { logStatusChange } from '../../utils/adminLogger.js';
import { AuthUser } from '../auth/auth.service.js';

/**
 * Status history entry
 */
export interface StatusHistoryEntry {
  fromStatus: LoanStatus | string;
  toStatus: LoanStatus | string;
  changedAt: string;
  changedBy: string;
  reason?: string;
  fileId: string;
}

/**
 * Get status history for an application
 * Reads from File Auditing Log where Action/Event Type = 'status_change'
 * 
 * @param fileId - File ID of the application
 * @returns Array of status history entries
 */
export async function getStatusHistory(fileId: string): Promise<StatusHistoryEntry[]> {
  try {
    const auditLogs = await n8nClient.fetchTable('File Auditing Log');
    
    // Filter for status change entries for this file
    const statusChangeLogs = auditLogs
      .filter((log: any) => 
        log.File === fileId && 
        (log['Action/Event Type'] === 'status_change' || log['Action/Event Type'] === 'forward_to_credit')
      )
      .map((log: any) => {
        // Parse status change from message
        const message = log['Details/Message'] || '';
        const statusMatch = message.match(/from (\w+) to (\w+)/i) || 
                           message.match(/Status changed from (\w+) to (\w+)/i);
        
        return {
          fromStatus: statusMatch ? statusMatch[1] : 'unknown',
          toStatus: statusMatch ? statusMatch[2] : 'unknown',
          changedAt: log.Timestamp || log.timestamp,
          changedBy: log.Actor || log.actor,
          reason: log['Details/Message'] || '',
          fileId: log.File || fileId,
        };
      })
      .sort((a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime());

    return statusChangeLogs;
  } catch (error) {
    console.error('[StatusHistory] Error fetching status history:', error);
    return [];
  }
}

/**
 * Record status change in audit log
 * 
 * @param user - User making the change
 * @param fileId - File ID
 * @param fromStatus - Previous status
 * @param toStatus - New status
 * @param reason - Optional reason for change
 */
export async function recordStatusChange(
  user: AuthUser,
  fileId: string,
  fromStatus: LoanStatus | string,
  toStatus: LoanStatus | string,
  reason?: string
): Promise<void> {
  // Log to File Auditing Log
  await n8nClient.postFileAuditLog({
    id: `AUDIT-${Date.now()}`,
    'Log Entry ID': `AUDIT-${Date.now()}`,
    File: fileId,
    Timestamp: new Date().toISOString(),
    Actor: user.email,
    'Action/Event Type': 'status_change',
    'Details/Message': reason 
      ? `Status changed from ${fromStatus} to ${toStatus}: ${reason}`
      : `Status changed from ${fromStatus} to ${toStatus}`,
    'Target User/Role': getTargetRoleForStatus(toStatus as LoanStatus),
    Resolved: 'False',
  });

  // Log to Admin Activity Log (via Module 0)
  await logStatusChange(user, fileId, fromStatus, toStatus, reason);
}

/**
 * Get target role for a status (who should be notified)
 */
function getTargetRoleForStatus(status: LoanStatus): string {
  const roleMap: Record<LoanStatus, string> = {
    [LoanStatus.DRAFT]: 'client',
    [LoanStatus.UNDER_KAM_REVIEW]: 'kam',
    [LoanStatus.QUERY_WITH_CLIENT]: 'client',
    [LoanStatus.PENDING_CREDIT_REVIEW]: 'credit_team',
    [LoanStatus.CREDIT_QUERY_WITH_KAM]: 'kam',
    [LoanStatus.IN_NEGOTIATION]: 'credit_team',
    [LoanStatus.SENT_TO_NBFC]: 'nbfc',
    [LoanStatus.APPROVED]: 'credit_team',
    [LoanStatus.REJECTED]: 'client',
    [LoanStatus.DISBURSED]: 'client',
    [LoanStatus.WITHDRAWN]: 'kam',
    [LoanStatus.CLOSED]: 'credit_team',
  };
  return roleMap[status] || 'credit_team';
}


