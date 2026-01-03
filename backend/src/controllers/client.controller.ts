/**
 * Client (DSA) Controller
 */

import { Request, Response } from 'express';
import { n8nClient } from '../services/airtable/n8nClient.js';
import { dataFilterService } from '../services/airtable/dataFilter.service.js';
import { LoanStatus } from '../config/constants.js';

export class ClientController {
  /**
   * GET /client/dashboard
   */
  async getDashboard(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'client') {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      // Fetch only the tables we need
      // Use Promise.allSettled to handle partial failures gracefully
      // DISABLE CACHE to ensure webhooks are called every time (user requested manual refresh triggers webhooks)
      const results = await Promise.allSettled([
        n8nClient.fetchTable('Loan Application', false), // Disable cache
        n8nClient.fetchTable('Commission Ledger', false), // Disable cache
        n8nClient.fetchTable('File Auditing Log', false), // Disable cache
      ]);
      
      // Extract results, using empty arrays as fallback for failed requests
      const allApplications = results[0].status === 'fulfilled' ? results[0].value : [];
      const allLedgerEntries = results[1].status === 'fulfilled' ? results[1].value : [];
      const allAuditLogs = results[2].status === 'fulfilled' ? results[2].value : [];
      
      // Log any failures
      if (results[0].status === 'rejected') {
        console.error('[getDashboard] Failed to fetch Loan Application:', results[0].reason);
      }
      if (results[1].status === 'rejected') {
        console.error('[getDashboard] Failed to fetch Commission Ledger:', results[1].reason);
      }
      if (results[2].status === 'rejected') {
        console.error('[getDashboard] Failed to fetch File Auditing Log:', results[2].reason);
      }

      // Apply RBAC filtering using centralized service
      const { rbacFilterService } = await import('../services/rbac/rbacFilter.service.js');
      const clientApplications = await rbacFilterService.filterLoanApplications(allApplications, req.user!);
      const clientLedger = await rbacFilterService.filterCommissionLedger(allLedgerEntries, req.user!);
      const auditLogs = await rbacFilterService.filterFileAuditLog(allAuditLogs, req.user!);

      // Calculate ledger summary
      const totalEarned = clientLedger
        .filter((e) => parseFloat(e['Payout Amount']) > 0)
        .reduce((sum, e) => sum + parseFloat(e['Payout Amount'] || '0'), 0);

      const paid = clientLedger
        .filter((e) => e['Payout Request'] === 'Paid' || e['Payout Request'] === 'True')
        .reduce((sum, e) => sum + Math.abs(parseFloat(e['Payout Amount'] || '0')), 0);

      const pending = totalEarned - paid;
      const balance = totalEarned;

      // Get pending queries
      const pendingQueries = auditLogs
        .filter(
          (log) =>
            log.File &&
            clientApplications.some((app) => app['File ID'] === log.File) &&
            log.Resolved === 'False'
        )
        .map((log) => ({
          id: log.id,
          fileId: log.File,
          message: log['Details/Message'],
          raisedBy: log.Actor,
          timestamp: log.Timestamp,
        }));

      // Get payout requests
      const payoutRequests = clientLedger
        .filter((e) => e['Payout Request'] && e['Payout Request'] !== 'False')
        .map((e) => ({
          id: e.id,
          amount: parseFloat(e['Payout Amount'] || '0'),
          status: e['Payout Request'],
          requestedDate: e.Date,
        }));

      res.json({
        success: true,
        data: {
          activeApplications: clientApplications
            .filter((app) => app.Status !== LoanStatus.CLOSED && app.Status !== LoanStatus.REJECTED)
            .map((app) => ({
              id: app.id,
              fileId: app['File ID'],
              status: app.Status,
              applicantName: app['Applicant Name'],
              requestedAmount: app['Requested Loan Amount'],
            })),
          ledgerSummary: {
            totalEarned,
            pending,
            paid,
            balance,
          },
          pendingQueries,
          payoutRequests,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch dashboard',
      });
    }
  }

  /**
   * GET /client/form-config
   * 
   * Webhook Mapping:
   * - GET → n8nClient.fetchTable('Client Form Mapping') → /webhook/clientformmapping → Airtable: Client Form Mapping
   * - GET → n8nClient.fetchTable('Form Categories') → /webhook/formcategories → Airtable: Form Categories
   * - GET → n8nClient.fetchTable('Form Fields') → /webhook/formfields → Airtable: Form Fields
   * 
   * Frontend: src/pages/NewApplication.tsx (line 100)
   * See WEBHOOK_MAPPING_TABLE.md for complete mapping
   */
  async getFormConfig(req: Request, res: Response): Promise<void> {
    try {
      // Check if user is authenticated
      if (!req.user || !req.user.clientId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required. Client ID not found.',
        });
        return;
      }

      // Use centralized form config service
      const { formConfigService } = await import('../services/formConfig/formConfig.service.js');

      // productId is optional - form config can be linked to specific product
      // applicationId is optional - if provided, use form config version from that application (for versioning)
      const { productId, applicationId } = req.query;
      
      // Get version from application if provided
      let version: string | undefined;
      if (applicationId) {
        const applications = await n8nClient.fetchTable('Loan Application');
        const application = applications.find((app: any) => app.id === applicationId);
        if (application && application.Client === req.user!.clientId) {
          version = application['Form Config Version'] || undefined;
        }
      }

      // Get client dashboard configuration (only enabled modules)
      const config = await formConfigService.getClientDashboardConfig(
        req.user!.clientId!,
        productId as string | undefined,
        version
      );

      console.log(`[getFormConfig] Returning configuration for client ${req.user!.clientId} with ${config.modules.length} enabled modules`);

      // Transform to match expected frontend format
      const responseData = {
        clientId: config.clientId,
        clientName: config.clientName,
        enabledModules: config.enabledModules,
        modules: config.modules.map((module) => ({
          moduleId: module.moduleId,
          moduleName: module.moduleName,
          description: module.description,
          enabled: module.enabled,
          categories: module.categories.map((cat) => ({
            categoryId: cat.categoryId,
            categoryName: cat.categoryName,
            description: cat.description,
            isRequired: cat.isRequired,
            displayOrder: cat.displayOrder,
            fields: cat.fields,
          })),
        })),
        version: config.version,
        productId: config.productId,
      };

      res.json({
        success: true,
        data: responseData,
      });
    } catch (error: any) {
      console.error('[getFormConfig] Unexpected error:', error);
      // Ensure error response is always valid JSON
      const errorResponse = {
        success: false,
        error: error.message || 'Failed to fetch form config',
      };
      res.status(500).json(errorResponse);
    }
  }

  /**
   * POST /loan-applications/:id/queries/:queryId/reply
   * Respond to query (CLIENT only)
   */
  async respondToQuery(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'client') {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      const { id, queryId } = req.params;
      const { message, newDocs, answers } = req.body;
      // Fetch only the tables we need
      const [applications, auditLogs] = await Promise.all([
        n8nClient.fetchTable('Loan Application'),
        n8nClient.fetchTable('File Auditing Log'),
      ]);

      const application = applications.find((app) => app.id === id);
      if (!application || application.Client !== req.user.clientId) {
        res.status(404).json({ success: false, error: 'Application not found' });
        return;
      }

      const query = auditLogs.find((log) => log.id === queryId);
      if (!query || query.File !== application['File ID']) {
        res.status(404).json({ success: false, error: 'Query not found' });
        return;
      }

      // Update form data if answers provided
      if (answers) {
        const currentFormData = application['Form Data']
          ? JSON.parse(application['Form Data'])
          : {};
        const updatedFormData = { ...currentFormData, ...answers };

        await n8nClient.postLoanApplication({
          ...application,
          'Form Data': JSON.stringify(updatedFormData),
          'Last Updated': new Date().toISOString(),
        });
      }

      // Update documents if new docs provided
      if (newDocs && newDocs.length > 0) {
        const documents = application.Documents
          ? application.Documents.split(',').filter(Boolean)
          : [];
        newDocs.forEach((doc: any) => {
          documents.push(`${doc.fieldId}:${doc.fileUrl}`);
        });

        await n8nClient.postLoanApplication({
          ...application,
          Documents: documents.join(','),
          'Last Updated': new Date().toISOString(),
        });
      }

      // Use query service to create reply
      const { queryService } = await import('../services/queries/query.service.js');
      const replyMessage = [
        message,
        answers ? `Answers provided: ${Object.keys(answers).join(', ')}` : '',
        newDocs?.length ? `New documents uploaded: ${newDocs.length}` : '',
      ]
        .filter(Boolean)
        .join('. ');

      await queryService.createQueryReply(
        queryId,
        application['File ID'],
        application.Client,
        req.user.email,
        'client',
        replyMessage,
        query['Target User/Role'] || query.Actor || 'kam'
      );

      // If status was QUERY_WITH_CLIENT, it can transition back to UNDER_KAM_REVIEW
      // (KAM will need to acknowledge)
      if (application.Status === 'query_with_client') {
        await n8nClient.postLoanApplication({
          ...application,
          Status: 'under_kam_review',
          'Last Updated': new Date().toISOString(),
        });
      }

      res.json({
        success: true,
        message: 'Query response submitted successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to respond to query',
      });
    }
  }
}

export const clientController = new ClientController();

