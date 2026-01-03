/**
 * Module 0: Admin Logging Helper
 * 
 * Wraps POSTLOG webhook calls to ensure every major action logs exactly once
 * to Admin Activity Log via n8n POSTLOG webhook
 */

import { n8nConfig } from '../config/airtable.js';
import { n8nApiClient } from '../services/airtable/n8nApiClient.js';
import { AuthUser } from '../services/auth/auth.service.js';

/**
 * Action types for admin logging
 */
export enum AdminActionType {
  // Application actions
  CREATE_APPLICATION = 'create_application',
  SUBMIT_APPLICATION = 'submit_application',
  UPDATE_APPLICATION = 'update_application',
  SAVE_DRAFT = 'save_draft',
  
  // Status changes
  STATUS_CHANGE = 'status_change',
  FORWARD_TO_CREDIT = 'forward_to_credit',
  ASSIGN_NBFC = 'assign_nbfc',
  MARK_DISBURSED = 'mark_disbursed',
  MARK_REJECTED = 'mark_rejected',
  CLOSE_FILE = 'close_file',
  
  // Client management
  CREATE_CLIENT = 'create_client',
  UPDATE_CLIENT = 'update_client',
  CONFIGURE_FORM = 'configure_form',
  
  // Ledger actions
  CREATE_LEDGER_ENTRY = 'create_ledger_entry',
  CREATE_PAYOUT_REQUEST = 'create_payout_request',
  APPROVE_PAYOUT = 'approve_payout',
  REJECT_PAYOUT = 'reject_payout',
  
  // Query actions
  RAISE_QUERY = 'raise_query',
  REPLY_TO_QUERY = 'reply_to_query',
  RESOLVE_QUERY = 'resolve_query',
  
  // Other
  LOGIN = 'login',
  LOGOUT = 'logout',
  GENERATE_REPORT = 'generate_report',
  GENERATE_AI_SUMMARY = 'generate_ai_summary',
}

/**
 * Admin activity log entry structure
 */
export interface AdminActivityLogEntry {
  id: string;
  'Activity ID': string;
  Timestamp: string;
  'Performed By': string;
  'Action Type': AdminActionType | string;
  'Description/Details': string;
  'Target Entity': string;
  'Related File ID'?: string;
  'Related Client ID'?: string;
  'Related User ID'?: string;
  Metadata?: string; // JSON string for additional data
}

/**
 * Options for logging admin activity
 */
export interface LogAdminActivityOptions {
  actionType: AdminActionType | string;
  description: string;
  targetEntity: string;
  relatedFileId?: string;
  relatedClientId?: string;
  relatedUserId?: string;
  metadata?: Record<string, any>;
}

/**
 * Log admin activity to Admin Activity Log via POSTLOG webhook
 * 
 * This ensures every major action logs exactly once to the audit trail.
 * 
 * @param user - The user performing the action
 * @param options - Activity details
 * @returns Promise resolving to the logged activity entry
 */
export async function logAdminActivity(
  user: AuthUser,
  options: LogAdminActivityOptions
): Promise<AdminActivityLogEntry> {
  const activityId = `ACT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const timestamp = new Date().toISOString();

  const logEntry: AdminActivityLogEntry = {
    id: activityId,
    'Activity ID': activityId,
    Timestamp: timestamp,
    'Performed By': user.email,
    'Action Type': options.actionType,
    'Description/Details': options.description,
    'Target Entity': options.targetEntity,
  };

  // Add optional fields
  if (options.relatedFileId) {
    logEntry['Related File ID'] = options.relatedFileId;
  }
  if (options.relatedClientId) {
    logEntry['Related Client ID'] = options.relatedClientId;
  }
  if (options.relatedUserId) {
    logEntry['Related User ID'] = options.relatedUserId;
  }
  if (options.metadata) {
    logEntry.Metadata = JSON.stringify(options.metadata);
  }

  try {
    // Call POSTLOG webhook via n8nApiClient
    const response = await n8nApiClient.post(n8nConfig.postLogUrl, logEntry);

    if (!response.success) {
      console.error('[AdminLogger] Failed to log admin activity:', response.error);
      // Don't throw - logging failure shouldn't break the main operation
      // But log the error for debugging
    } else {
      console.log(`[AdminLogger] Logged activity: ${options.actionType} by ${user.email}`);
    }

    return logEntry;
  } catch (error: any) {
    console.error('[AdminLogger] Error logging admin activity:', error);
    // Don't throw - logging failure shouldn't break the main operation
    return logEntry;
  }
}

/**
 * Convenience function for logging application actions
 */
export async function logApplicationAction(
  user: AuthUser,
  actionType: AdminActionType,
  fileId: string,
  description: string,
  metadata?: Record<string, any>
): Promise<AdminActivityLogEntry> {
  return logAdminActivity(user, {
    actionType,
    description,
    targetEntity: 'loan_application',
    relatedFileId: fileId,
    metadata,
  });
}

/**
 * Convenience function for logging client actions
 */
export async function logClientAction(
  user: AuthUser,
  actionType: AdminActionType,
  clientId: string,
  description: string,
  metadata?: Record<string, any>
): Promise<AdminActivityLogEntry> {
  return logAdminActivity(user, {
    actionType,
    description,
    targetEntity: 'client',
    relatedClientId: clientId,
    metadata,
  });
}

/**
 * Convenience function for logging status changes
 */
export async function logStatusChange(
  user: AuthUser,
  fileId: string,
  oldStatus: string,
  newStatus: string,
  reason?: string
): Promise<AdminActivityLogEntry> {
  const description = reason
    ? `Status changed from ${oldStatus} to ${newStatus}: ${reason}`
    : `Status changed from ${oldStatus} to ${newStatus}`;

  return logApplicationAction(user, AdminActionType.STATUS_CHANGE, fileId, description, {
    oldStatus,
    newStatus,
    reason,
  });
}










