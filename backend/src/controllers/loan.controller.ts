/**
 * Loan Applications Controller
 * Handles loan application CRUD operations
 */

import { Request, Response } from 'express';
import { n8nClient } from '../services/airtable/n8nClient.js';
import { dataFilterService } from '../services/airtable/dataFilter.service.js';
import { LoanStatus } from '../config/constants.js';

export class LoanController {
  /**
   * POST /loan-applications
   * Create draft application (CLIENT only)
   */
  async createApplication(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'client') {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      const { productId, borrowerIdentifiers } = req.body;

      // Generate File ID
      const fileId = `SF${Date.now()}`;

      // Create application in Airtable
      const applicationData = {
        id: `APP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        'File ID': fileId,
        Client: req.user.clientId!,
        'Applicant Name': borrowerIdentifiers?.name || '',
        'Loan Product': productId,
        'Requested Loan Amount': '',
        Status: LoanStatus.DRAFT,
        'Creation Date': new Date().toISOString().split('T')[0],
        'Last Updated': new Date().toISOString(),
      };

      const result = await n8nClient.postLoanApplication(applicationData);

      // Log admin activity
      await n8nClient.postAdminActivityLog({
        id: `ACT-${Date.now()}`,
        'Activity ID': `ACT-${Date.now()}`,
        Timestamp: new Date().toISOString(),
        'Performed By': req.user.email,
        'Action Type': 'create_application',
        'Description/Details': `Created draft loan application ${fileId}`,
        'Target Entity': 'loan_application',
      });

      res.json({
        success: true,
        data: {
          loanApplicationId: applicationData.id,
          fileId,
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
   */
  async listApplications(req: Request, res: Response): Promise<void> {
    try {
      const { status, dateFrom, dateTo, search } = req.query;
      // Fetch only Loan Application table instead of all data
      let applications = await n8nClient.fetchTable('Loan Application');

      // Filter by role
      applications = dataFilterService.filterLoanApplications(applications, req.user!);

      // Apply filters
      if (status) {
        applications = applications.filter((app) => app.Status === status);
      }

      if (dateFrom || dateTo) {
        applications = applications.filter((app) => {
          const appDate = app['Creation Date'] || '';
          if (dateFrom && appDate < dateFrom) return false;
          if (dateTo && appDate > dateTo) return false;
          return true;
        });
      }

      if (search) {
        const searchLower = (search as string).toLowerCase();
        applications = applications.filter(
          (app) =>
            app['File ID']?.toLowerCase().includes(searchLower) ||
            app['Applicant Name']?.toLowerCase().includes(searchLower) ||
            app.Client?.toLowerCase().includes(searchLower)
        );
      }

      res.json({
        success: true,
        data: applications.map((app) => ({
          id: app.id,
          fileId: app['File ID'],
          client: app.Client,
          applicantName: app['Applicant Name'],
          product: app['Loan Product'],
          requestedAmount: app['Requested Loan Amount'],
          status: app.Status,
          creationDate: app['Creation Date'],
        })),
      });
    } catch (error: any) {
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

      // Update form data
      const updatedData: any = {
        ...application,
        'Form Data': JSON.stringify(formData || {}),
        'Last Updated': new Date().toISOString(),
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

      // Update status
      await n8nClient.postLoanApplication({
        ...application,
        Status: LoanStatus.UNDER_KAM_REVIEW,
        'Submitted Date': new Date().toISOString().split('T')[0],
        'Last Updated': new Date().toISOString(),
      });

      // Log activities
      await n8nClient.postAdminActivityLog({
        id: `ACT-${Date.now()}`,
        'Activity ID': `ACT-${Date.now()}`,
        Timestamp: new Date().toISOString(),
        'Performed By': req.user.email,
        'Action Type': 'submit_application',
        'Description/Details': `Submitted loan application ${application['File ID']}`,
        'Target Entity': 'loan_application',
      });

      await n8nClient.postFileAuditLog({
        id: `AUDIT-${Date.now()}`,
        'Log Entry ID': `AUDIT-${Date.now()}`,
        File: application['File ID'],
        Timestamp: new Date().toISOString(),
        Actor: req.user.email,
        'Action/Event Type': 'status_change',
        'Details/Message': `Application submitted and moved to KAM review`,
        'Target User/Role': 'kam',
        Resolved: 'False',
      });

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

