/**
 * Loan Applications Controller
 * Handles loan application CRUD operations
 */

import { Request, Response } from 'express';
import { n8nClient } from '../services/airtable/n8nClient.js';
import { LoanStatus } from '../config/constants.js';
import { logApplicationAction, AdminActionType } from '../utils/adminLogger.js';
import { defaultLogger } from '../utils/logger.js';

export class LoanController {
  /**
   * POST /loan-applications
   * Create draft application (CLIENT only)
   * Accepts: productId, applicantName, requestedLoanAmount, formData (optional)
   * OR: productId, borrowerIdentifiers (legacy format)
   * 
   * Webhook Mapping:
   * - POST → n8nClient.postLoanApplication() → /webhook/loanapplications (plural) → Airtable: Loan Applications
   * - POST → n8nClient.postFileAuditLog() → /webhook/Fileauditinglog → Airtable: File Auditing Log
   * - POST → adminLogger.logApplicationAction() → /webhook/POSTLOG → Airtable: Admin Activity log
   * 
   * Frontend: src/pages/NewApplication.tsx (line 250)
   * See WEBHOOK_MAPPING_TABLE.md for complete mapping
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
      // Fetch form config for validation (Form Link + Record Titles)
      let formConfig: any[] = [];
      try {
        const { getSimpleFormConfig } = await import('../services/formConfig/simpleFormConfig.service.js');
        const config = await getSimpleFormConfig(req.user!.clientId!, productId);
        formConfig = config.categories;
      } catch (configError) {
        console.warn('[createApplication] Could not fetch form config for validation:', configError);
      }

      // Perform validation (soft - warnings only)
      const validationResult = formConfig.length > 0
        ? validateFormData(finalFormData, formConfig, {}) // Files handled separately
        : { isValid: true, warnings: [], errors: [], missingRequiredFields: [] };
      
      validationWarnings.push(...validationResult.warnings);

      // Strict mandatory field validation for non-draft submissions (must run before workflow)
      if (!saveAsDraft) {
        const { validateMandatoryFields } = await import('../services/validation/mandatoryFieldValidation.service.js');
        const mandatoryValidation = await validateMandatoryFields(
          finalFormData,
          req.user!.clientId!,
          productId
        );
        if (!mandatoryValidation.isValid) {
          res.status(400).json({
            success: false,
            error: mandatoryValidation.errorMessage || 'Missing required fields',
            missingFields: mandatoryValidation.missingFields.map((f) => ({
              fieldId: f.fieldId,
              label: f.label,
              type: f.type,
              displayKey: f.displayKey,
            })),
            formatErrors: mandatoryValidation.formatErrors ?? [],
          });
          return;
        }
      }

      // Generate File ID
      const timestamp = Date.now().toString(36).toUpperCase();
      const fileId = `SF${timestamp.slice(-8)}`;
      const applicationId = `APP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Use loan workflow service for creating application
      // This ensures proper status setting and notifications
      const { loanWorkflowService } = await import('../services/workflow/loanWorkflow.service.js');
      
      try {
        const result = await loanWorkflowService.createLoanApplication(req.user!, {
          clientId: req.user!.clientId!,
          productId,
          applicantName: finalApplicantName,
          requestedLoanAmount: finalRequestedAmount,
          formData: finalFormData,
          documents: '',
          saveAsDraft,
        });

        // Return success response
        res.json({
          success: true,
          data: {
            loanApplicationId: result.applicationId,
            fileId: result.fileId,
            status: result.status,
            warnings: validationWarnings,
            duplicateFound: duplicateCheck ? {
              fileId: duplicateCheck.fileId,
              status: duplicateCheck.status,
            } : null,
          },
        });
        return;
      } catch (workflowError: any) {
        // If workflow service fails, fall back to original implementation
        console.warn('[createApplication] Workflow service failed, using fallback:', workflowError);
      }

      // Fallback: Original implementation
      // Determine status - if saveAsDraft is false, set to UNDER_KAM_REVIEW, otherwise DRAFT
      const status = saveAsDraft ? LoanStatus.DRAFT : LoanStatus.UNDER_KAM_REVIEW;

      // Module 1: Get current form config version for this client (for versioning)
      const { getLatestFormConfigVersion } = await import('../services/formConfigVersioning.js');
      const formConfigVersion = await getLatestFormConfigVersion(req.user!.clientId!);

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
        Documents: '', // Link-first flow: no per-file uploads; Drive link handled separately when implemented
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

      // Asana Integration: Create Asana task if not a draft (non-blocking)
      if (!saveAsDraft) {
        (async () => {
          try {
            const { createAsanaTaskForLoan } = await import('../services/asana/asana.service.js');
            await createAsanaTaskForLoan({
              ...applicationData,
              'Submitted By': req.user!.email,
            });
          } catch (error: any) {
            console.error('[createApplication] Failed to create Asana task (non-blocking):', error.message);
          }
        })();
      }

      // Return success response immediately, then log audit actions asynchronously (non-blocking)
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

      // Module 0: Use admin logger helper (non-blocking)
      logApplicationAction(
        req.user!,
        saveAsDraft ? AdminActionType.SAVE_DRAFT : AdminActionType.SUBMIT_APPLICATION,
        fileId,
        `${saveAsDraft ? 'Created draft' : 'Submitted'} loan application`,
        { productId, formConfigVersion }
      ).catch((error) => {
        console.error('[createApplication] Failed to log admin action (non-blocking):', error);
      });

      // If submitted (not draft), also log to file audit (non-blocking)
      if (!saveAsDraft) {
        n8nClient.postFileAuditLog({
          id: `AUDIT-${Date.now()}`,
          'Log Entry ID': `AUDIT-${Date.now()}`,
          File: fileId,
          Timestamp: new Date().toISOString(),
          Actor: req.user.email,
          'Action/Event Type': 'status_change',
          'Details/Message': `Application submitted and moved to KAM review${needsAttention ? ' (needs attention)' : ''}`,
          'Target User/Role': 'kam',
          Resolved: 'False',
        }).catch((error) => {
          console.error('[createApplication] Failed to log file audit (non-blocking):', error);
        });

        // Module 2: Auto-create query/task marker for KAM attention if issues found (non-blocking)
        if (needsAttention) {
          n8nClient.postFileAuditLog({
            id: `AUDIT-${Date.now()}-ATTENTION`,
            'Log Entry ID': `AUDIT-${Date.now()}-ATTENTION`,
            File: fileId,
            Timestamp: new Date().toISOString(),
            Actor: 'System',
            'Action/Event Type': 'query',
            'Details/Message': `Application submitted with validation warnings. Please review: ${validationWarnings.join('; ')}`,
            'Target User/Role': 'kam',
            Resolved: 'False',
          }).catch((error) => {
            console.error('[createApplication] Failed to log attention marker (non-blocking):', error);
          });
        }
      }
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
   * 
   * Webhook Mapping:
   * - GET → n8nClient.fetchTable('Loan Application') → /webhook/loanapplication → Airtable: Loan Applications
   * - GET → n8nClient.fetchTable('Clients') → /webhook/client → Airtable: Clients
   * - GET → n8nClient.fetchTable('Loan Products') → /webhook/loanproducts → Airtable: Loan Products
   * 
   * All records are parsed using standardized N8nResponseParser
   * Returns ParsedRecord[] with clean field names (fields directly on object)
   * 
   * Frontend: src/pages/Applications.tsx, src/hooks/useApplications.ts
   * See WEBHOOK_MAPPING_TABLE.md for complete mapping
   */
  async listApplications(req: Request, res: Response): Promise<void> {
    // CRITICAL: Log immediately to verify controller is being called
    console.log(`🚨 [listApplications] CONTROLLER CALLED - Request received at ${new Date().toISOString()}`);
    console.log(`🚨 [listApplications] Request URL: ${req.url}`);
    console.log(`🚨 [listApplications] Request method: ${req.method}`);
    console.log(`🚨 [listApplications] User: ${req.user ? JSON.stringify(req.user) : 'NO USER'}`);
    try {
      const { status, dateFrom, dateTo, search } = req.query;
      const user = req.user!;
      
      console.log(`[listApplications] N8N_BASE_URL: ${process.env.N8N_BASE_URL || 'NOT SET - using default'}`);
      console.log(`[listApplications] Fetching 3 tables in parallel...`);

      // Fetch applications and related data from n8n webhooks
      // DISABLE CACHE to ensure webhooks are called every time
      // User requested that webhooks should trigger on manual refresh
      // Use Promise.allSettled to handle partial failures gracefully
      // All records are automatically parsed by fetchTable() using N8nResponseParser
      // Returns ParsedRecord[] with clean field names (fields directly on object, not in 'fields' property)
      console.log(`[listApplications] Fetching tables with cache DISABLED to trigger webhooks...`);
      const results = await Promise.allSettled([
        n8nClient.fetchTable('Loan Application', false), // Disable cache
        n8nClient.fetchTable('Clients', false), // Disable cache
        n8nClient.fetchTable('Loan Products', false), // Disable cache
      ]);
      
      console.log(`[listApplications] Promise.allSettled completed`);
      
      // Extract results, using empty arrays as fallback for failed requests
      const applications = results[0].status === 'fulfilled' ? results[0].value : [];
      const clients = results[1].status === 'fulfilled' ? results[1].value : [];
      const loanProducts = results[2].status === 'fulfilled' ? results[2].value : [];
      
      // Log any failures
      if (results[0].status === 'rejected') {
        console.error('[listApplications] Failed to fetch Loan Application:', results[0].reason);
      }
      if (results[1].status === 'rejected') {
        console.error('[listApplications] Failed to fetch Clients:', results[1].reason);
      }
      if (results[2].status === 'rejected') {
        console.error('[listApplications] Failed to fetch Loan Products:', results[2].reason);
      }

      // Create lookup maps for efficient filtering
      const clientsMap = new Map(clients.map((c: any) => [c['Client ID'] || c.id, c]));
      const productsMap = new Map(loanProducts.map((p: any) => [p['Product ID'] || p.id, p]));

      // Apply RBAC filtering using centralized service
      const { rbacFilterService } = await import('../services/rbac/rbacFilter.service.js');
      let filteredApplications = await rbacFilterService.filterLoanApplications(applications, user);

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
      console.log(`[listApplications] Transforming ${filteredApplications.length} applications to API format...`);
      const startTransform = Date.now();
      
      const transformedData = filteredApplications.map((app: any) => {
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
      });
      
      const transformTime = Date.now() - startTransform;
      console.log(`[listApplications] Transformation completed in ${transformTime}ms`);
      console.log(`[listApplications] Sending response with ${transformedData.length} applications...`);
      
      console.log(`[listApplications] Response data size: ${JSON.stringify(transformedData).length} bytes`);
      console.log(`[listApplications] Sending response at ${new Date().toISOString()}`);
      
      res.json({
        success: true,
        data: transformedData,
      });
      
      console.log(`[listApplications] Response sent successfully at ${new Date().toISOString()}`);
      console.log(`[listApplications] Response headers sent: ${res.headersSent}`);
    } catch (error: any) {
      console.error('[LoanController] Error fetching applications:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch applications',
      });
    }
  }

  /**
   * GET /loan-applications/:id/queries
   * Get all queries for an application, grouped into threads
   * 
   * Webhook Mapping:
   * - GET → n8nClient.fetchTable('File Auditing Log') → /webhook/fileauditinglog → Airtable: File Auditing Log
   * 
   * Frontend: src/pages/ApplicationDetail.tsx
   */
  async getQueries(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const applications = await n8nClient.fetchTable('Loan Application');
      const application = applications.find((app) => app.id === id);

      if (!application) {
        res.status(404).json({ success: false, error: 'Application not found' });
        return;
      }

      // Check access permissions using RBAC filter service
      const { rbacFilterService } = await import('../services/rbac/rbacFilter.service.js');
      const filtered = await rbacFilterService.filterLoanApplications([application as any], req.user!);
      if (filtered.length === 0) {
        defaultLogger.warn('Access denied for application', {
          applicationId: id,
          userEmail: req.user!.email,
          userRole: req.user!.role,
          clientId: req.user!.clientId,
          kamId: req.user!.kamId,
          nbfcId: req.user!.nbfcId,
          creditTeamId: req.user!.creditTeamId,
          applicationClient: application.Client || application['Client'],
        });
        res.status(403).json({ 
          success: false, 
          error: 'Access denied. You do not have permission to view this application.' 
        });
        return;
      }

      const { queryService } = await import('../services/queries/query.service.js');
      let threads = await queryService.getQueriesForFile(application['File ID']);

      // Role-based visibility: Client and NBFC only see threads targeted at them
      const viewerRole = (req.user!.role || '').toLowerCase();
      if (viewerRole === 'client') {
        const clientEmail = (req.user!.email || '').toLowerCase();
        threads = threads.filter((t) => {
          const targetRole = (t.rootQuery.targetUserRole || '').toLowerCase().trim();
          const actor = (t.rootQuery.actor || '').toLowerCase().trim();
          // Show: KAM→Client threads (targetUserRole=client) OR Client→KAM threads (targetUserRole=kam and client is actor)
          return targetRole === 'client' || (targetRole === 'kam' && actor === clientEmail);
        });
      } else if (viewerRole === 'nbfc') {
        threads = threads.filter(
          (t) => (t.rootQuery.targetUserRole || '').toLowerCase().trim() === 'nbfc'
        );
      }

      res.json({
        success: true,
        data: threads,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch queries',
      });
    }
  }

  /**
   * POST /loan-applications/:id/queries
   * Create a new query (client only). Client raises query to their assigned KAM.
   */
  async createClientQuery(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'client') {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      const { id } = req.params;
      const { message } = req.body;
      const queryMessage = typeof message === 'string' ? message.trim() : '';

      if (!queryMessage) {
        res.status(400).json({ success: false, error: 'message is required' });
        return;
      }

      const applications = await n8nClient.fetchTable('Loan Application');
      const application = applications.find((app) => app.id === id);

      if (!application) {
        res.status(404).json({ success: false, error: 'Application not found' });
        return;
      }

      const clientId = application.Client || application['Client'];
      if (clientId !== req.user.clientId) {
        res.status(403).json({ success: false, error: 'Access denied. You can only raise queries for your own applications.' });
        return;
      }

      const { queryService } = await import('../services/queries/query.service.js');
      const queryId = await queryService.createQuery(
        application['File ID'],
        clientId,
        req.user.email,
        'client',
        queryMessage,
        'kam',
        'client_query'
      );

      await logApplicationAction(
        req.user!,
        AdminActionType.RAISE_QUERY,
        application['File ID'],
        `Client raised query for application ${application['File ID']}`,
        { queryId }
      ).catch((err) => console.error('Failed to log admin activity for client query:', err));

      res.json({
        success: true,
        message: 'Query raised successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create query',
      });
    }
  }

  /**
   * PATCH /loan-applications/:id/queries/:queryId
   * Edit own query within allowed time window (e.g. 15 minutes). Only the author can edit.
   */
  async updateQuery(req: Request, res: Response): Promise<void> {
    try {
      const { id, queryId } = req.params;
      const { message: newMessage } = req.body;

      if (!newMessage || typeof newMessage !== 'string' || !newMessage.trim()) {
        res.status(400).json({ success: false, error: 'message is required' });
        return;
      }

      const applications = await n8nClient.fetchTable('Loan Application');
      const application = applications.find((app) => app.id === id);

      if (!application) {
        res.status(404).json({ success: false, error: 'Application not found' });
        return;
      }

      const { rbacFilterService } = await import('../services/rbac/rbacFilter.service.js');
      const filtered = await rbacFilterService.filterLoanApplications([application as any], req.user!);
      if (filtered.length === 0) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }

      const { queryService } = await import('../services/queries/query.service.js');
      await queryService.updateQuery(
        queryId,
        application['File ID'],
        req.user!.email,
        newMessage.trim()
      );

      res.json({
        success: true,
        message: 'Query updated successfully',
      });
    } catch (error: any) {
      const status = error.message?.includes('Only the query author') || error.message?.includes('within 15 minutes')
        ? 403
        : 500;
      res.status(status).json({
        success: false,
        error: error.message || 'Failed to update query',
      });
    }
  }

  /**
   * POST /loan-applications/:id/queries/:queryId/resolve
   * Resolve a query
   * 
   * Webhook Mapping:
   * - GET → n8nClient.fetchTable('File Auditing Log') → /webhook/fileauditinglog → Airtable: File Auditing Log
   * - POST → n8nClient.postFileAuditLog() → /webhook/Fileauditinglog → Airtable: File Auditing Log
   */
  async resolveQuery(req: Request, res: Response): Promise<void> {
    try {
      const { id, queryId } = req.params;
      const { resolutionMessage } = req.body;

      // Step 1: Fetch applications and find the specific one
      const applications = await n8nClient.fetchTable('Loan Application');
      const application = applications.find((app) => app.id === id);

      if (!application) {
        res.status(404).json({ success: false, error: 'Application not found' });
        return;
      }

      // Step 2: Check access permissions BEFORE fetching audit logs
      // Only KAM, Credit Team, or Client (for their own queries) can resolve
      const { rbacFilterService } = await import('../services/rbac/rbacFilter.service.js');
      const filtered = await rbacFilterService.filterLoanApplications([application as any], req.user!);
      if (filtered.length === 0) {
        defaultLogger.warn('Access denied for query resolution', {
          applicationId: id,
          queryId,
          userEmail: req.user!.email,
          userRole: req.user!.role,
        });
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }

      const { queryService } = await import('../services/queries/query.service.js');
      await queryService.resolveQuery(
        queryId,
        application['File ID'],
        application.Client,
        req.user!.email,
        resolutionMessage,
        req.user!.role
      );

      await n8nClient.postAdminActivityLog({
        id: `ACT-${Date.now()}`,
        'Activity ID': `ACT-${Date.now()}`,
        Timestamp: new Date().toISOString(),
        'Performed By': req.user!.email,
        'Action Type': 'resolve_query',
        'Description/Details': `Query ${queryId} resolved on application ${application['File ID']}`,
        'Target Entity': 'loan_application',
      }).catch((err) => console.error('Failed to log admin activity for query resolve:', err));

      res.json({
        success: true,
        message: 'Query resolved successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to resolve query',
      });
    }
  }

  /**
   * POST /loan-applications/:id/queries/:queryId/reply
   * Reply to a query (client, KAM, or credit_team). Chat-style thread replies.
   */
  async replyToQuery(req: Request, res: Response): Promise<void> {
    try {
      const { id, queryId } = req.params;
      const { message: bodyMessage, reply, newDocs, answers } = req.body;
      const message = typeof bodyMessage === 'string' ? bodyMessage : (typeof reply === 'string' ? reply : '');

      const applications = await n8nClient.fetchTable('Loan Application');
      const application = applications.find((app) => app.id === id);
      if (!application) {
        res.status(404).json({ success: false, error: 'Application not found' });
        return;
      }

      const { rbacFilterService } = await import('../services/rbac/rbacFilter.service.js');
      const filtered = await rbacFilterService.filterLoanApplications([application as any], req.user!);
      if (filtered.length === 0) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }

      const auditLogs = await n8nClient.fetchTable('File Auditing Log');
      const rootQuery = auditLogs.find((q: any) => q.id === queryId && (q.File === application['File ID']));
      if (!rootQuery) {
        res.status(404).json({ success: false, error: 'Query not found' });
        return;
      }

      const hasContent = message.trim() || (answers && Object.keys(answers).length > 0) || (newDocs && newDocs.length > 0);
      if (!hasContent) {
        res.status(400).json({ success: false, error: 'Message, answers, or new documents are required' });
        return;
      }

      const role = (req.user!.role || '').toLowerCase();

      if (role === 'client') {
        if (answers) {
          const currentFormData = application['Form Data'] ? JSON.parse(application['Form Data']) : {};
          const updatedFormData = { ...currentFormData, ...answers };
          await n8nClient.postLoanApplication({
            ...application,
            'Form Data': JSON.stringify(updatedFormData),
            'Last Updated': new Date().toISOString(),
          });
        }
        if (newDocs && newDocs.length > 0) {
          const documents = application.Documents ? application.Documents.split(',').filter(Boolean) : [];
          newDocs.forEach((doc: any) => documents.push(`${doc.fieldId}:${doc.fileUrl}`));
          await n8nClient.postLoanApplication({
            ...application,
            Documents: documents.join(','),
            'Last Updated': new Date().toISOString(),
          });
        }
      }

      const targetRole = (rootQuery['Target User/Role'] || '').toLowerCase().trim();
      const replyTarget = targetRole === 'client' ? 'kam' : targetRole === 'kam' ? 'credit_team' : (rootQuery['Target User/Role'] || 'kam');
      const replyMessage = [
        message.trim(),
        answers && Object.keys(answers).length ? `Answers provided: ${Object.keys(answers).join(', ')}` : '',
        newDocs?.length ? `New documents uploaded: ${newDocs.length}` : '',
      ].filter(Boolean).join('. ') || 'Response submitted.';

      const { queryService } = await import('../services/queries/query.service.js');
      await queryService.createQueryReply(
        queryId,
        application['File ID'],
        application.Client,
        req.user!.email,
        role,
        replyMessage,
        replyTarget
      );

      if (role === 'client' && application.Status === 'query_with_client') {
        await n8nClient.postLoanApplication({
          ...application,
          Status: LoanStatus.UNDER_KAM_REVIEW,
          'Last Updated': new Date().toISOString(),
        });
      }

      await n8nClient.postAdminActivityLog({
        id: `ACT-${Date.now()}`,
        'Activity ID': `ACT-${Date.now()}`,
        Timestamp: new Date().toISOString(),
        'Performed By': req.user!.email,
        'Action Type': 'reply_to_query',
        'Description/Details': `Reply to query ${queryId} on application ${application['File ID']}`,
        'Target Entity': 'loan_application',
      }).catch((err) => console.error('Failed to log admin activity for query reply:', err));

      res.json({ success: true, message: 'Reply submitted successfully' });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to submit reply',
      });
    }
  }

  /**
   * GET /loan-applications/:id
   * Get single application
   * 
   * Webhook Mapping:
   * - GET → n8nClient.fetchTable('Loan Application') → /webhook/loanapplication → Airtable: Loan Applications
   * - GET → n8nClient.fetchTable('File Auditing Log') → /webhook/fileauditinglog → Airtable: File Auditing Log
   * 
   * All records are parsed using standardized N8nResponseParser
   * Returns ParsedRecord[] with clean field names (fields directly on object)
   * 
   * Frontend: src/pages/ApplicationDetail.tsx (line 105)
   * See WEBHOOK_MAPPING_TABLE.md for complete mapping
   */
  async getApplication(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      // Step 1: Fetch only applications first (cached, so minimal cost)
      const applications = await n8nClient.fetchTable('Loan Application');

      // Step 2: Try to find application by multiple ID formats
      // First try exact match on id (Airtable record ID)
      let application = applications.find((app) => app.id === id);
      
      // If not found, try File ID (in case frontend is using File ID instead of record ID)
      if (!application) {
        application = applications.find((app) => 
          app['File ID'] === id || 
          String(app['File ID']) === String(id)
        );
      }
      
      // If still not found, try case-insensitive match
      if (!application) {
        application = applications.find((app) => 
          String(app.id).toLowerCase() === String(id).toLowerCase() ||
          String(app['File ID'] || '').toLowerCase() === String(id).toLowerCase()
        );
      }

      if (!application) {
        const sampleIds = applications.slice(0, 5).map(a => ({
          id: a.id,
          fileId: a['File ID']
        }));
        console.log(`[LoanController] Application not found with id: ${id}`);
        console.log(`[LoanController] Sample application IDs:`, sampleIds);
        res.status(404).json({ 
          success: false, 
          error: `Application not found with ID: ${id}. Please check the application ID and try again.` 
        });
        return;
      }
      
      console.log(`[LoanController] Found application: id=${application.id}, File ID=${application['File ID']}, Client=${application.Client || application['Client']}`);

      // Step 3: Check access permissions BEFORE fetching audit logs
      const { rbacFilterService } = await import('../services/rbac/rbacFilter.service.js');
      const filtered = await rbacFilterService.filterLoanApplications([application as any], req.user!);
      if (filtered.length === 0) {
        console.log(`[LoanController] Access denied for application ${id}. User: ${req.user!.email}, Role: ${req.user!.role}, clientId: ${req.user!.clientId}, Application Client: ${application.Client || application['Client']}`);
        res.status(403).json({ 
          success: false, 
          error: 'Access denied. You do not have permission to view this application.' 
        });
        return;
      }

      // Step 4: Only fetch audit logs if we found the application and have access
      // Filter to only logs for this specific file ID to minimize data transfer
      const auditLogs = await n8nClient.fetchTable('File Auditing Log');
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

      // Parse Documents field - format: fieldId:url|fileName,fieldId:url|fileName
      const documents: Array<{ fieldId: string; url: string; fileName: string }> = [];
      if (application.Documents) {
        const documentsStr = application.Documents;
        const documentEntries = documentsStr.split(',').filter(Boolean);
        
        documentEntries.forEach((entry: string) => {
          // Parse format: fieldId:url|fileName
          const [fieldIdPart, rest] = entry.split(':');
          if (rest) {
            const [url, fileName] = rest.split('|');
            if (fieldIdPart && url) {
              documents.push({
                fieldId: fieldIdPart.trim(),
                url: url.trim(),
                fileName: fileName ? fileName.trim() : url.split('/').pop() || 'document',
              });
            }
          }
        });
      }

      // Parse Form Data safely (defensive reads for n8n/Airtable field name variants)
      let formData: Record<string, unknown> = {};
      const rawFormData =
        application['Form Data'] ??
        application.formData ??
        application['form_data'] ??
        (application as any).FormData ??
        (application as any)['form data'] ??
        (application as any).fields?.['Form Data'] ??
        (application as any).fields?.formData;
      const formDataSource =
        application['Form Data'] !== undefined
          ? 'Form Data'
          : application.formData !== undefined
            ? 'formData'
            : application['form_data'] !== undefined
              ? 'form_data'
              : (application as any).FormData !== undefined
                ? 'FormData'
                : (application as any)?.fields?.['Form Data'] !== undefined
                  ? 'fields.Form Data'
                  : (application as any)?.fields?.formData !== undefined
                    ? 'fields.formData'
                    : 'none';
      console.log(
        '[getApplication] Form Data source:',
        formDataSource,
        'type:',
        typeof rawFormData,
        'length:',
        typeof rawFormData === 'string' ? rawFormData.length : 'N/A'
      );
      if (rawFormData) {
        const preview =
          typeof rawFormData === 'string'
            ? rawFormData.slice(0, 100)
            : JSON.stringify(rawFormData).slice(0, 100);
        console.log('[getApplication] Form Data preview:', preview);
      }
      if (rawFormData) {
        try {
          const parsed = typeof rawFormData === 'string' ? JSON.parse(rawFormData) : rawFormData;
          formData = (parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}) as Record<string, unknown>;
        } catch {
          formData = {};
        }
      }
      console.log('[getApplication] Parsed formData keys:', Object.keys(formData).length, 'keys:', Object.keys(formData).slice(0, 5));
      if (Object.keys(formData).length === 0) {
        console.log(`[getApplication] No form data for application ${application.id} (File ID: ${application['File ID']}) source: ${formDataSource}`);
      }

      // Normalize status for frontend (Submit/Withdraw visibility for draft)
      const rawStatus = application.Status || application.status || 'draft';
      const normalizedStatus = String(rawStatus).toLowerCase().trim();

      // Enrich with client name and Assigned KAM (resolve KAM ID to name)
      const clientId = application.Client || application['Client'];
      let clientEnriched: { company_name: string } | undefined;
      let assignedKAMName: string | undefined;
      if (clientId) {
        try {
          const clients = await n8nClient.fetchTable('Clients');
          const client = clients.find((c: any) => {
            const cid = c.id || c['Client ID'] || c['ID'];
            return cid === clientId || String(cid) === String(clientId);
          });
          if (client) {
            clientEnriched = {
              company_name: (client['Client Name'] || client['Primary Contact Name'] || client.clientName || '').toString(),
            };
            const assignedKAM = client['Assigned KAM'] || client.assignedKAM || client['KAM ID'];
            if (assignedKAM) {
              const { buildKAMNameMap, resolveKAMName } = await import('../utils/kamNameResolver.js');
              const kamUsers = await n8nClient.fetchTable('KAM Users');
              const kamNameMap = buildKAMNameMap(kamUsers as any[]);
              assignedKAMName = resolveKAMName(assignedKAM, kamNameMap);
            }
          }
        } catch (err) {
          console.warn('[getApplication] Could not enrich client/KAM:', err);
        }
      }

      // Ensure id is included in response (use Airtable record ID)
      res.json({
        success: true,
        data: {
          id: application.id, // Airtable record ID (e.g., recCHVlPoZQYfeKlG)
          fileId: application['File ID'] || application.id, // File ID for display
          ...application,
          client: clientEnriched ?? application.client ?? application.Client,
          assignedKAMName: assignedKAMName ?? application.assignedKAMName,
          status: normalizedStatus,
          Status: normalizedStatus,
          formData,
          form_data: formData, // Alias for frontend compatibility
          documents, // Parsed documents array
          auditLog: fileAuditLog,
          aiFileSummary: application['AI File Summary'] || null, // AI File Summary field
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
      const { formData } = req.body;
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

      // Update form data (preserve existing Documents for backward compatibility)
      const updatedData: any = {
        ...application,
        'Form Data': JSON.stringify(formData || {}),
        'Last Updated': new Date().toISOString(),
        'Form Config Version': formConfigVersion || '', // Module 1: Preserve or update version
      };

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
   * 
   * Webhook Mapping:
   * - GET → n8nClient.fetchTable('Loan Application') → /webhook/loanapplication (singular) → Airtable: Loan Applications
   * - POST → n8nClient.postLoanApplication() → /webhook/loanapplications (plural) → Airtable: Loan Applications
   * 
   * All records are parsed using standardized N8nResponseParser
   * Returns ParsedRecord[] with clean field names (fields directly on object)
   * 
   * Frontend: src/pages/NewApplication.tsx (submit button)
   * See WEBHOOK_MAPPING_TABLE.md for complete mapping
   */
  async submitApplication(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'client') {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      const { id } = req.params;
      // Fetch only Loan Application table
      // Records are automatically parsed by fetchTable() using N8nResponseParser
      // Returns ParsedRecord[] with clean field names (fields directly on object, not in 'fields' property)
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

      // Strict mandatory field validation
      // Load form fields configuration and validate all mandatory fields
      const { validateMandatoryFields } = await import('../services/validation/mandatoryFieldValidation.service.js');
      
      // Parse form data from application
      let formData: Record<string, any> = {};
      try {
        const formDataStr = application['Form Data'] || application.formData || '{}';
        formData = typeof formDataStr === 'string' ? JSON.parse(formDataStr) : formDataStr;
      } catch (e) {
        console.error('[submitApplication] Error parsing form data:', e);
        formData = {};
      }

      // Extract document links from form data (for file fields)
      const documentLinks: Record<string, string> = {};
      Object.keys(formData).forEach((key) => {
        // Check if this field might be a document link
        if (formData[key] && typeof formData[key] === 'string' && 
            (formData[key].includes('onedrive') || formData[key].includes('sharepoint') || formData[key].startsWith('http'))) {
          documentLinks[key] = formData[key];
        }
      });

      // Validate mandatory fields
      const productId = application['Loan Product'] || application.loanProduct;
      const validationResult = await validateMandatoryFields(
        formData,
        req.user!.clientId!,
        productId,
        documentLinks
      );

      if (!validationResult.isValid) {
        res.status(400).json({
          success: false,
          error: validationResult.errorMessage || 'Validation failed',
          missingFields: validationResult.missingFields?.map((f) => ({
            fieldId: f.fieldId,
            label: f.label,
            type: f.type,
            displayKey: f.displayKey,
          })) ?? [],
          formatErrors: validationResult.formatErrors ?? [],
        });
        return;
      }

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

      // Asana Integration: Create Asana task for submitted loan (non-blocking)
      (async () => {
        try {
          const { createAsanaTaskForLoan } = await import('../services/asana/asana.service.js');
          await createAsanaTaskForLoan({
            ...application,
            Status: newStatus,
            'Submitted By': req.user!.email,
          });
        } catch (error: any) {
          console.error('[submitApplication] Failed to create Asana task (non-blocking):', error.message);
        }
      })();

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

      // Notify KAM
      try {
        const { notificationService } = await import('../services/notifications/notification.service.js');
        const clients = await n8nClient.fetchTable('Clients');
        const client = clients.find((c: any) => c.id === application.Client || c['Client ID'] === application.Client);
        const kamId = client?.['Assigned KAM'] || '';
        let kamEmail = '';
        if (kamId) {
          const kamUsers = await n8nClient.fetchTable('KAM Users');
          const kamUser = kamUsers.find((k: any) => k.id === kamId || k['KAM ID'] === kamId);
          kamEmail = kamUser?.Email || '';
        }
        if (kamEmail) {
          await notificationService.notifyStatusChange(
            application['File ID'],
            application.Client,
            'WITHDRAWN',
            kamEmail,
            'kam'
          );
        }
      } catch (notifError) {
        console.error('Failed to send withdraw notification:', notifError);
      }

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

