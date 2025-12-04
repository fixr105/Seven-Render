/**
 * KAM (Key Account Manager) Controller
 */

import { Request, Response } from 'express';
import { n8nClient } from '../services/airtable/n8nClient.js';
import { dataFilterService } from '../services/airtable/dataFilter.service.js';
import { LoanStatus, Module } from '../config/constants.js';

export class KAMController {
  /**
   * GET /kam/dashboard
   */
  async getDashboard(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'kam') {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      // Fetch only the tables we need
      const [userAccounts, applications] = await Promise.all([
        n8nClient.fetchTable('User Accounts'),
        n8nClient.fetchTable('Loan Application'),
      ]);
      const [ledgerEntries, auditLogs] = await Promise.all([
        n8nClient.fetchTable('Commission Ledger'),
        n8nClient.fetchTable('File Auditing Log'),
      ]);

      // Get managed clients (clients with this KAM)
      const managedClients = userAccounts.filter(
        (u) => u.Role === 'client' // Simplified - adjust based on actual schema
      );

      // Get applications for managed clients
      const managedClientIds = managedClients.map((c) => c.id);
      const clientApplications = applications.filter((app) =>
        managedClientIds.includes(app.Client)
      );

      // Files by stage
      const filesByStage = {
        underReview: clientApplications.filter(
          (app) => app.Status === LoanStatus.UNDER_KAM_REVIEW
        ).length,
        queryPending: clientApplications.filter(
          (app) => app.Status === LoanStatus.QUERY_WITH_CLIENT
        ).length,
        readyForCredit: clientApplications.filter(
          (app) => app.Status === LoanStatus.PENDING_CREDIT_REVIEW
        ).length,
      };

      // Pending questions from Credit
      const pendingQuestions = auditLogs
        .filter(
          (log) =>
            log['Target User/Role'] === 'kam' &&
            log.Resolved === 'False' &&
            clientApplications.some((app) => app['File ID'] === log.File)
        )
        .map((log) => ({
          id: log.id,
          fileId: log.File,
          message: log['Details/Message'],
        }));

      // Ledger disputes for managed clients
      const ledgerDisputes = ledgerEntries
        .filter(
          (entry) =>
            managedClientIds.includes(entry.Client) &&
            entry['Dispute Status'] !== 'None'
        )
        .map((entry) => ({
          id: entry.id,
          client: entry.Client,
          amount: parseFloat(entry['Payout Amount'] || '0'),
          status: entry['Dispute Status'],
        }));

      res.json({
        success: true,
        data: {
          clients: managedClients.map((c) => ({
            id: c.id,
            name: c['Associated Profile'] || c.Username,
            email: c.Username,
            activeApplications: clientApplications.filter(
              (app) => app.Client === c.id && app.Status !== LoanStatus.CLOSED
            ).length,
          })),
          filesByStage,
          pendingQuestionsFromCredit: pendingQuestions,
          ledgerDisputes,
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
   * POST /kam/clients
   * Create new client
   */
  async createClient(req: Request, res: Response): Promise<void> {
    try {
      const { name, email, phone, kamId, enabledModules, commissionRate } = req.body;

      // Create user account with hashed password
      const { authService } = await import('../services/auth/auth.service.js');
      const hashedPassword = await authService.hashPassword('TempPassword123!');
      
      const userAccountData = {
        id: `USER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        Username: email,
        Password: hashedPassword, // Hashed password
        Role: 'client',
        'Associated Profile': name,
        'Account Status': 'Active',
      };

      await n8nClient.postUserAccount(userAccountData);

      // Create client record with commission rate
      const clientId = `CLIENT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const clientData = {
        id: clientId,
        'Client ID': clientId,
        'Client Name': name,
        'Primary Contact Name': name,
        'Contact Email / Phone': `${email} / ${phone || ''}`,
        'Assigned KAM': kamId || req.user!.kamId || '',
        'Enabled Modules': Array.isArray(enabledModules) ? enabledModules.join(', ') : (enabledModules || ''),
        'Commission Rate': commissionRate ? commissionRate.toString() : '1.5', // Default 1.5%
        'Status': 'Active',
        'Form Categories': '',
      };

      await n8nClient.postClient(clientData);

      // Log admin activity
      await n8nClient.postAdminActivityLog({
        id: `ACT-${Date.now()}`,
        'Activity ID': `ACT-${Date.now()}`,
        Timestamp: new Date().toISOString(),
        'Performed By': req.user!.email,
        'Action Type': 'create_client',
        'Description/Details': `Created new client: ${name}`,
        'Target Entity': 'client',
      });

      res.json({
        success: true,
        data: {
          clientId: userAccountData.id,
          message: 'Client created successfully',
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create client',
      });
    }
  }

  /**
   * PATCH /kam/clients/:id/modules
   * Update client enabled modules
   */
  async updateClientModules(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { enabledModules, commissionRate } = req.body;
      // Fetch only Clients table
      const clients = await n8nClient.fetchTable('Clients');
      const client = clients.find((c: any) => c.id === id || c['Client ID'] === id);

      if (!client) {
        res.status(404).json({ success: false, error: 'Client not found' });
        return;
      }

      // Update client record
      const updateData: any = {
        ...client,
      };

      if (enabledModules !== undefined) {
        updateData['Enabled Modules'] = Array.isArray(enabledModules) 
          ? enabledModules.join(', ') 
          : enabledModules;
      }

      if (commissionRate !== undefined) {
        updateData['Commission Rate'] = commissionRate.toString();
      }

      await n8nClient.postClient(updateData);

      await n8nClient.postAdminActivityLog({
        id: `ACT-${Date.now()}`,
        'Activity ID': `ACT-${Date.now()}`,
        Timestamp: new Date().toISOString(),
        'Performed By': req.user!.email,
        'Action Type': 'update_client',
        'Description/Details': `Updated client ${id}${enabledModules ? `: modules: ${Array.isArray(enabledModules) ? enabledModules.join(', ') : enabledModules}` : ''}${commissionRate ? `, commission rate: ${commissionRate}%` : ''}`,
        'Target Entity': 'client',
      });

      res.json({
        success: true,
        message: 'Client updated successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update client',
      });
    }
  }

  /**
   * GET /kam/clients/:id
   * Get client details including modules and settings (KAM only)
   */
  async getClient(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'kam') {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      const { id } = req.params;

      // Verify this client is managed by this KAM
      const managedClients = await dataFilterService.getKAMManagedClients(req.user.kamId!);
      if (!managedClients.includes(id)) {
        res.status(403).json({ success: false, error: 'Access denied: Client not managed by this KAM' });
        return;
      }

      // Fetch only Clients table
      const clients = await n8nClient.fetchTable('Clients');
      const client = clients.find((c) => c.id === id);

      if (!client) {
        res.status(404).json({ success: false, error: 'Client not found' });
        return;
      }

      // Parse enabled modules
      const enabledModules = client['Enabled Modules']
        ? client['Enabled Modules'].split(',').map((m: string) => m.trim()).filter(Boolean)
        : [];

      res.json({
        success: true,
        data: {
          id: client.id,
          clientId: client['Client ID'],
          clientName: client['Client Name'],
          primaryContactName: client['Primary Contact Name'],
          contactEmailPhone: client['Contact Email / Phone'],
          assignedKAM: client['Assigned KAM'],
          enabledModules,
          commissionRate: client['Commission Rate'] ? parseFloat(client['Commission Rate']) : null,
          status: client.Status,
          formCategories: client['Form Categories'] ? client['Form Categories'].split(',').map((c: string) => c.trim()) : [],
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch client',
      });
    }
  }

  /**
   * GET /kam/clients/:id/form-mappings
   * Get form mappings for a client
   */
  async getFormMappings(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      // Fetch only Client Form Mapping table
      const mappings = await n8nClient.fetchTable('Client Form Mapping');

      const clientMappings = mappings.filter((m) => m.Client === id);

      res.json({
        success: true,
        data: clientMappings,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch form mappings',
      });
    }
  }

  /**
   * POST /kam/clients/:id/form-mappings
   * Create/update form mappings for a client
   */
  async createFormMapping(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { productId, categoryId, fieldId, isRequired, displayOrder } = req.body;

      const mappingData = {
        id: `MAP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        'Mapping ID': `MAP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        Client: id,
        Category: categoryId,
        'Is Required': isRequired ? 'True' : 'False',
        'Display Order': displayOrder?.toString() || '0',
      };

      await n8nClient.postClientFormMapping(mappingData);

      await n8nClient.postAdminActivityLog({
        id: `ACT-${Date.now()}`,
        'Activity ID': `ACT-${Date.now()}`,
        Timestamp: new Date().toISOString(),
        'Performed By': req.user!.email,
        'Action Type': 'create_form_mapping',
        'Description/Details': `Created form mapping for client ${id}`,
        'Target Entity': 'form_mapping',
      });

      res.json({
        success: true,
        data: mappingData,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create form mapping',
      });
    }
  }

  /**
   * GET /kam/loan-applications
   * List loan applications for KAM's managed clients
   */
  async listApplications(req: Request, res: Response): Promise<void> {
    try {
      const { status, clientId } = req.query;
      // Fetch only the tables we need
      const [userAccounts, applications] = await Promise.all([
        n8nClient.fetchTable('User Accounts'),
        n8nClient.fetchTable('Loan Application'),
      ]);
      let apps = applications;

      // Get managed clients
      const managedClients = userAccounts.filter((u) => u.Role === 'client');
      const managedClientIds = managedClients.map((c) => c.id);

      // Filter by managed clients
      applications = applications.filter((app) =>
        managedClientIds.includes(app.Client)
      );

      if (status) {
        applications = applications.filter((app) => app.Status === status);
      }

      if (clientId) {
        applications = applications.filter((app) => app.Client === clientId);
      }

      res.json({
        success: true,
        data: applications.map((app) => ({
          id: app.id,
          fileId: app['File ID'],
          client: app.Client,
          applicantName: app['Applicant Name'],
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
   * POST /kam/loan-applications/:id/edit
   * Edit application (KAM review stage)
   */
  async editApplication(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { formData, notes } = req.body;
      // Fetch only Loan Application table
      const applications = await n8nClient.fetchTable('Loan Application');
      const application = applications.find((app) => app.id === id);

      if (!application) {
        res.status(404).json({ success: false, error: 'Application not found' });
        return;
      }

      // Check if in KAM review stage
      if (
        application.Status !== LoanStatus.UNDER_KAM_REVIEW &&
        application.Status !== LoanStatus.QUERY_WITH_CLIENT
      ) {
        res.status(400).json({
          success: false,
          error: 'Application not in KAM review stage',
        });
        return;
      }

      // Update application
      const updatedData = {
        ...application,
        'Form Data': formData ? JSON.stringify(formData) : application['Form Data'],
        'Last Updated': new Date().toISOString(),
      };

      await n8nClient.postLoanApplication(updatedData);

      // Log to file audit
      await n8nClient.postFileAuditLog({
        id: `AUDIT-${Date.now()}`,
        'Log Entry ID': `AUDIT-${Date.now()}`,
        File: application['File ID'],
        Timestamp: new Date().toISOString(),
        Actor: req.user!.email,
        'Action/Event Type': 'edit_application',
        'Details/Message': notes || 'Application edited by KAM',
        'Target User/Role': 'client',
        Resolved: 'False',
      });

      res.json({
        success: true,
        message: 'Application updated successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update application',
      });
    }
  }

  /**
   * POST /kam/loan-applications/:id/queries
   * Raise query to client
   */
  async raiseQuery(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { message, fieldsRequested, documentsRequested, allowsClientToEdit } = req.body;
      // Fetch only Loan Application table
      const applications = await n8nClient.fetchTable('Loan Application');
      const application = applications.find((app) => app.id === id);

      if (!application) {
        res.status(404).json({ success: false, error: 'Application not found' });
        return;
      }

      // Update status
      await n8nClient.postLoanApplication({
        ...application,
        Status: LoanStatus.QUERY_WITH_CLIENT,
        'Last Updated': new Date().toISOString(),
      });

      // Log query
      const queryMessage = [
        message,
        fieldsRequested?.length ? `Fields requested: ${fieldsRequested.join(', ')}` : '',
        documentsRequested?.length ? `Documents requested: ${documentsRequested.join(', ')}` : '',
      ]
        .filter(Boolean)
        .join('. ');

      await n8nClient.postFileAuditLog({
        id: `AUDIT-${Date.now()}`,
        'Log Entry ID': `AUDIT-${Date.now()}`,
        File: application['File ID'],
        Timestamp: new Date().toISOString(),
        Actor: req.user!.email,
        'Action/Event Type': 'query_raised',
        'Details/Message': queryMessage,
        'Target User/Role': 'client',
        Resolved: 'False',
      });

      await n8nClient.postAdminActivityLog({
        id: `ACT-${Date.now()}`,
        'Activity ID': `ACT-${Date.now()}`,
        Timestamp: new Date().toISOString(),
        'Performed By': req.user!.email,
        'Action Type': 'raise_query',
        'Description/Details': `Query raised for application ${application['File ID']}`,
        'Target Entity': 'loan_application',
      });

      // Send notification
      try {
        const { notificationService } = await import('../services/notifications/notification.service.js');
        const clients = await n8nClient.fetchTable('Clients');
        const client = clients.find((c: any) => c.id === application.Client || c['Client ID'] === application.Client);
        const clientEmail = client?.['Contact Email / Phone']?.split(' / ')[0] || '';
        
        if (clientEmail) {
          await notificationService.notifyQueryCreated(
            application['File ID'],
            application.Client,
            queryMessage,
            clientEmail,
            'client',
            req.user!.email
          );
        }
      } catch (notifError) {
        console.error('Failed to send notification:', notifError);
      }

      res.json({
        success: true,
        message: 'Query raised successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to raise query',
      });
    }
  }

  /**
   * POST /kam/loan-applications/:id/forward-to-credit
   * Forward application to credit team
   */
  async forwardToCredit(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      // Fetch only Loan Application table
      const applications = await n8nClient.fetchTable('Loan Application');
      const application = applications.find((app) => app.id === id);

      if (!application) {
        res.status(404).json({ success: false, error: 'Application not found' });
        return;
      }

      // Check preconditions
      if (
        application.Status !== LoanStatus.UNDER_KAM_REVIEW &&
        application.Status !== LoanStatus.QUERY_WITH_CLIENT
      ) {
        res.status(400).json({
          success: false,
          error: 'Application cannot be forwarded in current status',
        });
        return;
      }

      // Update status
      await n8nClient.postLoanApplication({
        ...application,
        Status: LoanStatus.PENDING_CREDIT_REVIEW,
        'Last Updated': new Date().toISOString(),
      });

      // Log activities
      await n8nClient.postFileAuditLog({
        id: `AUDIT-${Date.now()}`,
        'Log Entry ID': `AUDIT-${Date.now()}`,
        File: application['File ID'],
        Timestamp: new Date().toISOString(),
        Actor: req.user!.email,
        'Action/Event Type': 'forward_to_credit',
        'Details/Message': 'Application forwarded to credit team for review',
        'Target User/Role': 'credit_team',
        Resolved: 'False',
      });

      await n8nClient.postAdminActivityLog({
        id: `ACT-${Date.now()}`,
        'Activity ID': `ACT-${Date.now()}`,
        Timestamp: new Date().toISOString(),
        'Performed By': req.user!.email,
        'Action Type': 'forward_to_credit',
        'Description/Details': `Application ${application['File ID']} forwarded to credit`,
        'Target Entity': 'loan_application',
      });

      res.json({
        success: true,
        message: 'Application forwarded to credit team',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to forward application',
      });
    }
  }
}

export const kamController = new KAMController();

