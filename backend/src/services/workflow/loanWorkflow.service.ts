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
import {
  normalizeToCanonicalStatus,
  toUserRole,
  validateTransition,
} from '../statusTracking/statusStateMachine.js';
import { assertKAMCanMutateApplication } from '../../utils/kamApplicationAccess.js';
import { recordStatusChange } from '../statusTracking/statusHistory.service.js';
import { centralizedLogger } from '../logging/centralizedLogger.service.js';
import { AuthUser } from '../../types/auth.js';
import {
  getApplicationProductStatuses,
  getAllowedStatusesFromProduct,
  mayApplyTargetLoanStatus,
  normalizeDynamicStatus,
} from '../statusTracking/dynamicStatus.service.js';
import { resolveApplicationRecordStatus } from '../../utils/loanApplicationAirtableStatus.js';
import {
  buildPromotedApplicationRecord,
  mergeFormDataJson,
  resolveLoanApplicationPromotedFields,
} from '../../utils/loanApplicationCoreFields.js';

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
  clientSubmissionId?: string;
  metadata?: {
    formConfigVersion?: string | null;
    needsAttention?: boolean;
    validationWarnings?: string[];
  };
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
  private async verifyLoanApplicationPersisted(options: {
    fileId?: string;
    clientSubmissionId?: string;
    expectedStatus?: string;
  }): Promise<any> {
    let lastReadError: Error | null = null;

    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        const applications = await n8nClient.fetchTable('Loan Application', false);
        const found = applications.find((app: any) => {
          const appFileId = String(app['File ID'] || app.fileId || '').trim();
          const appSubmissionId = String(app['Client Submission ID'] || app.clientSubmissionId || '').trim();
          const fileIdMatches = options.fileId ? appFileId === options.fileId : false;
          const submissionMatches = options.clientSubmissionId
            ? appSubmissionId === options.clientSubmissionId
            : false;
          return fileIdMatches || submissionMatches;
        });

        if (found) {
          if (options.expectedStatus) {
            const status = resolveApplicationRecordStatus(found as Record<string, unknown>);
            const expected = resolveApplicationRecordStatus({
              Status: options.expectedStatus,
            });
            if (status !== expected) {
              if (attempt < 5) {
                await new Promise((resolve) => setTimeout(resolve, 700 * attempt));
                continue;
              }
              throw new Error(
                `Loan application persisted with unexpected status ${String(found.Status ?? found.status ?? '(empty)')}; expected ${options.expectedStatus}`
              );
            }
          }
          return found;
        }
      } catch (error) {
        lastReadError = error as Error;
      }

      if (attempt < 5) {
        await new Promise((resolve) => setTimeout(resolve, 700 * attempt));
      }
    }

    if (lastReadError) {
      throw new Error(`Loan application persistence could not be confirmed: ${lastReadError.message}`);
    }

    throw new Error(
      `Loan application persistence could not be confirmed for ${options.fileId || options.clientSubmissionId || 'unknown identifier'}`
    );
  }

  async findApplicationBySubmissionId(clientId: string, clientSubmissionId?: string): Promise<any | null> {
    if (!clientSubmissionId) return null;
    const applications = await n8nClient.fetchTable('Loan Application', false);
    return applications.find((app: any) => {
      const appClient = String(app.Client || app['Client'] || '').trim();
      const appSubmissionId = String(app['Client Submission ID'] || app.clientSubmissionId || '').trim();
      return appClient === clientId && appSubmissionId === clientSubmissionId;
    }) || null;
  }

  async findApplicationByFileId(fileId: string): Promise<any | null> {
    const normalizedFileId = String(fileId || '').trim();
    if (!normalizedFileId) return null;
    const applications = await n8nClient.fetchTable('Loan Application', false);
    return applications.find((app: any) => {
      const appFileId = String(app['File ID'] || app.fileId || '').trim();
      return appFileId === normalizedFileId;
    }) || null;
  }

  private async recoverPersistedApplication(options: {
    clientId: string;
    fileId: string;
    clientSubmissionId?: string;
    fallbackStatus: LoanStatus;
  }): Promise<{ applicationId: string; fileId: string; status: LoanStatus } | null> {
    const recovered =
      (options.clientSubmissionId
        ? await this.findApplicationBySubmissionId(options.clientId, options.clientSubmissionId)
        : null) ?? (await this.findApplicationByFileId(options.fileId));

    if (!recovered) return null;

    return {
      applicationId: String(recovered.id),
      fileId: String(recovered['File ID'] || recovered.fileId || options.fileId),
      status: String(recovered.Status || recovered.status || options.fallbackStatus) as LoanStatus,
    };
  }

  private async upsertExistingDraftApplication(
    existingApplication: Record<string, any>,
    options: CreateLoanApplicationOptions
  ): Promise<{ applicationId: string; fileId: string; status: LoanStatus }> {
    const mergedFormData = mergeFormDataJson(existingApplication, options.formData!);
    const promotedFields = resolveLoanApplicationPromotedFields(mergedFormData, existingApplication);
    const formDataToStore: Record<string, unknown> = {
      ...mergedFormData,
      applicantName: options.applicantName || promotedFields.applicantName,
      productId: options.productId || promotedFields.productId,
      requestedLoanAmount: options.requestedLoanAmount ?? promotedFields.requestedLoanAmount,
    };

    const resolvedPromoted = resolveLoanApplicationPromotedFields(formDataToStore, existingApplication);

    const updatedData = buildPromotedApplicationRecord(
      existingApplication,
      formDataToStore,
      resolvedPromoted,
      {
        'Last Updated': new Date().toISOString(),
      }
    );

    await n8nClient.postLoanApplication(updatedData, {
      strictWriteAck: false,
      operationName: 'loan application draft upsert',
    });

    return {
      applicationId: String(existingApplication.id),
      fileId: String(existingApplication['File ID'] || existingApplication.fileId || ''),
      status: String(existingApplication.Status || existingApplication.status || LoanStatus.DRAFT) as LoanStatus,
    };
  }

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
    const existingApplication = await this.findApplicationBySubmissionId(
      options.clientId,
      options.clientSubmissionId
    );
    if (existingApplication) {
      if (options.saveAsDraft && options.formData) {
        return this.upsertExistingDraftApplication(existingApplication, options);
      }
      return {
        applicationId: String(existingApplication.id),
        fileId: String(existingApplication['File ID'] || existingApplication.fileId || ''),
        status: String(existingApplication.Status || existingApplication.status || LoanStatus.DRAFT) as LoanStatus,
      };
    }

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
    const formConfigVersion =
      options.metadata?.formConfigVersion ??
      await getLatestFormConfigVersion(options.clientId).catch(() => null);

    const formDataInput = options.formData ?? {};
    const promotedFields = resolveLoanApplicationPromotedFields(formDataInput);
    const formDataToStore: Record<string, unknown> = {
      ...formDataInput,
      applicantName: options.applicantName || promotedFields.applicantName,
      productId: options.productId || promotedFields.productId,
      requestedLoanAmount: options.requestedLoanAmount ?? promotedFields.requestedLoanAmount,
    };
    const resolvedPromoted = resolveLoanApplicationPromotedFields(formDataToStore);

    const applicationData = buildPromotedApplicationRecord({}, formDataToStore, resolvedPromoted, {
      id: applicationId,
      'File ID': fileId,
      Client: options.clientId,
      Status: status,
      'Creation Date': new Date().toISOString().split('T')[0],
      'Last Updated': new Date().toISOString(),
      'Form Config Version': formConfigVersion || '',
      'Client Submission ID': options.clientSubmissionId || '',
      'Needs Attention': options.metadata?.needsAttention ? 'True' : 'False',
      'Validation Warnings': options.metadata?.validationWarnings?.length
        ? JSON.stringify(options.metadata.validationWarnings)
        : '',
    });

    if (!options.saveAsDraft) {
      applicationData['Submitted Date'] = new Date().toISOString().split('T')[0];
    }

    if (options.documents?.trim()) {
      applicationData.Documents = options.documents.trim();
    }

    // Create application via Loan Files webhook
    await n8nClient.postLoanApplication(applicationData, {
      strictWriteAck: false,
      operationName: 'loan application create',
    });
    let persistedRecord: Record<string, unknown> | null = null;
    try {
      persistedRecord = await this.verifyLoanApplicationPersisted({
        fileId,
        clientSubmissionId: options.clientSubmissionId,
        expectedStatus: status,
      });
    } catch (verifyError) {
      const recovered = await this.recoverPersistedApplication({
        clientId: options.clientId,
        fileId,
        clientSubmissionId: options.clientSubmissionId,
        fallbackStatus: status,
      });
      if (recovered) {
        return recovered;
      }
      throw verifyError;
    }

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
      applicationId: String(persistedRecord?.id ?? applicationId),
      fileId,
      status,
    };
  }

  async submitExistingLoanApplication(
    user: AuthUser,
    application: Record<string, any>,
    options: {
      formConfigVersion?: string;
      clientSubmissionId?: string;
    } = {}
  ): Promise<{ fileId: string; status: LoanStatus }> {
    const previousStatus = application.Status as LoanStatus;
    const newStatus = LoanStatus.UNDER_KAM_REVIEW;

    if (!(await mayApplyTargetLoanStatus(application, newStatus))) {
      throw new Error('Target status is not configured in Loan Products Applicable Statuses');
    }

    await n8nClient.postLoanApplication({
      ...application,
      Status: newStatus,
      'Submitted Date': new Date().toISOString().split('T')[0],
      'Last Updated': new Date().toISOString(),
      'Form Config Version': options.formConfigVersion || application['Form Config Version'] || '',
      'Client Submission ID': options.clientSubmissionId || application['Client Submission ID'] || '',
    }, {
      strictWriteAck: true,
      operationName: 'loan application submit',
    });

    await this.verifyLoanApplicationPersisted({
      fileId: String(application['File ID'] || application.fileId || ''),
      clientSubmissionId: options.clientSubmissionId || application['Client Submission ID'] || '',
      expectedStatus: newStatus,
    });

    await recordStatusChange(
      user,
      application['File ID'],
      previousStatus,
      newStatus,
      'Application submitted by client'
    );

    await centralizedLogger.logStatusChange(
      user,
      application['File ID'],
      previousStatus,
      newStatus,
      'Application submitted by client'
    );

    return {
      fileId: String(application['File ID'] || application.fileId || ''),
      status: newStatus,
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

    await assertKAMCanMutateApplication(user, application);

    const previousStatus = resolveApplicationRecordStatus(application);
    const newStatus = LoanStatus.PENDING_CREDIT_REVIEW;

    validateTransition(previousStatus, newStatus, toUserRole(user.role));

    if (!(await mayApplyTargetLoanStatus(application, newStatus))) {
      throw new Error('Target status is not configured in Loan Products Applicable Statuses');
    }

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
    allowedNextStatuses: string[];
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
    const productStatuses = await getApplicationProductStatuses(application);
    const allowedNextStatuses = getAllowedStatusesFromProduct(application, productStatuses);
    
    return {
      currentStatus,
      allowedNextStatuses,
      statusDisplayName: String(currentStatus ?? ''),
    };
  }
}

// Export singleton instance
export const loanWorkflowService = new LoanWorkflowService();

