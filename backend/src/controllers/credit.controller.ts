/**
 * Credit Team Controller
 */

import { Request, Response } from 'express';
import { n8nClient } from '../services/airtable/n8nClient.js';
import { LoanStatus, LenderDecisionStatus, DisputeStatus } from '../config/constants.js';

export class CreditController {
  /**
   * GET /credit/dashboard
   */
  async getDashboard(req: Request, res: Response): Promise<void> {
    try {
      const allData = await n8nClient.getAllData();
      const applications = allData['Loan Applications'] || [];
      const auditLogs = allData['File Auditing Log'] || [];

      // Files by stage
      const filesByStage = {
        pendingCreditReview: applications.filter(
          (app) => app.Status === LoanStatus.PENDING_CREDIT_REVIEW
        ).length,
        queryWithKAM: applications.filter(
          (app) => app.Status === LoanStatus.CREDIT_QUERY_WITH_KAM
        ).length,
        inNegotiation: applications.filter(
          (app) => app.Status === LoanStatus.IN_NEGOTIATION
        ).length,
        sentToNBFC: applications.filter(
          (app) => app.Status === LoanStatus.SENT_TO_NBFC
        ).length,
        approved: applications.filter((app) => app.Status === LoanStatus.APPROVED).length,
        rejected: applications.filter((app) => app.Status === LoanStatus.REJECTED).length,
        disbursed: applications.filter((app) => app.Status === LoanStatus.DISBURSED).length,
      };

      // Aggregate metrics for today
      const today = new Date().toISOString().split('T')[0];
      const todayApplications = applications.filter(
        (app) => app['Creation Date'] === today || app['Submitted Date'] === today
      );

      const aggregateMetrics = {
        filesReceivedToday: todayApplications.filter(
          (app) => app['Creation Date'] === today
        ).length,
        filesSentToLendersToday: todayApplications.filter(
          (app) => app.Status === LoanStatus.SENT_TO_NBFC && app['Last Updated']?.startsWith(today)
        ).length,
        filesApprovedToday: todayApplications.filter(
          (app) => app.Status === LoanStatus.APPROVED && app['Last Updated']?.startsWith(today)
        ).length,
        filesRejectedToday: todayApplications.filter(
          (app) => app.Status === LoanStatus.REJECTED && app['Last Updated']?.startsWith(today)
        ).length,
        totalDisbursedToday: applications
          .filter(
            (app) =>
              app.Status === LoanStatus.DISBURSED &&
              app['Last Updated']?.startsWith(today)
          )
          .reduce((sum, app) => sum + parseFloat(app['Approved Loan Amount'] || '0'), 0),
        pendingQueries: auditLogs.filter((log) => log.Resolved === 'False').length,
      };

      res.json({
        success: true,
        data: {
          filesByStage,
          aggregateMetrics,
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
   * GET /credit/loan-applications
   */
  async listApplications(req: Request, res: Response): Promise<void> {
    try {
      const { status, kamId, clientId, nbfcId, productId, dateFrom, dateTo } = req.query;
      const allData = await n8nClient.getAllData();
      let applications = allData['Loan Applications'] || [];

      // Apply filters
      if (status) {
        applications = applications.filter((app) => app.Status === status);
      }

      if (clientId) {
        applications = applications.filter((app) => app.Client === clientId);
      }

      if (nbfcId) {
        applications = applications.filter((app) => app['Assigned NBFC'] === nbfcId);
      }

      if (productId) {
        applications = applications.filter((app) => app['Loan Product'] === productId);
      }

      if (dateFrom || dateTo) {
        applications = applications.filter((app) => {
          const appDate = app['Creation Date'] || '';
          if (dateFrom && appDate < dateFrom) return false;
          if (dateTo && appDate > dateTo) return false;
          return true;
        });
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
          assignedNBFC: app['Assigned NBFC'],
          lenderDecision: app['Lender Decision Status'],
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
   * GET /credit/loan-applications/:id
   */
  async getApplication(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const allData = await n8nClient.getAllData();
      const applications = allData['Loan Applications'] || [];
      const auditLogs = allData['File Auditing Log'] || [];

      const application = applications.find((app) => app.id === id);

      if (!application) {
        res.status(404).json({ success: false, error: 'Application not found' });
        return;
      }

      // Get audit log
      const fileAuditLog = auditLogs
        .filter((log) => log.File === application['File ID'])
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
          aiFileSummary: application['AI File Summary'],
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
   * POST /credit/loan-applications/:id/queries
   * Raise credit query back to KAM
   */
  async raiseQuery(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { message, requestedDocs, clarifications } = req.body;
      const allData = await n8nClient.getAllData();
      const applications = allData['Loan Applications'] || [];
      const application = applications.find((app) => app.id === id);

      if (!application) {
        res.status(404).json({ success: false, error: 'Application not found' });
        return;
      }

      // Update status
      await n8nClient.postLoanApplication({
        ...application,
        Status: LoanStatus.CREDIT_QUERY_WITH_KAM,
        'Last Updated': new Date().toISOString(),
      });

      // Log query
      const queryMessage = [
        message,
        requestedDocs?.length ? `Documents requested: ${requestedDocs.join(', ')}` : '',
        clarifications?.length ? `Clarifications: ${clarifications.join(', ')}` : '',
      ]
        .filter(Boolean)
        .join('. ');

      await n8nClient.postFileAuditLog({
        id: `AUDIT-${Date.now()}`,
        'Log Entry ID': `AUDIT-${Date.now()}`,
        File: application['File ID'],
        Timestamp: new Date().toISOString(),
        Actor: req.user!.email,
        'Action/Event Type': 'credit_query',
        'Details/Message': queryMessage,
        'Target User/Role': 'kam',
        Resolved: 'False',
      });

      // Send notification to KAM
      try {
        const { notificationService } = await import('../services/notifications/notification.service.js');
        const kamUsers = allData['KAM Users'] || [];
        
        // Find KAM assigned to this client
        const clients = allData['Clients'] || [];
        const client = clients.find((c: any) => c.id === application.Client || c['Client ID'] === application.Client);
        const kamId = client?.['Assigned KAM'] || '';
        
        if (kamId) {
          const kamUser = kamUsers.find((k: any) => k.id === kamId || k['KAM ID'] === kamId);
          const kamEmail = kamUser?.Email || '';
          
          if (kamEmail) {
            await notificationService.notifyQueryCreated(
              application['File ID'],
              application.Client,
              queryMessage,
              kamEmail,
              'kam',
              req.user!.email
            );
          }
        }
      } catch (notifError) {
        console.error('Failed to send notification:', notifError);
      }

      res.json({
        success: true,
        message: 'Query raised to KAM',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to raise query',
      });
    }
  }

  /**
   * POST /credit/loan-applications/:id/mark-in-negotiation
   */
  async markInNegotiation(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const allData = await n8nClient.getAllData();
      const applications = allData['Loan Applications'] || [];
      const application = applications.find((app) => app.id === id);

      if (!application) {
        res.status(404).json({ success: false, error: 'Application not found' });
        return;
      }

      await n8nClient.postLoanApplication({
        ...application,
        Status: LoanStatus.IN_NEGOTIATION,
        'Last Updated': new Date().toISOString(),
      });

      await n8nClient.postFileAuditLog({
        id: `AUDIT-${Date.now()}`,
        'Log Entry ID': `AUDIT-${Date.now()}`,
        File: application['File ID'],
        Timestamp: new Date().toISOString(),
        Actor: req.user!.email,
        'Action/Event Type': 'status_change',
        'Details/Message': 'Application marked as in negotiation',
        'Target User/Role': 'client',
        Resolved: 'False',
      });

      res.json({
        success: true,
        message: 'Application marked as in negotiation',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update status',
      });
    }
  }

  /**
   * POST /credit/loan-applications/:id/assign-nbfcs
   */
  async assignNBFCs(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { nbfcIds } = req.body;
      const allData = await n8nClient.getAllData();
      const applications = allData['Loan Applications'] || [];
      const application = applications.find((app) => app.id === id);

      if (!application) {
        res.status(404).json({ success: false, error: 'Application not found' });
        return;
      }

      // Update with assigned NBFCs (comma-separated if multiple)
      await n8nClient.postLoanApplication({
        ...application,
        'Assigned NBFC': Array.isArray(nbfcIds) ? nbfcIds.join(', ') : nbfcIds,
        Status: LoanStatus.SENT_TO_NBFC,
        'Last Updated': new Date().toISOString(),
      });

      await n8nClient.postAdminActivityLog({
        id: `ACT-${Date.now()}`,
        'Activity ID': `ACT-${Date.now()}`,
        Timestamp: new Date().toISOString(),
        'Performed By': req.user!.email,
        'Action Type': 'assign_nbfc',
        'Description/Details': `Assigned NBFCs to application ${application['File ID']}: ${nbfcIds.join(', ')}`,
        'Target Entity': 'loan_application',
      });

      res.json({
        success: true,
        message: 'NBFCs assigned successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to assign NBFCs',
      });
    }
  }

  /**
   * POST /credit/loan-applications/:id/nbfc-decision
   * Capture NBFC decision (for offline decisions)
   */
  async captureNBFCDecision(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { nbfcId, decision, approvedAmount, terms, rejectionReason, clarificationMessage } = req.body;
      const allData = await n8nClient.getAllData();
      const applications = allData['Loan Applications'] || [];
      const application = applications.find((app) => app.id === id);

      if (!application) {
        res.status(404).json({ success: false, error: 'Application not found' });
        return;
      }

      const updateData: any = {
        ...application,
        'Lender Decision Status': decision,
        'Lender Decision Date': new Date().toISOString().split('T')[0],
        'Last Updated': new Date().toISOString(),
      };

      if (decision === LenderDecisionStatus.APPROVED) {
        updateData['Approved Loan Amount'] = approvedAmount?.toString() || '';
        updateData['Lender Decision Remarks'] = terms || '';
        // If any NBFC approves, status can move to approved
        if (application.Status === LoanStatus.SENT_TO_NBFC) {
          updateData.Status = LoanStatus.APPROVED;
        }
      } else if (decision === LenderDecisionStatus.REJECTED) {
        updateData['Lender Decision Remarks'] = rejectionReason || '';
        // Check if all NBFCs rejected
        // For now, just update status
        updateData.Status = LoanStatus.REJECTED;
      } else if (decision === LenderDecisionStatus.NEEDS_CLARIFICATION) {
        updateData['Lender Decision Remarks'] = clarificationMessage || '';
      }

      await n8nClient.postLoanApplication(updateData);

      await n8nClient.postFileAuditLog({
        id: `AUDIT-${Date.now()}`,
        'Log Entry ID': `AUDIT-${Date.now()}`,
        File: application['File ID'],
        Timestamp: new Date().toISOString(),
        Actor: req.user!.email,
        'Action/Event Type': 'nbfc_decision',
        'Details/Message': `NBFC decision: ${decision}${approvedAmount ? ` - Amount: ${approvedAmount}` : ''}`,
        'Target User/Role': 'credit_team',
        Resolved: 'False',
      });

      res.json({
        success: true,
        message: 'NBFC decision recorded',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to record decision',
      });
    }
  }

  /**
   * POST /credit/loan-applications/:id/mark-disbursed
   * Mark application as disbursed and create commission entry
   * 
   * Automation:
   * 1. Fetches client's commission_rate from Client table
   * 2. Calculates commission (commission_rate * loan_amount)
   * 3. Creates Payout entry if commission is positive
   * 4. Creates Payin entry (negative) if commission is negative
   * 5. Links to loan application ID and disbursement timestamp
   */
  async markDisbursed(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { disbursedAmount, disbursedDate } = req.body;
      const allData = await n8nClient.getAllData();
      const applications = allData['Loan Applications'] || [];
      const application = applications.find((app) => app.id === id);

      if (!application) {
        res.status(404).json({ success: false, error: 'Application not found' });
        return;
      }

      // Fetch client's commission_rate from Client table
      // Note: Clients are stored in Airtable, we need to get it from the Client field
      // The Client field in Loan Applications is a reference to the Client table
      let commissionRate = 1.5; // Default fallback
      
      // Try to get client data - Clients might be in a separate table or referenced
      // For now, we'll check if there's a Clients table in the data
      // If not available, we'll use the default rate
      const clients = allData['Clients'] || [];
      const client = clients.find((c: any) => c.id === application.Client || c['Client ID'] === application.Client);
      
      if (client && client['Commission Rate']) {
        // Commission Rate is stored as string (e.g., "1.5" for 1.5%)
        const rateStr = client['Commission Rate'].toString().trim();
        commissionRate = parseFloat(rateStr) || 1.5;
      }

      // Calculate commission
      const loanAmount = parseFloat(disbursedAmount);
      const commission = (loanAmount * commissionRate) / 100;

      // Determine if it's a Payout (positive) or Payin (negative)
      // Payout: commission is positive (client earns money)
      // Payin: commission is negative (client owes money) - store as negative amount
      const payoutAmount = commission >= 0 ? commission : -Math.abs(commission);
      const entryType = commission >= 0 ? 'Payout' : 'Payin';

      // Update application status
      await n8nClient.postLoanApplication({
        ...application,
        Status: LoanStatus.DISBURSED,
        'Approved Loan Amount': disbursedAmount.toString(),
        'Last Updated': new Date().toISOString(),
      });

      // Create commission ledger entry
      const ledgerEntryId = `LEDGER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const disbursementDate = disbursedDate || new Date().toISOString().split('T')[0];
      const disbursementTimestamp = new Date().toISOString();

      const ledgerEntry = {
        id: ledgerEntryId,
        'Ledger Entry ID': ledgerEntryId,
        Client: application.Client,
        'Loan File': application['File ID'],
        Date: disbursementDate,
        'Disbursed Amount': disbursedAmount.toString(),
        'Commission Rate': commissionRate.toString(),
        'Payout Amount': payoutAmount.toString(), // Positive for Payout, negative for Payin
        Description: `${entryType} for loan disbursement - ${application['File ID']} (Commission: ${commissionRate}% of ${disbursedAmount})`,
        'Dispute Status': DisputeStatus.NONE,
        'Payout Request': 'False',
      };

      await n8nClient.postCommissionLedger(ledgerEntry);

      // Log activities
      await n8nClient.postAdminActivityLog({
        id: `ACT-${Date.now()}`,
        'Activity ID': `ACT-${Date.now()}`,
        Timestamp: disbursementTimestamp,
        'Performed By': req.user!.email,
        'Action Type': 'mark_disbursed',
        'Description/Details': `Application ${application['File ID']} marked as disbursed. Amount: ${disbursedAmount}, Commission Rate: ${commissionRate}%, ${entryType}: ${Math.abs(payoutAmount)}`,
        'Target Entity': 'loan_application',
      });

      await n8nClient.postFileAuditLog({
        id: `AUDIT-${Date.now()}`,
        'Log Entry ID': `AUDIT-${Date.now()}`,
        File: application['File ID'],
        Timestamp: disbursementTimestamp,
        Actor: req.user!.email,
        'Action/Event Type': 'disbursed',
        'Details/Message': `Loan disbursed. Amount: ${disbursedAmount}, Commission Rate: ${commissionRate}%, ${entryType}: ${Math.abs(payoutAmount)}`,
        'Target User/Role': 'client',
        Resolved: 'False',
      });

      // Send notifications
      try {
        const { notificationService } = await import('../services/notifications/notification.service.js');
        
        // Get client email from Client table
        const clients = allData['Clients'] || [];
        const client = clients.find((c: any) => c.id === application.Client || c['Client ID'] === application.Client);
        const clientEmail = client?.['Contact Email / Phone']?.split(' / ')[0] || req.user!.email;
        
        // Notify client about disbursement
        await notificationService.notifyDisbursement(
          application['File ID'],
          application.Client,
          loanAmount,
          clientEmail
        );

        // Notify client about commission
        if (commission > 0) {
          await notificationService.notifyCommissionCreated(
            ledgerEntryId,
            application.Client,
            commission,
            clientEmail
          );
        }
      } catch (notifError) {
        console.error('Failed to send notifications:', notifError);
        // Don't fail the request if notifications fail
      }

      res.json({
        success: true,
        data: {
          message: 'Application marked as disbursed',
          commissionEntry: {
            ...ledgerEntry,
            entryType,
            commissionCalculated: commission,
            commissionRate,
            loanAmount: disbursedAmount,
            disbursementTimestamp,
          },
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to mark as disbursed',
      });
    }
  }

  /**
   * GET /credit/payout-requests
   */
  async getPayoutRequests(req: Request, res: Response): Promise<void> {
    try {
      const allData = await n8nClient.getAllData();
      const ledgerEntries = allData['Commission Ledger'] || [];

      const payoutRequests = ledgerEntries
        .filter(
          (entry) =>
            entry['Payout Request'] &&
            entry['Payout Request'] !== 'False' &&
            entry['Payout Request'] !== 'Paid'
        )
        .map((entry) => ({
          id: entry.id,
          client: entry.Client,
          amount: parseFloat(entry['Payout Amount'] || '0'),
          status: entry['Payout Request'],
          date: entry.Date,
          description: entry.Description,
        }));

      res.json({
        success: true,
        data: payoutRequests,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch payout requests',
      });
    }
  }

  /**
   * POST /credit/payout-requests/:id/approve
   */
  async approvePayout(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { approvedAmount, note } = req.body;
      const allData = await n8nClient.getAllData();
      const ledgerEntries = allData['Commission Ledger'] || [];
      const entry = ledgerEntries.find((e) => e.id === id);

      if (!entry) {
        res.status(404).json({ success: false, error: 'Payout request not found' });
        return;
      }

      // Create payout entry (negative amount)
      const payoutEntry = {
        id: `LEDGER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        'Ledger Entry ID': `LEDGER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        Client: entry.Client,
        'Loan File': entry['Loan File'] || '',
        Date: new Date().toISOString().split('T')[0],
        'Disbursed Amount': '',
        'Commission Rate': '',
        'Payout Amount': `-${approvedAmount}`,
        Description: `Payout approved: ${note || 'Commission payout'}`,
        'Dispute Status': DisputeStatus.NONE,
        'Payout Request': 'Paid',
      };

      await n8nClient.postCommissionLedger(payoutEntry);

      // Update original entry
      await n8nClient.postCommissionLedger({
        ...entry,
        'Payout Request': 'Paid',
      });

      await n8nClient.postFileAuditLog({
        id: `AUDIT-${Date.now()}`,
        'Log Entry ID': `AUDIT-${Date.now()}`,
        File: entry['Loan File'] || '',
        Timestamp: new Date().toISOString(),
        Actor: req.user!.email,
        'Action/Event Type': 'payout_approved',
        'Details/Message': `Payout approved: ${approvedAmount}. ${note || ''}`,
        'Target User/Role': 'client',
        Resolved: 'False',
      });

      // Send notification
      try {
        const { notificationService } = await import('../services/notifications/notification.service.js');
        const allData = await n8nClient.getAllData();
        const clients = allData['Clients'] || [];
        const client = clients.find((c: any) => c.id === entry.Client || c['Client ID'] === entry.Client);
        const clientEmail = client?.['Contact Email / Phone']?.split(' / ')[0] || '';
        
        if (clientEmail) {
          await notificationService.notifyPayoutApproved(
            entry.id,
            entry.Client,
            approvedAmount,
            clientEmail
          );
        }
      } catch (notifError) {
        console.error('Failed to send notification:', notifError);
      }

      res.json({
        success: true,
        message: 'Payout approved',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to approve payout',
      });
    }
  }

  /**
   * POST /credit/payout-requests/:id/reject
   */
  async rejectPayout(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const allData = await n8nClient.getAllData();
      const ledgerEntries = allData['Commission Ledger'] || [];
      const entry = ledgerEntries.find((e) => e.id === id);

      if (!entry) {
        res.status(404).json({ success: false, error: 'Payout request not found' });
        return;
      }

      await n8nClient.postCommissionLedger({
        ...entry,
        'Payout Request': 'Rejected',
      });

      await n8nClient.postFileAuditLog({
        id: `AUDIT-${Date.now()}`,
        'Log Entry ID': `AUDIT-${Date.now()}`,
        File: entry['Loan File'] || '',
        Timestamp: new Date().toISOString(),
        Actor: req.user!.email,
        'Action/Event Type': 'payout_rejected',
        'Details/Message': `Payout rejected: ${reason}`,
        'Target User/Role': 'client',
        Resolved: 'False',
      });

      // Send notification
      try {
        const { notificationService } = await import('../services/notifications/notification.service.js');
        const allData = await n8nClient.getAllData();
        const clients = allData['Clients'] || [];
        const client = clients.find((c: any) => c.id === entry.Client || c['Client ID'] === entry.Client);
        const clientEmail = client?.['Contact Email / Phone']?.split(' / ')[0] || '';
        
        if (clientEmail) {
          await notificationService.notifyPayoutRejected(
            entry.id,
            entry.Client,
            reason,
            clientEmail
          );
        }
      } catch (notifError) {
        console.error('Failed to send notification:', notifError);
      }

      res.json({
        success: true,
        message: 'Payout rejected',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to reject payout',
      });
    }
  }
}

export const creditController = new CreditController();

