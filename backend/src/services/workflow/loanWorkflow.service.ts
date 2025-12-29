/**
 * Loan Workflow Service
 * 
 * Handles loan file workflow logic including:
 * 1. New loan submissions (set status to 'Under KAM Review')
 * 2. Forward to Credit Team (update status and notify)
 * 3. Status transitions with proper notifications
 * 
 * Mirrors workflow logic from PRD Section 3.2
 */

import { n8nClient } from '../airtable/n8nClient.js';
import { LoanStatus, UserRole } from '../../config/constants.js';
import { validateTransition } from '../statusTracking/statusStateMachine.js';
import { recordStatusChange } from '../statusTracking/statusHistory.service.js';
import { centralizedLogger } from '../logging/centralizedLogger.service.js';
import { AuthUser } from '../auth/auth.service.js';

/**
 * Options for creating a new loan application
 */
export interface CreateLoanApplicationOptions {
  clientId: string;
  productId?: string;
  applicantName?: string;
  requestedLoanAmount?: string;
  formData?: Record<string, any>;
  documents?: string; // Comma-separated document URLs
  saveAsDraft?: boolean;
}

/**
 * Options for forwarding to credit team
 */
export interface ForwardToCreditOptions {
  fileId: string;
  notes?: string;
  assignedCreditAnalystId?: string;
}

/**
 * Loan Workflow Service
 */
export class LoanWorkflowService {
  /**
   * Create new loan application
   * 
   * When a file is uploaded/submitted:
   * - If saveAsDraft=false: Set status to 'Under KAM Review'
   * - If saveAsDraft=true: Set status to 'Draft'
   * - Log to AdminActivityLog and FileAuditingLog
   * - Create notification for KAM (if submitted)
   * 
   * @param user - User creating the application (must be CLIENT)
   * @param options - Application data
   * @returns Created application data
   */
  async createLoanApplication(
    user: AuthUser,
    options: CreateLoanApplicationOptions
  ): Promise<{ applicationId: string; fileId: string; status: LoanStatus }> {
    // Verify user is a client
    if (user.role !== UserRole.CLIENT) {
      throw new Error('Only clients can create loan applications');
    }

    // Generate File ID
    const timestamp = Date.now().toString(36).toUpperCase();
    const fileId = `SF${timestamp.slice(-8)}`;
    const applicationId = `APP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Determine status - if saveAsDraft is false, set to UNDER_KAM_REVIEW, otherwise DRAFT
    const status = options.saveAsDraft ? LoanStatus.DRAFT : LoanStatus.UNDER_KAM_REVIEW;

    // Get form config version for versioning
    const { getLatestFormConfigVersion } = await import('../formConfigVersioning.js');
    const formConfigVersion = await getLatestFormConfigVersion(options.clientId).catch(() => null);

    // Create application data
    const applicationData: any = {
      id: applicationId,
      'File ID': fileId,
      Client: options.clientId,
      'Applicant Name': options.applicantName || '',
      'Loan Product': options.productId || '',
      'Requested Loan Amount': options.requestedLoanAmount ? String(options.requestedLoanAmount) : '',
      Status: status,
      'Creation Date': new Date().toISOString().split('T')[0],
      'Last Updated': new Date().toISOString(),
      'Form Data': options.formData ? JSON.stringify(options.formData) : '',
      'Form Config Version': formConfigVersion || '',
      Documents: options.documents || '',
    };

    // Add submitted date if not a draft
    if (!options.saveAsDraft) {
      applicationData['Submitted Date'] = new Date().toISOString().split('T')[0];
    }

    // Create application via Loan Files webhook
    await n8nClient.postLoanApplication(applicationData);

    // Log application creation
    await centralizedLogger.logApplicationCreated(
      user,
      fileId,
      options.clientId,
      options.applicantName
    );

    // If submitted (not draft), log status change and notify KAM
    if (!options.saveAsDraft) {
      // Log status change
      await centralizedLogger.logStatusChange(
        user,
        fileId,
        LoanStatus.DRAFT,
        LoanStatus.UNDER_KAM_REVIEW,
        'Application submitted by client'
      );

      // Get client's assigned KAM for notification
      const clients = await n8nClient.fetchTable('Clients');
      const client = clients.find((c: any) => 
        c.id === options.clientId || 
        c['Client ID'] === options.clientId
      );

      if (client && client['Assigned KAM']) {
        // Create notification for KAM
        await this.createNotification({
          recipientUserId: client['Assigned KAM'],
          recipientRole: UserRole.KAM,
          relatedFileId: fileId,
          relatedClientId: options.clientId,
          notificationType: 'application_submitted',
          title: 'New Application Submitted',
          message: `New loan application submitted: ${fileId}${options.applicantName ? ` (${options.applicantName})` : ''}`,
          channel: 'in_app',
        });
      }
    }

    return {
      applicationId,
      fileId,
      status,
    };
  }

  /**
   * Forward application to Credit Team
   * 
   * When KAM forwards an application:
   * - Updates status from 'Under KAM Review' to 'Pending Credit Review'
   * - Validates status transition using state machine
   * - Records status change in history
   * - Logs to AdminActivityLog and FileAuditingLog
   * - Notifies Credit Team
   * 
   * @param user - User forwarding (must be KAM)
   * @param options - Forward options
   */
  async forwardToCreditTeam(
    user: AuthUser,
    options: ForwardToCreditOptions
  ): Promise<void> {
    // Verify user is a KAM
    if (user.role !== UserRole.KAM) {
      throw new Error('Only KAM users can forward applications to credit team');
    }

    // Fetch application
    const applications = await n8nClient.fetchTable('Loan Application');
    const application = applications.find((app: any) => 
      app.id === options.fileId || 
      app['File ID'] === options.fileId
    );

    if (!application) {
      throw new Error(`Application not found: ${options.fileId}`);
    }

    const previousStatus = application.Status as LoanStatus;
    const newStatus = LoanStatus.PENDING_CREDIT_REVIEW;

    // Validate status transition
    validateTransition(previousStatus, newStatus, user.role);

    // Update application status
    const updateData: any = {
      ...application,
      Status: newStatus,
      'Last Updated': new Date().toISOString(),
    };

    // Assign credit analyst if specified
    if (options.assignedCreditAnalystId) {
      updateData['Assigned Credit Analyst'] = options.assignedCreditAnalystId;
    }

    await n8nClient.postLoanApplication(updateData);

    // Record status change in history
    await recordStatusChange(
      user,
      application['File ID'],
      previousStatus,
      newStatus,
      options.notes || 'Application forwarded to credit team by KAM'
    );

    // Log status change
    await centralizedLogger.logStatusChange(
      user,
      application['File ID'],
      previousStatus,
      newStatus,
      options.notes || 'Application forwarded to credit team'
    );

    // Notify Credit Team
    await this.notifyCreditTeam(application['File ID'], application.Client, options.notes);
  }

  /**
   * Notify Credit Team about forwarded application
   */
  private async notifyCreditTeam(
    fileId: string,
    clientId: string,
    notes?: string
  ): Promise<void> {
    try {
      // Fetch all credit team users
      const creditUsers = await n8nClient.fetchTable('Credit Team Users');
      const activeCreditUsers = creditUsers.filter((u: any) => 
        u.Status === 'Active' || u.active === true
      );

      // Create notifications for all active credit team users
      const notificationPromises = activeCreditUsers.map((creditUser: any) => {
        const recipientUserId = creditUser.id || creditUser['Credit User ID'];
        
        return this.createNotification({
          recipientUserId,
          recipientRole: UserRole.CREDIT,
          relatedFileId: fileId,
          relatedClientId: clientId,
          notificationType: 'application_forwarded',
          title: 'Application Forwarded to Credit',
          message: `Application ${fileId} has been forwarded to credit team${notes ? `: ${notes}` : ''}`,
          channel: 'in_app',
          actionLink: `/applications/${fileId}`,
        });
      });

      await Promise.all(notificationPromises);
    } catch (error: any) {
      console.error('[LoanWorkflowService] Failed to notify credit team:', error);
      // Don't throw - notification failure shouldn't break the workflow
    }
  }

  /**
   * Create notification
   */
  private async createNotification(data: {
    recipientUserId?: string;
    recipientRole?: UserRole;
    relatedFileId?: string;
    relatedClientId?: string;
    notificationType: string;
    title: string;
    message: string;
    channel: 'email' | 'in_app' | 'both';
    actionLink?: string;
  }): Promise<void> {
    try {
      const notificationId = `NOTIF-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      await n8nClient.postNotification({
        id: notificationId,
        'Notification ID': notificationId,
        'Recipient User': data.recipientUserId || '',
        'Recipient Role': data.recipientRole || '',
        'Related File': data.relatedFileId || '',
        'Related Client': data.relatedClientId || '',
        'Notification Type': data.notificationType,
        'Title': data.title,
        'Message': data.message,
        'Channel': data.channel,
        'Is Read': 'False',
        'Created At': new Date().toISOString(),
        'Action Link': data.actionLink || '',
      });
    } catch (error: any) {
      console.error('[LoanWorkflowService] Failed to create notification:', error);
      // Don't throw - notification failure shouldn't break the workflow
    }
  }

  /**
   * Get application status workflow information
   * 
   * Returns current status and allowed next statuses for a user role
   */
  async getWorkflowInfo(
    fileId: string,
    userRole: UserRole
  ): Promise<{
    currentStatus: LoanStatus;
    allowedNextStatuses: LoanStatus[];
    statusDisplayName: string;
  }> {
    const applications = await n8nClient.fetchTable('Loan Application');
    const application = applications.find((app: any) => 
      app.id === fileId || 
      app['File ID'] === fileId
    );

    if (!application) {
      throw new Error(`Application not found: ${fileId}`);
    }

    const currentStatus = application.Status as LoanStatus;
    const { getAllowedNextStatuses, getStatusDisplayName } = await import('../statusTracking/statusStateMachine.js');
    
    return {
      currentStatus,
      allowedNextStatuses: getAllowedNextStatuses(currentStatus, userRole),
      statusDisplayName: getStatusDisplayName(currentStatus),
    };
  }
}

// Export singleton instance
export const loanWorkflowService = new LoanWorkflowService();

