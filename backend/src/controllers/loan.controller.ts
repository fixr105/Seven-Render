/**
 * Loan Applications Controller
 * Handles loan application CRUD operations
 */

import { Request, Response } from 'express';
import { n8nClient } from '../services/airtable/n8nClient.js';
import { LoanStatus, UserRole } from '../config/constants.js';
import { logApplicationAction, AdminActionType } from '../utils/adminLogger.js';
import { defaultLogger } from '../utils/logger.js';
import { matchIds } from '../utils/idMatcher.js';
import { deduplicateApplicationsByFileId } from '../utils/applicationDeduplication.js';
import { findLoanApplicationByParamId } from '../utils/findLoanApplicationByParamId.js';
import {
  getApplicationProductStatuses,
  getAllowedStatusesFromProduct,
  normalizeDynamicStatus,
} from '../services/statusTracking/dynamicStatus.service.js';
import {
  ClientProductEntitlementError,
  entitlementErrorBody,
  assertClientProductAssigned,
} from '../services/entitlements/clientProducts.service.js';
import { resolveRequestedLoanAmountFromVehicleSelection } from '../services/vehicles/vehicleCatalog.service.js';
import { resolveApplicationRecordStatus, resolveStoredApplicationStatus } from '../utils/loanApplicationAirtableStatus.js';
import { resolveLoanApplicationDocuments } from '../utils/loanApplicationCoreFields.js';
import {
  buildPromotedApplicationRecord,
  mergeFormDataJson,
  resolveLoanApplicationPromotedFields,
} from '../utils/loanApplicationCoreFields.js';
import { readFormConfigVersion } from '../utils/loanApplicationAirtableMapping.js';

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

      if (!req.user.clientId) {
        res.status(403).json({
          success: false,
          error: 'Your account is not linked to a client record. Please contact your KAM or administrator.',
        });
        return;
      }

      const { 
        productId, 
        borrowerIdentifiers, 
        applicantName, 
        requestedLoanAmount, 
        formData,
        saveAsDraft = true,
        validateOnly = false,
        clientSubmissionId,
      } = req.body;
      await assertClientProductAssigned(req.user, productId);

      // Support both new format (applicantName, requestedLoanAmount, formData) and legacy format (borrowerIdentifiers)
      const finalApplicantName = applicantName || borrowerIdentifiers?.name || '';
      const finalFormData = formData || {};
      let finalRequestedAmount = requestedLoanAmount ?? '';
      const selectedVehicle = await resolveRequestedLoanAmountFromVehicleSelection(req.user, productId, {
        vehicleId:
          finalFormData._vehicleId ??
          finalFormData.vehicleId ??
          finalFormData['Vehicle ID'],
        make:
          finalFormData._vehicleMake ??
          finalFormData.make ??
          finalFormData.Make,
        model:
          finalFormData._vehicleModel ??
          finalFormData.model ??
          finalFormData.Model,
      });
      if (selectedVehicle) {
        finalRequestedAmount = selectedVehicle.requestedLoanAmount;
        finalFormData._vehicleId = selectedVehicle.vehicleId;
        finalFormData._vehicleMake = selectedVehicle.make;
        finalFormData._vehicleModel = selectedVehicle.model;
        finalFormData._vehicleRequestedLoanAmount = selectedVehicle.requestedLoanAmount;
      }

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
      // Fetch form config for validation - Loan Products only (matches frontend; no getSimpleFormConfig fallback).
      let formConfig: any[] = [];
      try {
        if (productId && typeof productId === 'string') {
          const { getFormConfigForProduct } = await import('../services/formConfig/productFormConfig.service.js');
          const config = await getFormConfigForProduct(productId);
          formConfig = config.categories;
        }
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
        const { isB2cEvFormTemplate, validateB2cEvFormData } = await import(
          '../services/validation/b2cEvFormValidation.service.js'
        );

        if (isB2cEvFormTemplate(finalFormData)) {
          const b2cValidation = validateB2cEvFormData(finalFormData, productId);
          if (!b2cValidation.isValid) {
            res.status(400).json({
              success: false,
              error: b2cValidation.errorMessage || 'Missing required fields',
              missingFields: b2cValidation.missingFields.map((f) => ({
                fieldId: f.fieldId,
                label: f.label,
                type: f.type,
                displayKey: f.displayKey,
              })),
              formatErrors: b2cValidation.formatErrors,
            });
            return;
          }
        } else {
          const documentLinks: Record<string, string> = {};
          Object.keys(finalFormData).forEach((key) => {
            const v = finalFormData[key];
            if (v && typeof v === 'string' && (v.includes('onedrive') || v.includes('sharepoint') || v.startsWith('http'))) {
              documentLinks[key] = v;
            }
          });
          const { validateMandatoryFields } = await import('../services/validation/mandatoryFieldValidation.service.js');
          const mandatoryValidation = await validateMandatoryFields(
            finalFormData,
            req.user!.clientId!,
            productId,
            documentLinks
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
      }

      if (validateOnly) {
        res.json({
          success: true,
          data: {
            warnings: validationWarnings,
            duplicateFound: duplicateCheck ? {
              fileId: duplicateCheck.fileId,
              status: duplicateCheck.status,
            } : null,
          },
        });
        return;
      }

      // Build full form data to store (all fields row-wise). Include core fields so Form Data is a complete snapshot.
      const fullFormDataToStore: Record<string, unknown> = {
        applicantName: finalApplicantName,
        requestedLoanAmount: finalRequestedAmount,
        ...(productId ? { productId } : {}),
        ...finalFormData,
      };

      // Use loan workflow service for creating application
      // This ensures proper status setting and notifications
      const { loanWorkflowService } = await import('../services/workflow/loanWorkflow.service.js');

      try {
        const result = await loanWorkflowService.createLoanApplication(req.user!, {
          clientId: req.user!.clientId!,
          productId,
          applicantName: finalApplicantName,
          requestedLoanAmount: finalRequestedAmount,
          formData: fullFormDataToStore,
          saveAsDraft,
          clientSubmissionId,
          metadata: {
            needsAttention: !saveAsDraft && validationWarnings.length > 0,
            validationWarnings,
          },
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
        console.error('[createApplication] Workflow service failed:', workflowError);

        if (clientSubmissionId) {
          const existingAfterError = await loanWorkflowService.findApplicationBySubmissionId(
            req.user!.clientId!,
            clientSubmissionId
          );
          if (existingAfterError) {
            res.json({
              success: true,
              data: {
                loanApplicationId: existingAfterError.id,
                fileId: existingAfterError['File ID'] || existingAfterError.fileId,
                status: existingAfterError.Status || existingAfterError.status,
                warnings: validationWarnings,
                duplicateFound: duplicateCheck ? {
                  fileId: duplicateCheck.fileId,
                  status: duplicateCheck.status,
                } : null,
              },
            });
            return;
          }
        }

        throw workflowError;
      }
    } catch (error: any) {
      if (error instanceof ClientProductEntitlementError) {
        res.status(error.statusCode).json(entitlementErrorBody(error));
        return;
      }
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
      const { status, statusIn, loanProductId, dateFrom, dateTo, search, unmapped, clientId } = req.query;
      if (!req.user) {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }
      const user = req.user;
      const unmappedOnly = unmapped === 'true' || unmapped === '1';
      
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
      let applications = results[0].status === 'fulfilled' ? results[0].value : [];
      applications = deduplicateApplicationsByFileId(applications);
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

      // Apply unmapped filter (credit_team: no client or client not in Clients; KAM: not matching any managed client)
      if (unmappedOnly && (user.role === UserRole.CREDIT || user.role === UserRole.ADMIN || user.role === UserRole.KAM)) {
        const getAppClient = (app: any) => {
          const raw = Array.isArray(app.Client) ? app.Client[0] : (app.Client ?? app['Client'] ?? app['Client ID'] ?? app.clientId);
          return raw != null && raw !== '' ? raw : null;
        };
        if (user.role === UserRole.CREDIT || user.role === UserRole.ADMIN) {
          const allClientIds: string[] = [];
          clients.forEach((c: any) => {
            [c.id, c['Client ID'], c['ID']].filter(Boolean).forEach((id: any) => allClientIds.push(String(id)));
          });
          filteredApplications = filteredApplications.filter((app: any) => {
            const appClient = getAppClient(app);
            if (!appClient) return true;
            return !allClientIds.some((id) => matchIds(appClient, id));
          });
        } else if (user.role === UserRole.KAM && user.kamId) {
          const managedClientIds = await rbacFilterService.getKAMManagedClientIds(user.kamId);
          filteredApplications = filteredApplications.filter((app: any) => {
            const appClient = getAppClient(app);
            if (!appClient) return true;
            return !managedClientIds.some((id) => matchIds(appClient, id));
          });
        }
      }

      // Apply client filter (matchIds handles Airtable record id vs business Client ID)
      if (clientId && String(clientId).trim()) {
        const clientIdStr = String(clientId).trim();
        filteredApplications = filteredApplications.filter((app: any) => {
          const appClientRaw = Array.isArray(app.Client)
            ? app.Client[0]
            : (app.Client ?? app['Client'] ?? app['Client ID'] ?? app.clientId);
          return matchIds(appClientRaw, clientIdStr);
        });
      }

      // Apply loan product filter (business Product ID, e.g. LP008)
      if (loanProductId && String(loanProductId).trim()) {
        const want = String(loanProductId).trim().toLowerCase();
        filteredApplications = filteredApplications.filter((app: any) => {
          const raw = app['Loan Product'] ?? app.productId ?? app['Product ID'] ?? '';
          const appProduct = String(raw).trim().toLowerCase();
          return appProduct === want || appProduct.endsWith(want) || want.endsWith(appProduct);
        });
      }

      // Apply status filter: multi-value statusIn (comma-separated) takes precedence over single status
      if (statusIn && String(statusIn).trim()) {
        const allowed = new Set(
          String(statusIn)
            .split(',')
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean)
        );
        filteredApplications = filteredApplications.filter((app: any) => {
          const resolved = resolveStoredApplicationStatus(app.Status ?? app.status);
          return allowed.has(resolved);
        });
      } else if (status) {
        const wanted = String(status).trim().toLowerCase();
        filteredApplications = filteredApplications.filter((app: any) => {
          const resolved = resolveStoredApplicationStatus(app.Status ?? app.status);
          return resolved === wanted;
        });
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
        
        let formData: Record<string, unknown> = {};
        if (app['Form Data'] != null) {
          if (typeof app['Form Data'] === 'string') {
            try {
              formData = JSON.parse(app['Form Data']) as Record<string, unknown>;
            } catch {
              formData = {};
            }
          } else if (typeof app['Form Data'] === 'object' && app['Form Data'] !== null) {
            formData = app['Form Data'] as Record<string, unknown>;
          }
        }
        return {
          id: app.id,
          fileId: app['File ID'] || app.fileId,
          client: client?.['Client Name'] ?? app.Client ?? app['Client'],
          clientId: app.Client || app['Client'],
          applicantName: app['Applicant Name'] || app.applicantName,
          product: product?.['Product Name'] ?? app['Loan Product'] ?? app.loanProduct,
          productId: app['Loan Product'] || app.loanProduct,
          requestedAmount: app['Requested Loan Amount'] || app.requestedLoanAmount,
          status: resolveStoredApplicationStatus(app.Status ?? app.status),
          Status: resolveStoredApplicationStatus(app.Status ?? app.status),
          creationDate: app['Creation Date'] || app['Created At'] || app.creationDate,
          submittedDate: app['Submitted Date'] || app.submittedDate,
          lastUpdated: app['Last Updated'] || app.updatedAt || app.lastUpdated,
          assignedCreditAnalyst: app['Assigned Credit Analyst'] || app.assignedCreditAnalyst,
          assignedNBFC: app['Assigned NBFC'] || app.assignedNBFC,
          lenderDecisionStatus: app['Lender Decision Status'] || app.lenderDecisionStatus,
          lenderDecisionDate: app['Lender Decision Date'] || app.lenderDecisionDate,
          lenderDecisionRemarks: app['Lender Decision Remarks'] || app.lenderDecisionRemarks,
          approvedAmount: app['Approved Loan Amount'] || app.approvedLoanAmount,
          remarks: app['Remarks'] || '',
          formData,
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
      const applications = await n8nClient.fetchTable('Loan Application', false);
      const application = findLoanApplicationByParamId(applications, id);

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
      const { message, requestKind, itemId } = req.body;
      const queryMessage = typeof message === 'string' ? message.trim() : '';

      if (!queryMessage) {
        res.status(400).json({ success: false, error: 'message is required' });
        return;
      }

      const applications = await n8nClient.fetchTable('Loan Application', false);
      const application = findLoanApplicationByParamId(applications, id);

      if (!application) {
        res.status(404).json({ success: false, error: 'Application not found' });
        return;
      }

      const clientId = application.Client || application['Client'];
      if (clientId !== req.user.clientId) {
        res.status(403).json({ success: false, error: 'Access denied. You can only raise queries for your own applications.' });
        return;
      }

      const {
        buildB2cClientQueryActionEventType,
        buildB2cClientRequestFormPatch,
        isComplianceItemId,
      } = await import('../services/queries/b2cEvQueryFulfillment.service.js');

      const typedItemId =
        typeof itemId === 'string' && isComplianceItemId(itemId) ? itemId : undefined;
      const normalizedRequestKind =
        requestKind === 'b2c_compliance' || requestKind === 'b2c_do' ? requestKind : undefined;
      const actionEventType = buildB2cClientQueryActionEventType(
        normalizedRequestKind,
        typedItemId
      );

      const { queryService } = await import('../services/queries/query.service.js');
      const queryId = await queryService.createQuery(
        application['File ID'],
        clientId,
        req.user.email,
        'client',
        queryMessage,
        'kam',
        actionEventType
      );

      let formDataPatchApplied = false;
      if (normalizedRequestKind) {
        const patch = buildB2cClientRequestFormPatch(normalizedRequestKind, {
          itemId: typedItemId,
          queryId,
        });
        const mergedFormData = mergeFormDataJson(application, patch);
        await n8nClient.postLoanApplication({
          ...application,
          'Form Data': JSON.stringify(mergedFormData),
          'Last Updated': new Date().toISOString(),
        });
        formDataPatchApplied = true;
      }

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
        data: { queryId, formDataPatchApplied },
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

      const applications = await n8nClient.fetchTable('Loan Application', false);
      const application = findLoanApplicationByParamId(applications, id);

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
      const applications = await n8nClient.fetchTable('Loan Application', false);
      const application = findLoanApplicationByParamId(applications, id);

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
      const { message: bodyMessage, reply, newDocs, answers, b2cFulfillment } = req.body;
      const message = typeof bodyMessage === 'string' ? bodyMessage : (typeof reply === 'string' ? reply : '');

      const applications = await n8nClient.fetchTable('Loan Application', false);
      const application = findLoanApplicationByParamId(applications, id);
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

      const role = (req.user!.role || '').toLowerCase();
      const {
        buildB2cFulfillmentPatch,
        buildB2cFulfillmentReplyMessage,
        canPerformB2cFulfillment,
        getQueryReplyTarget,
        isB2cClientQueryActionEventType,
        isComplianceItemId,
        isB2cFulfillmentAction,
      } = await import('../services/queries/b2cEvQueryFulfillment.service.js');
      const { mergeFormDataPatch, parseFormDataField } = await import('../utils/mergeFormDataPatch.js');

      const fulfillmentAction =
        b2cFulfillment && typeof b2cFulfillment === 'object' && typeof b2cFulfillment.action === 'string' && isB2cFulfillmentAction(b2cFulfillment.action)
          ? b2cFulfillment.action
          : undefined;
      const fulfillmentItemId =
        b2cFulfillment && typeof b2cFulfillment.itemId === 'string' && isComplianceItemId(b2cFulfillment.itemId)
          ? b2cFulfillment.itemId
          : undefined;

      const hasFulfillment =
        !!fulfillmentAction &&
        canPerformB2cFulfillment(role) &&
        isB2cClientQueryActionEventType(rootQuery['Action/Event Type'] || '');

      const hasContent =
        message.trim() ||
        (answers && Object.keys(answers).length > 0) ||
        (newDocs && newDocs.length > 0) ||
        hasFulfillment;

      if (!hasContent) {
        res.status(400).json({ success: false, error: 'Message, answers, new documents, or b2cFulfillment are required' });
        return;
      }

      if (hasFulfillment && fulfillmentAction) {
        const patch = buildB2cFulfillmentPatch(fulfillmentAction, fulfillmentItemId);
        const existingFormData = parseFormDataField(application['Form Data']);
        const mergedFormData = mergeFormDataPatch(existingFormData, patch);
        await n8nClient.postLoanApplication({
          ...application,
          'Form Data': JSON.stringify(mergedFormData),
          'Last Updated': new Date().toISOString(),
        });
      }

      if (role === 'client') {
        if (answers) {
          const productId = application['Loan Product'] || application.loanProduct || '';
          const { transformFormDataToChecklistFormat } = await import('../services/formConfig/formDataToChecklistTransformer.js');
          let currentFormData: Record<string, unknown> = {};
          try {
            currentFormData = application['Form Data']
              ? (typeof application['Form Data'] === 'string' ? JSON.parse(application['Form Data']) : application['Form Data'])
              : {};
          } catch {
            currentFormData = {};
          }
          const transformedAnswers = productId
            ? await transformFormDataToChecklistFormat(productId, answers as Record<string, unknown>)
            : (answers as Record<string, string>);
          const merged = { ...currentFormData, ...transformedAnswers };
          const formDataToStore = productId
            ? await transformFormDataToChecklistFormat(productId, merged)
            : merged;
          await n8nClient.postLoanApplication({
            ...application,
            'Form Data': JSON.stringify(formDataToStore),
            'Last Updated': new Date().toISOString(),
          });
        }
        if (newDocs && newDocs.length > 0) {
          const documents = application.Documents ? application.Documents.split(',').filter(Boolean) : [];
          newDocs.forEach((doc: any) => {
            const fieldId = doc.fieldId || '';
            const fileUrl = doc.fileUrl || '';
            const fileName = doc.fileName;
            const entry = fileName ? `${fieldId}:${fileUrl}|${fileName}` : `${fieldId}:${fileUrl}`;
            if (fieldId && fileUrl) documents.push(entry);
          });
          await n8nClient.postLoanApplication({
            ...application,
            Documents: documents.join(','),
            'Last Updated': new Date().toISOString(),
          });
        }
      }

      const rootActionType = rootQuery['Action/Event Type'] || '';
      const replyTarget = getQueryReplyTarget(
        {
          actionEventType: rootActionType,
          targetUserRole: rootQuery['Target User/Role'] || '',
          actor: rootQuery.Actor || '',
        },
        role
      );

      const fulfillmentReplyText =
        hasFulfillment && fulfillmentAction
          ? buildB2cFulfillmentReplyMessage(fulfillmentAction, fulfillmentItemId)
          : '';

      const replyMessage = [
        message.trim(),
        fulfillmentReplyText,
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

      if (hasFulfillment) {
        await queryService.resolveQuery(
          queryId,
          application['File ID'],
          application.Client,
          req.user!.email,
          fulfillmentReplyText || 'B2C request fulfilled',
          req.user!.role
        );
      }

      if (role === 'client' && resolveApplicationRecordStatus(application) === LoanStatus.QUERY_WITH_CLIENT) {
        await n8nClient.postLoanApplication({
          ...application,
          Status: LoanStatus.UNDER_KAM_REVIEW,
          'Last Updated': new Date().toISOString(),
        });
        const { recordStatusChange } = await import('../services/statusTracking/statusHistory.service.js');
        await recordStatusChange(
          req.user!,
          application['File ID'],
          LoanStatus.QUERY_WITH_CLIENT,
          LoanStatus.UNDER_KAM_REVIEW,
          'Client responded to query'
        );
      }

      if (
        role === 'kam' &&
        resolveApplicationRecordStatus(application) === LoanStatus.CREDIT_QUERY_WITH_KAM
      ) {
        await n8nClient.postLoanApplication({
          ...application,
          Status: LoanStatus.PENDING_CREDIT_REVIEW,
          'Last Updated': new Date().toISOString(),
        });
        const { recordStatusChange } = await import('../services/statusTracking/statusHistory.service.js');
        await recordStatusChange(
          req.user!,
          application['File ID'],
          LoanStatus.CREDIT_QUERY_WITH_KAM,
          LoanStatus.PENDING_CREDIT_REVIEW,
          'KAM responded to credit query'
        );
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
      
      // Step 1: Fetch latest application snapshot for detail/status actions
      const applications = await n8nClient.fetchTable('Loan Application', false);

      const application = findLoanApplicationByParamId(applications, id);

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

      const documents = resolveLoanApplicationDocuments(
        application as Record<string, unknown>,
        formData
      );

      const normalizedStatus = resolveApplicationRecordStatus(application);
      const productStatuses = await getApplicationProductStatuses(application as Record<string, any>);
      const allowedNextStatuses = getAllowedStatusesFromProduct(
        application as Record<string, any>,
        productStatuses
      );

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
          remarks: application['Remarks'] ?? formData.Remarks ?? '',
          documents, // Parsed documents array
          auditLog: fileAuditLog,
          aiFileSummary: application['AI File Summary'] || null, // AI File Summary field
          allowedNextStatuses, // For status dropdown: only valid next transitions for this role
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
      // Fetch only Loan Application table (bypass cache — must see freshly created drafts)
      const applications = await n8nClient.fetchTable('Loan Application', false);
      const application = findLoanApplicationByParamId(applications, id);
      const appClient = application?.Client || application?.['Client'];

      if (!application || !matchIds(appClient, req.user.clientId)) {
        res.status(404).json({ success: false, error: 'Application not found' });
        return;
      }

      const applicationStatus = resolveApplicationRecordStatus(application);

      // Only allow updates in DRAFT or QUERY_WITH_CLIENT status
      if (
        applicationStatus !== LoanStatus.DRAFT &&
        applicationStatus !== LoanStatus.QUERY_WITH_CLIENT
      ) {
        res.status(400).json({
          success: false,
          error: 'Application cannot be edited in current status',
        });
        return;
      }

      // Module 1: For drafts, preserve existing form config version or update to latest
      // Submitted files keep their frozen version
      let formConfigVersion = readFormConfigVersion(application as Record<string, unknown>);
      if (!formConfigVersion && applicationStatus === LoanStatus.DRAFT) {
        // Draft without version - get latest
        const { getLatestFormConfigVersion } = await import('../services/formConfigVersioning.js');
        formConfigVersion = await getLatestFormConfigVersion(req.user!.clientId!) || '';
      }

      const mergedFormData = mergeFormDataJson(application, formData || {});
      let promotedFields = resolveLoanApplicationPromotedFields(mergedFormData, application);

      const existingProductId = String(application['Loan Product'] || application.loanProduct || '');
      if (promotedFields.productId && promotedFields.productId !== existingProductId) {
        await assertClientProductAssigned(req.user, promotedFields.productId);
      }

      const selectedVehicle = await resolveRequestedLoanAmountFromVehicleSelection(
        req.user,
        promotedFields.productId,
        {
          vehicleId:
            mergedFormData._vehicleId ??
            mergedFormData.vehicleId ??
            mergedFormData['Vehicle ID'],
          make:
            mergedFormData._vehicleMake ??
            mergedFormData.make ??
            mergedFormData.Make,
          model:
            mergedFormData._vehicleModel ??
            mergedFormData.model ??
            mergedFormData.Model,
        }
      );
      if (selectedVehicle) {
        promotedFields = {
          ...promotedFields,
          requestedLoanAmount: selectedVehicle.requestedLoanAmount,
        };
        mergedFormData._vehicleId = selectedVehicle.vehicleId;
        mergedFormData._vehicleMake = selectedVehicle.make;
        mergedFormData._vehicleModel = selectedVehicle.model;
        mergedFormData._vehicleRequestedLoanAmount = selectedVehicle.requestedLoanAmount;
      }

      const formDataToStore: Record<string, unknown> = {
        ...mergedFormData,
        applicantName: promotedFields.applicantName,
        productId: promotedFields.productId,
        requestedLoanAmount: promotedFields.requestedLoanAmount,
      };

      const updatedData = buildPromotedApplicationRecord(application, formDataToStore, promotedFields, {
        'Last Updated': new Date().toISOString(),
      }, {
        formConfigVersion: formConfigVersion || '',
      });

      await n8nClient.postLoanApplication(updatedData);

      void logApplicationAction(
        req.user!,
        AdminActionType.SAVE_DRAFT,
        application['File ID'],
        'Updated draft application form data',
        { formConfigVersion }
      ).catch((err: Error) =>
        console.warn('[updateApplicationForm] admin log failed:', err.message)
      );

      void n8nClient.postFileAuditLog({
        id: `AUDIT-${Date.now()}`,
        'Log Entry ID': `AUDIT-${Date.now()}`,
        File: application['File ID'],
        Timestamp: new Date().toISOString(),
        Actor: req.user.email,
        'Action/Event Type': 'update_form_data',
        'Details/Message': 'Application form data updated',
        'Target User/Role': 'client',
        Resolved: 'False',
      }).catch((err: Error) =>
        console.warn('[updateApplicationForm] file audit failed:', err.message)
      );

      res.json({
        success: true,
        message: 'Application form updated successfully',
        data: {
          loanApplicationId: application.id,
          fileId: application['File ID'] || application.fileId || application.id,
        },
      });
    } catch (error: any) {
      if (error instanceof ClientProductEntitlementError) {
        res.status(error.statusCode).json(entitlementErrorBody(error));
        return;
      }
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
      const { clientSubmissionId } = req.body ?? {};
      // Fetch only Loan Application table (bypass cache — must see freshly created drafts)
      // Records are automatically parsed by fetchTable() using N8nResponseParser
      // Returns ParsedRecord[] with clean field names (fields directly on object, not in 'fields' property)
      const applications = await n8nClient.fetchTable('Loan Application', false);
      const application = findLoanApplicationByParamId(applications, id);
      const appClient = application?.Client || application?.['Client'];

      if (!application || !matchIds(appClient, req.user.clientId)) {
        res.status(404).json({ success: false, error: 'Application not found' });
        return;
      }

      const applicationStatus = resolveApplicationRecordStatus(application);

      if (
        applicationStatus !== LoanStatus.DRAFT &&
        applicationStatus !== LoanStatus.QUERY_WITH_CLIENT
      ) {
        res.status(400).json({
          success: false,
          error: 'Application cannot be submitted in current status',
        });
        return;
      }

      // Parse form data from application
      let formData: Record<string, any> = {};
      try {
        const formDataStr = application['Form Data'] || application.formData || '{}';
        formData = typeof formDataStr === 'string' ? JSON.parse(formDataStr) : formDataStr;
      } catch (e) {
        console.error('[submitApplication] Error parsing form data:', e);
        formData = {};
      }

      // Strict mandatory field validation
      const { isB2cEvFormTemplate, validateB2cEvFormData } = await import(
        '../services/validation/b2cEvFormValidation.service.js'
      );

      const productId = application['Loan Product'] || application.loanProduct;
      let validationResult: {
        isValid: boolean;
        errorMessage?: string;
        missingFields?: Array<{ fieldId: string; label: string; type: string; displayKey?: string }>;
        formatErrors?: Array<{ fieldId: string; message: string }>;
      };

      if (isB2cEvFormTemplate(formData)) {
        validationResult = validateB2cEvFormData(formData, productId);
      } else {
        const { validateMandatoryFields } = await import('../services/validation/mandatoryFieldValidation.service.js');

        const documentLinks: Record<string, string> = {};
        Object.keys(formData).forEach((key) => {
          if (formData[key] && typeof formData[key] === 'string' &&
              (formData[key].includes('onedrive') || formData[key].includes('sharepoint') || formData[key].startsWith('http'))) {
            documentLinks[key] = formData[key];
          }
        });

        validationResult = await validateMandatoryFields(
          formData,
          req.user!.clientId!,
          productId,
          documentLinks
        );
      }

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
      let formConfigVersion = readFormConfigVersion(application as Record<string, unknown>);
      if (!formConfigVersion) {
        // Get latest version if not set
        const { getLatestFormConfigVersion } = await import('../services/formConfigVersioning.js');
        formConfigVersion = await getLatestFormConfigVersion(req.user!.clientId!) || '';
      }

      const { loanWorkflowService } = await import('../services/workflow/loanWorkflow.service.js');
      const result = await loanWorkflowService.submitExistingLoanApplication(req.user!, application, {
        formConfigVersion,
        clientSubmissionId,
      });

      // Module 0: Use admin logger helper
      await logApplicationAction(
        req.user!,
        AdminActionType.SUBMIT_APPLICATION,
        application['File ID'],
        'Submitted loan application',
        { formConfigVersion, statusChange: `${application.Status} → ${result.status}` }
      );

      res.json({
        success: true,
        message: 'Application submitted successfully',
        data: {
          fileId: result.fileId,
          status: result.status,
        },
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
      // Fetch only Loan Application table (bypass cache)
      const applications = await n8nClient.fetchTable('Loan Application', false);
      const application = findLoanApplicationByParamId(applications, id);
      const appClient = application?.Client || application?.['Client'];

      if (!application || !matchIds(appClient, req.user.clientId)) {
        res.status(404).json({ success: false, error: 'Application not found' });
        return;
      }

      const productStatuses = await getApplicationProductStatuses(application as Record<string, any>);
      const allowedNext = getAllowedStatusesFromProduct(application as Record<string, any>, productStatuses);
      if (!allowedNext.includes(LoanStatus.WITHDRAWN)) {
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

