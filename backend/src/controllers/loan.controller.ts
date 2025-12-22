/**
 * Loan Applications Controller
 * Handles loan application CRUD operations
 */

import { Request, Response } from 'express';
import { n8nClient } from '../services/airtable/n8nClient.js';
import { dataFilterService } from '../services/airtable/dataFilter.service.js';
import { LoanStatus } from '../config/constants.js';
import { logApplicationAction, AdminActionType } from '../utils/adminLogger.js';

export class LoanController {
  /**
   * POST /loan-applications
   * Create draft application (CLIENT only)
   * Accepts: productId, applicantName, requestedLoanAmount, formData (optional)
   * OR: productId, borrowerIdentifiers (legacy format)
   */
  async createApplication(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'client') {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      const { 
        productId, 
        borrowerIdentifiers, 
        applicantName, 
        requestedLoanAmount, 
        formData,
        documentUploads, // Module 2: Array of { fieldId, fileUrl, fileName } from OneDrive
        saveAsDraft = true 
      } = req.body;

      // Support both new format (applicantName, requestedLoanAmount, formData) and legacy format (borrowerIdentifiers)
      const finalApplicantName = applicantName || borrowerIdentifiers?.name || '';
      const finalRequestedAmount = requestedLoanAmount || '';
      const finalFormData = formData || {};

      // Module 2: Duplicate detection (PAN) - warn but allow
      const { checkDuplicateByPAN } = await import('../services/validation/duplicateDetection.service.js');
      const panValue = finalFormData.pan || finalFormData.pan_card || finalFormData.pan_number;
      const duplicateCheck = panValue 
        ? await checkDuplicateByPAN(panValue, req.user!.clientId)
        : null;
      
      const validationWarnings: string[] = [];
      if (duplicateCheck) {
        validationWarnings.push(
          `Warning: A similar application exists (File ID: ${duplicateCheck.fileId}, Status: ${duplicateCheck.status}). ` +
          `Please verify this is not a duplicate before submitting.`
        );
      }

      // Module 2: Soft validation - check required fields but allow submission with warnings
      const { validateFormData } = await import('../services/validation/formValidation.service.js');
      // Fetch form config for validation
      let formConfig: any[] = [];
      try {
        const mappings = await n8nClient.fetchTable('Client Form Mapping');
        const categories = await n8nClient.fetchTable('Form Categories');
        const fields = await n8nClient.fetchTable('Form Fields');
        
        const clientMappings = mappings.filter((m: any) => 
          m.Client === req.user!.clientId || m.Client === req.user!.clientId?.toString()
        );
        const mappedCategoryIds = new Set(clientMappings.map((m: any) => m.Category));
        
        formConfig = categories
          .filter((cat: any) => mappedCategoryIds.has(cat['Category ID'] || cat.id))
          .map((cat: any) => ({
            categoryId: cat['Category ID'] || cat.id,
            fields: fields
              .filter((f: any) => (f.Category || f.category) === (cat['Category ID'] || cat.id))
              .map((f: any) => ({
                fieldId: f['Field ID'] || f.id,
                label: f['Field Label'] || f.fieldLabel,
                type: f['Field Type'] || f.fieldType,
                isRequired: f['Is Mandatory'] === 'True' || f.isMandatory === true,
              })),
          }));
      } catch (configError) {
        console.warn('[createApplication] Could not fetch form config for validation:', configError);
      }

      // Perform validation (soft - warnings only)
      const validationResult = formConfig.length > 0
        ? validateFormData(finalFormData, formConfig, {}) // Files handled separately
        : { isValid: true, warnings: [], errors: [], missingRequiredFields: [] };
      
      validationWarnings.push(...validationResult.warnings);

      // Generate File ID
      const timestamp = Date.now().toString(36).toUpperCase();
      const fileId = `SF${timestamp.slice(-8)}`;
      const applicationId = `APP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Determine status - if saveAsDraft is false, set to UNDER_KAM_REVIEW, otherwise DRAFT
      const status = saveAsDraft ? LoanStatus.DRAFT : LoanStatus.UNDER_KAM_REVIEW;

      // Module 1: Get current form config version for this client (for versioning)
      const { getLatestFormConfigVersion } = await import('../services/formConfigVersioning.js');
      const formConfigVersion = await getLatestFormConfigVersion(req.user!.clientId!);

      // Module 2: Process document uploads - store OneDrive links
      const documentLinks: Record<string, string> = {};
      if (documentUploads && Array.isArray(documentUploads)) {
        documentUploads.forEach((upload: any) => {
          if (upload.fieldId && upload.fileUrl) {
            // Store as fieldId:fileUrl format
            documentLinks[upload.fieldId] = upload.fileUrl;
            // Also add to form data
            finalFormData[upload.fieldId] = upload.fileUrl;
            if (upload.fileName) {
              finalFormData[`${upload.fieldId}_fileName`] = upload.fileName;
            }
          }
        });
      }

      // Module 2: If submitting with warnings/issues, mark for KAM attention
      const needsAttention = !saveAsDraft && validationWarnings.length > 0;
      if (needsAttention) {
        // Status will be UNDER_KAM_REVIEW but with attention flag
        // KAM will see this in their "needs attention" list
      }

      // Create application in Airtable with all provided data
      const applicationData: any = {
        id: applicationId,
        'File ID': fileId,
        Client: req.user.clientId!,
        'Applicant Name': finalApplicantName,
        'Loan Product': productId,
        'Requested Loan Amount': finalRequestedAmount ? String(finalRequestedAmount) : '',
        Status: status,
        'Creation Date': new Date().toISOString().split('T')[0],
        'Last Updated': new Date().toISOString(),
        'Form Data': JSON.stringify(finalFormData),
        'Form Config Version': formConfigVersion || '', // Module 1: Store form config version
        'Document Uploads': Object.keys(documentLinks).length > 0 
          ? JSON.stringify(documentLinks) 
          : '', // Module 2: Store OneDrive document links
        'Needs Attention': needsAttention ? 'True' : 'False', // Module 2: Flag for KAM attention
        'Validation Warnings': validationWarnings.length > 0 
          ? JSON.stringify(validationWarnings) 
          : '', // Module 2: Store validation warnings
      };

      // Add submitted date if not a draft
      if (!saveAsDraft) {
        applicationData['Submitted Date'] = new Date().toISOString().split('T')[0];
      }

      const result = await n8nClient.postLoanApplication(applicationData);

      // Module 0: Use admin logger helper
      await logApplicationAction(
        req.user!,
        saveAsDraft ? AdminActionType.SAVE_DRAFT : AdminActionType.SUBMIT_APPLICATION,
        fileId,
        `${saveAsDraft ? 'Created draft' : 'Submitted'} loan application`,
        { productId, formConfigVersion }
      );

      // If submitted (not draft), also log to file audit
      if (!saveAsDraft) {
        await n8nClient.postFileAuditLog({
          id: `AUDIT-${Date.now()}`,
          'Log Entry ID': `AUDIT-${Date.now()}`,
          File: fileId,
          Timestamp: new Date().toISOString(),
          Actor: req.user.email,
          'Action/Event Type': 'status_change',
          'Details/Message': `Application submitted and moved to KAM review${needsAttention ? ' (needs attention)' : ''}`,
          'Target User/Role': 'kam',
          Resolved: 'False',
        });

        // Module 2: Auto-create query/task marker for KAM attention if issues found
        if (needsAttention) {
          await n8nClient.postFileAuditLog({
            id: `AUDIT-${Date.now()}-ATTENTION`,
            'Log Entry ID': `AUDIT-${Date.now()}-ATTENTION`,
            File: fileId,
            Timestamp: new Date().toISOString(),
            Actor: 'System',
            'Action/Event Type': 'query',
            'Details/Message': `Application submitted with validation warnings. Please review: ${validationWarnings.join('; ')}`,
            'Target User/Role': 'kam',
            Resolved: 'False',
          });
        }
      }

      res.json({
        success: true,
        data: {
          loanApplicationId: applicationId,
          fileId,
          status,
          warnings: validationWarnings, // Module 2: Return warnings to frontend
          duplicateFound: duplicateCheck ? {
            fileId: duplicateCheck.fileId,
            status: duplicateCheck.status,
          } : null,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create application',
      });
    }
  }

  /**
   * GET /loan-applications
   * List applications (filtered by role)
   * Fetches from Airtable via n8n webhooks
   */
  async listApplications(req: Request, res: Response): Promise<void> {
    try {
      const { status, dateFrom, dateTo, search } = req.query;
      const user = req.user!;

      // Fetch applications and related data from n8n webhooks
      const [applications, clients, loanProducts] = await Promise.all([
        n8nClient.fetchTable('Loan Application'),
        n8nClient.fetchTable('Clients'),
        n8nClient.fetchTable('Loan Products'),
      ]);

      // Create lookup maps for efficient filtering
      const clientsMap = new Map(clients.map((c: any) => [c['Client ID'] || c.id, c]));
      const productsMap = new Map(loanProducts.map((p: any) => [p['Product ID'] || p.id, p]));

      // Apply role-based filtering
      let filteredApplications = applications;
      
      if (user.role === 'client' && user.clientId) {
        // Clients only see their own applications
        console.log(`[LoanController] Filtering applications for client: ${user.email}, clientId: ${user.clientId}`);
        filteredApplications = filteredApplications.filter(
          (app: any) => (app.Client === user.clientId || app['Client'] === user.clientId)
        );
      } else if (user.role === 'kam' && user.kamId) {
        // KAMs see applications from their managed clients
        // Get all clients managed by this KAM
        const managedClientIds = clients
          .filter((c: any) => (c['Assigned KAM'] === user.kamId || c['KAM ID'] === user.kamId))
          .map((c: any) => c['Client ID'] || c.id);
        
        if (managedClientIds.length > 0) {
          filteredApplications = filteredApplications.filter(
            (app: any) => managedClientIds.includes(app.Client || app['Client'])
          );
        } else {
          // No managed clients, return empty
          filteredApplications = [];
        }
      } else if (user.role === 'nbfc' && user.nbfcId) {
        // NBFCs see only assigned applications
        filteredApplications = filteredApplications.filter(
          (app: any) => (app['Assigned NBFC'] === user.nbfcId || app['Assigned NBFC ID'] === user.nbfcId)
        );
      }
      // Credit team sees all (no additional filter)

      // Apply status filter
      if (status) {
        filteredApplications = filteredApplications.filter(
          (app: any) => (app.Status === status || app.status === status)
        );
      }

      // Apply date filters
      if (dateFrom) {
        filteredApplications = filteredApplications.filter((app: any) => {
          const appDate = app['Creation Date'] || app['Created At'] || app.creationDate;
          return appDate && appDate >= dateFrom;
        });
      }
      if (dateTo) {
        filteredApplications = filteredApplications.filter((app: any) => {
          const appDate = app['Creation Date'] || app['Created At'] || app.creationDate;
          return appDate && appDate <= dateTo;
        });
      }

      // Apply search filter
      if (search) {
        const searchLower = (search as string).toLowerCase();
        filteredApplications = filteredApplications.filter((app: any) => {
          const fileId = (app['File ID'] || app.fileId || '').toLowerCase();
          const applicantName = (app['Applicant Name'] || app.applicantName || '').toLowerCase();
          const client = clientsMap.get(app.Client || app['Client']);
          const clientName = (client?.['Client Name'] || client?.['Client Name'] || '').toLowerCase();
          
          return fileId.includes(searchLower) || 
                 applicantName.includes(searchLower) || 
                 clientName.includes(searchLower);
        });
      }

      // Sort by creation date (newest first)
      filteredApplications.sort((a: any, b: any) => {
        const dateA = new Date(a['Creation Date'] || a['Created At'] || a.creationDate || 0);
        const dateB = new Date(b['Creation Date'] || b['Created At'] || b.creationDate || 0);
        return dateB.getTime() - dateA.getTime();
      });

      // Transform to API response format
      res.json({
        success: true,
        data: filteredApplications.map((app: any) => {
          const client = clientsMap.get(app.Client || app['Client']);
          const product = productsMap.get(app['Loan Product'] || app.loanProduct);
          
          return {
            id: app.id,
            fileId: app['File ID'] || app.fileId,
            client: client?.['Client Name'] || client?.['Client Name'] || app.Client || app['Client'],
            clientId: app.Client || app['Client'],
            applicantName: app['Applicant Name'] || app.applicantName,
            product: product?.['Product Name'] || product?.['Product Name'] || app['Loan Product'] || app.loanProduct,
            productId: app['Loan Product'] || app.loanProduct,
            requestedAmount: app['Requested Loan Amount'] || app.requestedLoanAmount,
            status: app.Status || app.status,
            creationDate: app['Creation Date'] || app['Created At'] || app.creationDate,
            submittedDate: app['Submitted Date'] || app.submittedDate,
            lastUpdated: app['Last Updated'] || app.updatedAt || app.lastUpdated,
            assignedCreditAnalyst: app['Assigned Credit Analyst'] || app.assignedCreditAnalyst,
            assignedNBFC: app['Assigned NBFC'] || app.assignedNBFC,
            lenderDecisionStatus: app['Lender Decision Status'] || app.lenderDecisionStatus,
            lenderDecisionDate: app['Lender Decision Date'] || app.lenderDecisionDate,
            lenderDecisionRemarks: app['Lender Decision Remarks'] || app.lenderDecisionRemarks,
            approvedAmount: app['Approved Loan Amount'] || app.approvedLoanAmount,
            formData: app['Form Data'] ? (typeof app['Form Data'] === 'string' ? JSON.parse(app['Form Data']) : app['Form Data']) : {},
          };
        }),
      });
    } catch (error: any) {
      console.error('[LoanController] Error fetching applications:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch applications',
      });
    }
  }

  /**
   * GET /loan-applications/:id
   * Get single application
   */
  async getApplication(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      // Fetch only the tables we need
      const [applications, auditLogs] = await Promise.all([
        n8nClient.fetchTable('Loan Application'),
        n8nClient.fetchTable('File Auditing Log'),
      ]);

      let application = applications.find((app) => app.id === id);

      if (!application) {
        res.status(404).json({ success: false, error: 'Application not found' });
        return;
      }

      // Check access permissions
      const filtered = dataFilterService.filterLoanApplications([application], req.user!);
      if (filtered.length === 0) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }

      // Get audit log for this file
      const fileAuditLog = auditLogs
        .filter((log) => log.File === application!['File ID'])
        .map((log) => ({
          id: log.id,
          timestamp: log.Timestamp,
          actor: log.Actor,
          actionType: log['Action/Event Type'],
          message: log['Details/Message'],
          resolved: log.Resolved === 'True',
        }));

      res.json({
        success: true,
        data: {
          ...application,
          formData: application['Form Data'] ? JSON.parse(application['Form Data']) : {},
          auditLog: fileAuditLog,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch application',
      });
    }
  }

  /**
   * POST /loan-applications/:id/form
   * Update draft application form data (CLIENT only)
   */
  async updateApplicationForm(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'client') {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      const { id } = req.params;
      const { formData, documentUploads } = req.body;
      // Fetch only Loan Application table
      const applications = await n8nClient.fetchTable('Loan Application');
      const application = applications.find((app) => app.id === id);

      if (!application || application.Client !== req.user.clientId) {
        res.status(404).json({ success: false, error: 'Application not found' });
        return;
      }

      // Only allow updates in DRAFT or QUERY_WITH_CLIENT status
      if (
        application.Status !== LoanStatus.DRAFT &&
        application.Status !== LoanStatus.QUERY_WITH_CLIENT
      ) {
        res.status(400).json({
          success: false,
          error: 'Application cannot be edited in current status',
        });
        return;
      }

      // Module 1: For drafts, preserve existing form config version or update to latest
      // Submitted files keep their frozen version
      let formConfigVersion = application['Form Config Version'] || application.formConfigVersion;
      if (!formConfigVersion && application.Status === LoanStatus.DRAFT) {
        // Draft without version - get latest
        const { getLatestFormConfigVersion } = await import('../services/formConfigVersioning.js');
        formConfigVersion = await getLatestFormConfigVersion(req.user!.clientId!) || '';
      }

      // Update form data
      const updatedData: any = {
        ...application,
        'Form Data': JSON.stringify(formData || {}),
        'Last Updated': new Date().toISOString(),
        'Form Config Version': formConfigVersion || '', // Module 1: Preserve or update version
      };

      // Handle document uploads
      if (documentUploads && documentUploads.length > 0) {
        const documents = application.Documents
          ? application.Documents.split(',').filter(Boolean)
          : [];
        documentUploads.forEach((doc: any) => {
          documents.push(`${doc.fieldId}:${doc.fileUrl}`);
        });
        updatedData.Documents = documents.join(',');
      }

      await n8nClient.postLoanApplication(updatedData);

      // Module 0: Use admin logger helper
      await logApplicationAction(
        req.user!,
        AdminActionType.SAVE_DRAFT,
        application['File ID'],
        'Updated draft application form data',
        { formConfigVersion }
      );

      // Log to file audit
      await n8nClient.postFileAuditLog({
        id: `AUDIT-${Date.now()}`,
        'Log Entry ID': `AUDIT-${Date.now()}`,
        File: application['File ID'],
        Timestamp: new Date().toISOString(),
        Actor: req.user.email,
        'Action/Event Type': 'update_form_data',
        'Details/Message': 'Application form data updated',
        'Target User/Role': 'client',
        Resolved: 'False',
      });

      res.json({
        success: true,
        message: 'Application form updated successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update application form',
      });
    }
  }

  /**
   * POST /loan-applications/:id/submit
   * Submit application (CLIENT only)
   */
  async submitApplication(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'client') {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      const { id } = req.params;
      // Fetch only Loan Application table
      const applications = await n8nClient.fetchTable('Loan Application');
      const application = applications.find((app) => app.id === id);

      if (!application || application.Client !== req.user.clientId) {
        res.status(404).json({ success: false, error: 'Application not found' });
        return;
      }

      if (
        application.Status !== LoanStatus.DRAFT &&
        application.Status !== LoanStatus.QUERY_WITH_CLIENT
      ) {
        res.status(400).json({
          success: false,
          error: 'Application cannot be submitted in current status',
        });
        return;
      }

      // TODO: Validate required fields and documents based on form-config

      // Module 1: Ensure form config version is set before submission (freeze it)
      let formConfigVersion = application['Form Config Version'] || application.formConfigVersion;
      if (!formConfigVersion) {
        // Get latest version if not set
        const { getLatestFormConfigVersion } = await import('../services/formConfigVersioning.js');
        formConfigVersion = await getLatestFormConfigVersion(req.user!.clientId!) || '';
      }

      // Module 3: Validate status transition using state machine
      const { validateTransition } = await import('../services/statusTracking/statusStateMachine.js');
      const { recordStatusChange } = await import('../services/statusTracking/statusHistory.service.js');
      
      const previousStatus = application.Status as LoanStatus;
      const newStatus = LoanStatus.UNDER_KAM_REVIEW;
      
      validateTransition(previousStatus, newStatus, req.user!.role);

      // Update status - Module 1: Freeze form config version on submission
      await n8nClient.postLoanApplication({
        ...application,
        Status: newStatus,
        'Submitted Date': new Date().toISOString().split('T')[0],
        'Last Updated': new Date().toISOString(),
        'Form Config Version': formConfigVersion, // Module 1: Freeze version on submission
      });

      // Module 3: Record status change in history
      await recordStatusChange(
        req.user!,
        application['File ID'],
        previousStatus,
        newStatus,
        'Application submitted by client'
      );

      // Module 0: Use admin logger helper
      await logApplicationAction(
        req.user!,
        AdminActionType.SUBMIT_APPLICATION,
        application['File ID'],
        'Submitted loan application',
        { formConfigVersion, statusChange: `${previousStatus} → ${newStatus}` }
      );

      res.json({
        success: true,
        message: 'Application submitted successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to submit application',
      });
    }
  }

  /**
   * POST /loan-applications/:id/withdraw
   * Withdraw application (CLIENT only)
   * Allowed statuses: DRAFT, UNDER_KAM_REVIEW, QUERY_WITH_CLIENT
   */
  async withdrawApplication(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'client') {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      const { id } = req.params;
      // Fetch only Loan Application table
      const applications = await n8nClient.fetchTable('Loan Application');
      const application = applications.find((app) => app.id === id);

      if (!application || application.Client !== req.user.clientId) {
        res.status(404).json({ success: false, error: 'Application not found' });
        return;
      }

      // Allowed statuses for withdrawal
      const allowedStatuses = [
        LoanStatus.DRAFT,
        LoanStatus.UNDER_KAM_REVIEW,
        LoanStatus.QUERY_WITH_CLIENT,
      ];

      if (!allowedStatuses.includes(application.Status as LoanStatus)) {
        res.status(400).json({
          success: false,
          error: 'Application cannot be withdrawn in current status',
        });
        return;
      }

      const previousStatus = application.Status;

      // Update status to WITHDRAWN
      await n8nClient.postLoanApplication({
        ...application,
        Status: LoanStatus.WITHDRAWN,
        'Last Updated': new Date().toISOString(),
      });

      // Log to file audit
      await n8nClient.postFileAuditLog({
        id: `AUDIT-${Date.now()}`,
        'Log Entry ID': `AUDIT-${Date.now()}`,
        File: application['File ID'],
        Timestamp: new Date().toISOString(),
        Actor: req.user.email,
        'Action/Event Type': 'client_withdrew_application',
        'Details/Message': `Application withdrawn by client. Previous status: ${previousStatus}`,
        'Target User/Role': 'kam',
        Resolved: 'False',
      });

      // Log admin activity
      await n8nClient.postAdminActivityLog({
        id: `ACT-${Date.now()}`,
        'Activity ID': `ACT-${Date.now()}`,
        Timestamp: new Date().toISOString(),
        'Performed By': req.user.email,
        'Action Type': 'withdraw_application',
        'Description/Details': `Client withdrew loan application ${application['File ID']}. Previous status: ${previousStatus}`,
        'Target Entity': 'loan_application',
      });

      res.json({
        success: true,
        message: 'Application withdrawn successfully',
        data: {
          applicationId: application.id,
          fileId: application['File ID'],
          previousStatus,
          newStatus: LoanStatus.WITHDRAWN,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to withdraw application',
      });
    }
  }
}

export const loanController = new LoanController();

