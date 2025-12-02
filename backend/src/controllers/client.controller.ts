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

      const allData = await n8nClient.getAllData();
      const applications = allData['Loan Applications'] || [];
      const ledgerEntries = allData['Commission Ledger'] || [];
      const auditLogs = allData['File Auditing Log'] || [];

      // Filter by client
      const clientApplications = applications.filter(
        (app) => app.Client === req.user!.clientId
      );
      const clientLedger = ledgerEntries.filter(
        (entry) => entry.Client === req.user!.clientId
      );

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
   */
  async getFormConfig(req: Request, res: Response): Promise<void> {
    try {
      const { productId } = req.query;
      if (!productId) {
        res.status(400).json({ success: false, error: 'productId required' });
        return;
      }

      const allData = await n8nClient.getAllData();
      const mappings = allData['Client Form Mapping'] || [];
      const categories = allData['Form Categories'] || [];
      const fields = allData['Form Fields'] || [];

      // Get mappings for this client and product
      const clientMappings = mappings.filter(
        (m) => m.Client === req.user!.clientId
      );

      // Build form config
      const config = categories
        .filter((cat) => cat.Active === 'True')
        .map((cat) => {
          const categoryFields = fields
            .filter((f) => f.Category === cat['Category ID'] && f.Active === 'True')
            .map((f) => {
              const mapping = clientMappings.find(
                (m) => m.Category === cat['Category ID'] && m.Client === req.user!.clientId
              );
              return {
                fieldId: f['Field ID'],
                label: f['Field Label'],
                type: f['Field Type'],
                placeholder: f['Field Placeholder'],
                options: f['Field Options'],
                isRequired: mapping?.['Is Required'] === 'True' || f['Is Mandatory'] === 'True',
                displayOrder: parseInt(mapping?.['Display Order'] || f['Display Order'] || '0'),
              };
            })
            .sort((a, b) => a.displayOrder - b.displayOrder);

          return {
            categoryId: cat['Category ID'],
            categoryName: cat['Category Name'],
            description: cat.Description,
            displayOrder: parseInt(cat['Display Order'] || '0'),
            fields: categoryFields,
          };
        })
        .sort((a, b) => a.displayOrder - b.displayOrder);

      res.json({ success: true, data: config });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch form config',
      });
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
      const allData = await n8nClient.getAllData();
      const applications = allData['Loan Applications'] || [];
      const auditLogs = allData['File Auditing Log'] || [];

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

      // Log response
      await n8nClient.postFileAuditLog({
        id: `AUDIT-${Date.now()}`,
        'Log Entry ID': `AUDIT-${Date.now()}`,
        File: application['File ID'],
        Timestamp: new Date().toISOString(),
        Actor: req.user.email,
        'Action/Event Type': 'query_response',
        'Details/Message': `Response to query: ${message}`,
        'Target User/Role': query.Actor,
        Resolved: 'False',
      });

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

