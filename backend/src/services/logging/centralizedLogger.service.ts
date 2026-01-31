/**
 * Centralized Logging Service
 * 
 * Intercepts all major state changes and logs them to:
 * 1. AdminActivityLog - Administrative actions
 * 2. FileAuditingLog - File-specific audit trail and queries
 * 
 * This service ensures proper RBAC tracking by capturing user roles correctly.
 * 
 * During migration, this can work alongside n8n webhook logging.
 * After migration, this will be the primary logging mechanism.
 */

import { AuthUser } from '../../types/auth.js';
import { UserRole } from '../../config/constants.js';
import { AdminActionType } from '../../utils/adminLogger.js';

// Prisma client will be imported when database is set up
// import { PrismaClient } from '@prisma/client';
// const prisma = new PrismaClient();

/**
 * Options for logging admin activity
 */
export interface LogActivityOptions {
  actionType: AdminActionType | string;
  description: string;
  targetEntity: string;
  relatedFileId?: string;
  relatedClientId?: string;
  relatedUserId?: string;
  metadata?: Record<string, any>;
}

/**
 * Options for logging file audit events
 */
export interface LogFileAuditOptions {
  fileId?: string;
  actionEventType: string;
  detailsMessage: string;
  targetUserRole?: string;
  resolved?: boolean;
  metadata?: Record<string, any>;
}

/**
 * Centralized Logging Service
 */
export class CentralizedLoggerService {
  /**
   * Get user role display name for logging
   */
  private getUserRoleDisplay(user: AuthUser): string {
    const roleMap: Record<UserRole, string> = {
      [UserRole.CLIENT]: 'Client (DSA Partner)',
      [UserRole.KAM]: 'Key Account Manager (KAM)',
      [UserRole.CREDIT]: 'Credit Team',
      [UserRole.NBFC]: 'NBFC Partner',
      [UserRole.ADMIN]: 'Admin',
    };
    return roleMap[user.role] || user.role;
  }

  /**
   * Get user identifier for logging (email with role context)
   */
  private getUserIdentifier(user: AuthUser): string {
    const roleDisplay = this.getUserRoleDisplay(user);
    return `${user.email} (${roleDisplay})`;
  }

  /**
   * Log admin activity to AdminActivityLog table
   * 
   * This logs all administrative actions performed by users.
   */
  async logAdminActivity(
    user: AuthUser,
    options: LogActivityOptions
  ): Promise<void> {
    const activityId = `ACT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date();
    const userIdentifier = this.getUserIdentifier(user);

    try {
      // TODO: Replace with Prisma when database is set up
      // await prisma.adminActivityLog.create({
      //   data: {
      //     activityId,
      //     timestamp,
      //     performedById: user.id,
      //     actionType: options.actionType,
      //     description: options.description,
      //     targetEntity: options.targetEntity,
      //   },
      // });

      // For now, log to console and n8n webhook (fallback)
      console.log(`[CentralizedLogger] Admin Activity:`, {
        activityId,
        timestamp: timestamp.toISOString(),
        performedBy: userIdentifier,
        actionType: options.actionType,
        description: options.description,
        targetEntity: options.targetEntity,
        relatedFileId: options.relatedFileId,
        relatedClientId: options.relatedClientId,
        metadata: options.metadata,
      });

      // Fallback to n8n webhook during migration
      const { logAdminActivity } = await import('../../utils/adminLogger.js');
      await logAdminActivity(user, options).catch((error) => {
        console.warn('[CentralizedLogger] Fallback to n8n webhook failed:', error);
      });
    } catch (error: any) {
      console.error('[CentralizedLogger] Failed to log admin activity:', error);
      // Don't throw - logging failure shouldn't break the main operation
    }
  }

  /**
   * Log file audit event to FileAuditingLog table
   * 
   * This logs file-specific events including:
   * - Status changes
   * - Document uploads
   * - Query threads
   * - Other file-related actions
   */
  async logFileAudit(
    user: AuthUser,
    options: LogFileAuditOptions
  ): Promise<void> {
    const logEntryId = `AUDIT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date();
    const userIdentifier = this.getUserIdentifier(user);

    try {
      // TODO: Replace with Prisma when database is set up
      // await prisma.fileAuditingLog.create({
      //   data: {
      //     logEntryId,
      //     fileId: options.fileId,
      //     timestamp,
      //     actorId: user.id,
      //     actionEventType: options.actionEventType,
      //     detailsMessage: options.detailsMessage,
      //     targetUserRole: options.targetUserRole,
      //     resolved: options.resolved ?? false,
      //   },
      // });

      // For now, log to console and n8n webhook (fallback)
      console.log(`[CentralizedLogger] File Audit:`, {
        logEntryId,
        fileId: options.fileId,
        timestamp: timestamp.toISOString(),
        actor: userIdentifier,
        actionEventType: options.actionEventType,
        detailsMessage: options.detailsMessage,
        targetUserRole: options.targetUserRole,
        resolved: options.resolved ?? false,
        metadata: options.metadata,
      });

      // Fallback to n8n webhook during migration
      if (options.fileId) {
        const { n8nClient } = await import('../airtable/n8nClient.js');
        await n8nClient.postFileAuditLog({
          id: logEntryId,
          'Log Entry ID': logEntryId,
          File: options.fileId,
          Timestamp: timestamp.toISOString(),
          Actor: user.email,
          'Action/Event Type': options.actionEventType,
          'Details/Message': options.detailsMessage,
          'Target User/Role': options.targetUserRole,
          Resolved: options.resolved ? 'True' : 'False',
        }).catch((error) => {
          console.warn('[CentralizedLogger] Fallback to n8n webhook failed:', error);
        });
      }
    } catch (error: any) {
      console.error('[CentralizedLogger] Failed to log file audit:', error);
      // Don't throw - logging failure shouldn't break the main operation
    }
  }

  /**
   * Log status change (logs to both AdminActivityLog and FileAuditingLog)
   */
  async logStatusChange(
    user: AuthUser,
    fileId: string,
    oldStatus: string,
    newStatus: string,
    reason?: string
  ): Promise<void> {
    const description = reason
      ? `Status changed from ${oldStatus} to ${newStatus}: ${reason}`
      : `Status changed from ${oldStatus} to ${newStatus}`;

    // Log to Admin Activity Log
    await this.logAdminActivity(user, {
      actionType: AdminActionType.STATUS_CHANGE,
      description,
      targetEntity: 'loan_application',
      relatedFileId: fileId,
      metadata: { oldStatus, newStatus, reason },
    });

    // Log to File Audit Log
    await this.logFileAudit(user, {
      fileId,
      actionEventType: 'status_change',
      detailsMessage: description,
      targetUserRole: this.getTargetRoleForStatus(newStatus),
    });
  }

  /**
   * Log file upload/document addition
   */
  async logFileUpload(
    user: AuthUser,
    fileId: string,
    documentType: string,
    documentUrl: string
  ): Promise<void> {
    const description = `Document uploaded: ${documentType}`;

    // Log to Admin Activity Log
    await this.logAdminActivity(user, {
      actionType: AdminActionType.UPDATE_APPLICATION,
      description,
      targetEntity: 'loan_application',
      relatedFileId: fileId,
      metadata: { documentType, documentUrl },
    });

    // Log to File Audit Log
    await this.logFileAudit(user, {
      fileId,
      actionEventType: 'document_upload',
      detailsMessage: `Document uploaded: ${documentType} (${documentUrl})`,
    });
  }

  /**
   * Log query raised
   */
  async logQueryRaised(
    user: AuthUser,
    fileId: string,
    queryMessage: string,
    targetUserRole: string,
    parentQueryId?: string
  ): Promise<void> {
    // Format query message with metadata for threading
    const queryDetails = parentQueryId
      ? `[[parent:${parentQueryId}]][[status:open]] ${queryMessage}`
      : `[[status:open]] ${queryMessage}`;

    // Log to Admin Activity Log
    await this.logAdminActivity(user, {
      actionType: AdminActionType.RAISE_QUERY,
      description: `Query raised: ${queryMessage.substring(0, 100)}${queryMessage.length > 100 ? '...' : ''}`,
      targetEntity: 'loan_application',
      relatedFileId: fileId,
      metadata: { targetUserRole, parentQueryId },
    });

    // Log to File Audit Log (queries are stored here)
    await this.logFileAudit(user, {
      fileId,
      actionEventType: 'query_raised',
      detailsMessage: queryDetails,
      targetUserRole,
      resolved: false,
    });
  }

  /**
   * Log query reply
   */
  async logQueryReply(
    user: AuthUser,
    fileId: string,
    parentQueryId: string,
    replyMessage: string
  ): Promise<void> {
    // Format reply with parent reference
    const replyDetails = `[[parent:${parentQueryId}]][[status:open]] ${replyMessage}`;

    // Log to Admin Activity Log
    await this.logAdminActivity(user, {
      actionType: AdminActionType.REPLY_TO_QUERY,
      description: `Replied to query: ${replyMessage.substring(0, 100)}${replyMessage.length > 100 ? '...' : ''}`,
      targetEntity: 'loan_application',
      relatedFileId: fileId,
      metadata: { parentQueryId },
    });

    // Log to File Audit Log
    await this.logFileAudit(user, {
      fileId,
      actionEventType: 'query_reply',
      detailsMessage: replyDetails,
      resolved: false,
    });
  }

  /**
   * Log query resolved
   */
  async logQueryResolved(
    user: AuthUser,
    fileId: string,
    queryId: string
  ): Promise<void> {
    // Log to Admin Activity Log
    await this.logAdminActivity(user, {
      actionType: AdminActionType.RESOLVE_QUERY,
      description: `Query resolved: ${queryId}`,
      targetEntity: 'loan_application',
      relatedFileId: fileId,
      metadata: { queryId },
    });

    // Log to File Audit Log (update query status)
    await this.logFileAudit(user, {
      fileId,
      actionEventType: 'query_resolved',
      detailsMessage: `[[parent:${queryId}]][[status:resolved]] Query marked as resolved`,
      resolved: true,
    });
  }

  /**
   * Log application creation
   */
  async logApplicationCreated(
    user: AuthUser,
    fileId: string,
    clientId: string,
    applicantName?: string
  ): Promise<void> {
    await this.logAdminActivity(user, {
      actionType: AdminActionType.CREATE_APPLICATION,
      description: `Application created${applicantName ? ` for ${applicantName}` : ''}`,
      targetEntity: 'loan_application',
      relatedFileId: fileId,
      relatedClientId: clientId,
      metadata: { applicantName },
    });

    await this.logFileAudit(user, {
      fileId,
      actionEventType: 'application_created',
      detailsMessage: `Application created${applicantName ? ` for ${applicantName}` : ''}`,
    });
  }

  /**
   * Log application submission
   */
  async logApplicationSubmitted(
    user: AuthUser,
    fileId: string
  ): Promise<void> {
    await this.logAdminActivity(user, {
      actionType: AdminActionType.SUBMIT_APPLICATION,
      description: 'Application submitted for review',
      targetEntity: 'loan_application',
      relatedFileId: fileId,
    });

    await this.logFileAudit(user, {
      fileId,
      actionEventType: 'application_submitted',
      detailsMessage: 'Application submitted for KAM review',
      targetUserRole: 'kam',
    });
  }

  /**
   * Log client creation
   */
  async logClientCreated(
    user: AuthUser,
    clientId: string,
    clientName: string
  ): Promise<void> {
    await this.logAdminActivity(user, {
      actionType: AdminActionType.CREATE_CLIENT,
      description: `Client created: ${clientName}`,
      targetEntity: 'client',
      relatedClientId: clientId,
      metadata: { clientName },
    });
  }

  /**
   * Get target role for a status (who should be notified)
   */
  private getTargetRoleForStatus(status: string): string {
    const statusLower = status.toLowerCase();
    
    if (statusLower.includes('draft')) return 'client';
    if (statusLower.includes('kam')) return 'kam';
    if (statusLower.includes('credit')) return 'credit_team';
    if (statusLower.includes('nbfc') || statusLower.includes('sent_to')) return 'nbfc';
    if (statusLower.includes('approved') || statusLower.includes('disbursed')) return 'client';
    
    return 'kam'; // Default to KAM
  }
}

// Export singleton instance
export const centralizedLogger = new CentralizedLoggerService();

