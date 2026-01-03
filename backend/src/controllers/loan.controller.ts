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
          documents: documentsArray.join(','),
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

      // Strict mandatory field validation for non-draft submissions
      if (!saveAsDraft) {
        const { validateMandatoryFields } = await import('../services/validation/mandatoryFieldValidation.service.js');
        
        // Extract document links from documentUploads
        const documentLinks: Record<string, string> = {};
        if (documentUploads && Array.isArray(documentUploads)) {
          documentUploads.forEach((upload: any) => {
            if (upload.fieldId && upload.fileUrl) {
              documentLinks[upload.fieldId] = upload.fileUrl;
            }
          });
        }

        // Validate mandatory fields
        const validationResult = await validateMandatoryFields(
          finalFormData,
          req.user!.clientId!,
          productId,
          documentLinks
        );

        if (!validationResult.isValid) {
          res.status(400).json({
            success: false,
            error: validationResult.errorMessage || 'Missing required fields',
            missingFields: validationResult.missingFields.map((f) => ({
              fieldId: f.fieldId,
              label: f.label,
              type: f.type,
            })),
          });
          return;
        }
      }

      // Module 1: Get current form config version for this client (for versioning)
      const { getLatestFormConfigVersion } = await import('../services/formConfigVersioning.js');
      const formConfigVersion = await getLatestFormConfigVersion(req.user!.clientId!);

      // Module 2: Process document uploads - store OneDrive links in Documents field
      // Format: fieldId:url|fileName,fieldId:url|fileName
      const documentsArray: string[] = [];
      const documentLinks: Record<string, string> = {};
      
      if (documentUploads && Array.isArray(documentUploads)) {
        documentUploads.forEach((upload: any) => {
          if (upload.fieldId && upload.fileUrl) {
            // Store as fieldId:url|fileName format for Documents field
            const fileName = upload.fileName || upload.fileUrl.split('/').pop() || 'document';
            documentsArray.push(`${upload.fieldId}:${upload.fileUrl}|${fileName}`);
            
            // Also store in documentLinks for validation
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
        Documents: documentsArray.length > 0 ? documentsArray.join(',') : '', // Module 2: Store documents in format: fieldId:url|fileName
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
    try {
      const { status, dateFrom, dateTo, search } = req.query;
      const user = req.user!;

      // Fetch applications and related data from n8n webhooks
      // Use Promise.allSettled to handle partial failures gracefully
      // All records are automatically parsed by fetchTable() using N8nResponseParser
      // Returns ParsedRecord[] with clean field names (fields directly on object, not in 'fields' property)
      const results = await Promise.allSettled([
        n8nClient.fetchTable('Loan Application'),
        n8nClient.fetchTable('Clients'),
        n8nClient.fetchTable('Loan Products'),
      ]);
      
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

      // Check access permissions
      const filtered = dataFilterService.filterLoanApplications([application], req.user!);
      if (filtered.length === 0) {
        console.log(`[LoanController] Access denied for application ${id}. User: ${req.user!.email}, Role: ${req.user!.role}, clientId: ${req.user!.clientId}, Application Client: ${application.Client || application['Client']}`);
        res.status(403).json({ 
          success: false, 
          error: 'Access denied. You do not have permission to view this application.' 
        });
        return;
      }

      const { queryService } = await import('../services/queries/query.service.js');
      const threads = await queryService.getQueriesForFile(application['File ID']);

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
      const filtered = dataFilterService.filterLoanApplications([application], req.user!);
      if (filtered.length === 0) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }

      const { queryService } = await import('../services/queries/query.service.js');
      await queryService.resolveQuery(
        queryId,
        application['File ID'],
        application.Client,
        req.user!.email,
        resolutionMessage
      );

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
      const filtered = dataFilterService.filterLoanApplications([application], req.user!);
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

      // Ensure id is included in response (use Airtable record ID)
      res.json({
        success: true,
        data: {
          id: application.id, // Airtable record ID (e.g., recCHVlPoZQYfeKlG)
          fileId: application['File ID'] || application.id, // File ID for display
          ...application,
          formData: application['Form Data'] ? JSON.parse(application['Form Data']) : {},
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

      // Handle document uploads - append to Documents field
      // Format: fieldId:url|fileName,fieldId:url|fileName
      if (documentUploads && documentUploads.length > 0) {
        const existingDocuments = application.Documents
          ? application.Documents.split(',').filter(Boolean)
          : [];
        
        documentUploads.forEach((doc: any) => {
          if (doc.fieldId && doc.fileUrl) {
            const fileName = doc.fileName || doc.fileUrl.split('/').pop() || 'document';
            const documentEntry = `${doc.fieldId}:${doc.fileUrl}|${fileName}`;
            
            // Check if this fieldId already has documents, replace or append
            const fieldIdPrefix = `${doc.fieldId}:`;
            const filtered = existingDocuments.filter((d: string) => !d.startsWith(fieldIdPrefix));
            filtered.push(documentEntry);
            
            updatedData.Documents = filtered.join(',');
          }
        });
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
          error: validationResult.errorMessage || 'Missing required fields',
          missingFields: validationResult.missingFields.map((f) => ({
            fieldId: f.fieldId,
            label: f.label,
            type: f.type,
          })),
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

