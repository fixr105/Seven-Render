/**
 * Credit Team Controller
 */

import { Request, Response } from 'express';
import { n8nClient } from '../services/airtable/n8nClient.js';
import { LoanStatus, LenderDecisionStatus, DisputeStatus, SLA_SENT_TO_NBFC_DAYS } from '../config/constants.js';
import { getStatusHistory } from '../services/statusTracking/statusHistory.service.js';
import { buildKAMNameMap, resolveKAMName } from '../utils/kamNameResolver.js';

export class CreditController {
  /**
   * GET /credit/dashboard
   */
  async getDashboard(req: Request, res: Response): Promise<void> {
    try {
      // Fetch only the tables we need
      const [applications, auditLogs] = await Promise.all([
        n8nClient.fetchTable('Loan Application'),
        n8nClient.fetchTable('File Auditing Log'),
      ]);

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

      const normFileId = (v: any) => String(v ?? '').trim().toLowerCase();
      const actionType = (log: any) => (log['Action/Event Type'] || '').toLowerCase();
      const pendingQueriesList = auditLogs
        .filter(
          (log: any) =>
            actionType(log).includes('query') &&
            log.Resolved === 'False' &&
            !actionType(log).includes('query_resolved') &&
            !actionType(log).includes('query_edited')
        )
        .filter((log: any) => !(log['Details/Message'] || '').includes('Reply to query'))
        .map((log: any) => {
          const rawFileId = log.File || log['File ID'];
          const fileIdNorm = normFileId(rawFileId);
          const app = applications.find(
            (a: any) => normFileId(a['File ID'] || a.fileId) === fileIdNorm
          );
          return {
            id: log.id,
            fileId: rawFileId,
            applicationId: app?.id || app?.['Record ID'] || rawFileId,
            message: (log['Details/Message'] || '').toString().trim().slice(0, 100),
          };
        });

      res.json({
        success: true,
        data: {
          filesByStage,
          aggregateMetrics,
          pendingQueries: pendingQueriesList,
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
   * GET /credit/sla-past-due
   * Returns applications in Sent to NBFC that are past SLA (sent more than SLA_SENT_TO_NBFC_DAYS ago).
   */
  async getSlaPastDue(req: Request, res: Response): Promise<void> {
    try {
      const applications = await n8nClient.fetchTable('Loan Application');
      const sentToNbfc = applications.filter((app: any) => app.Status === LoanStatus.SENT_TO_NBFC);
      const now = Date.now();
      const slaMs = SLA_SENT_TO_NBFC_DAYS * 24 * 60 * 60 * 1000;
      const items: Array<{ fileId: string; applicationId?: string; sentAt: string; daysPastSLA: number }> = [];

      for (const app of sentToNbfc) {
        const fileId = app['File ID'] || app.fileId || app.id;
        if (!fileId) continue;
        let sentAt: string = app['Last Updated'] || new Date().toISOString();
        try {
          const history = await getStatusHistory(fileId);
          const sentEntry = history.filter((e) => e.toStatus === LoanStatus.SENT_TO_NBFC).pop();
          if (sentEntry?.changedAt) sentAt = sentEntry.changedAt;
        } catch (_) {
          // keep Last Updated fallback
        }
        const sentTime = new Date(sentAt).getTime();
        const ageMs = now - sentTime;
        if (ageMs > slaMs) {
          const daysPastSLA = Math.floor(ageMs / (24 * 60 * 60 * 1000));
          items.push({
            fileId,
            applicationId: app.id || app['Record ID'],
            sentAt,
            daysPastSLA,
          });
        }
      }

      res.json({
        success: true,
        data: { items },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch SLA past-due list',
      });
    }
  }

  /**
   * GET /credit/loan-applications
   * List all loan applications (Credit Team sees all)
   *
   * Webhook Mapping:
   * - GET → n8nClient.fetchTable('Loan Application') → /webhook/loanapplication → Airtable: Loan Applications
   *
   * All records are parsed using standardized N8nResponseParser
   * Returns ParsedRecord[] with clean field names (fields directly on object)
   *
   * Frontend: src/pages/Applications.tsx (Credit Team view)
   * See WEBHOOK_MAPPING_TABLE.md for complete mapping
   */
  async listApplications(req: Request, res: Response): Promise<void> {
    try {
      const { status, kamId, clientId, nbfcId, productId, dateFrom, dateTo } = req.query;
      // Fetch only Loan Application table
      // Records are automatically parsed by fetchTable() using N8nResponseParser
      // Returns ParsedRecord[] with clean field names (fields directly on object, not in 'fields' property)
      let applications = await n8nClient.fetchTable('Loan Application');

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
   * Get single application for Credit Team
   * 
   * Webhook Mapping:
   * - GET → n8nClient.fetchTable('Loan Application') → /webhook/loanapplication → Airtable: Loan Applications
   * - GET → n8nClient.fetchTable('File Auditing Log') → /webhook/fileauditinglog → Airtable: File Auditing Log
   * 
   * All records are parsed using standardized N8nResponseParser
   * Returns ParsedRecord[] with clean field names (fields directly on object)
   * 
   * Frontend: src/pages/ApplicationDetail.tsx (Credit Team view)
   * See WEBHOOK_MAPPING_TABLE.md for complete mapping
   */
  async getApplication(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      // Step 1: Fetch applications first and find the specific one
      const applications = await n8nClient.fetchTable('Loan Application');
      const application = applications.find((app) => app.id === id);

      if (!application) {
        res.status(404).json({ success: false, error: 'Application not found' });
        return;
      }

      // Step 2: Only fetch audit logs if we found the application
      // Filter to only logs for this specific file ID
      const auditLogs = await n8nClient.fetchTable('File Auditing Log');
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

      res.json({
        success: true,
        data: {
          ...application,
          formData: application['Form Data'] ? JSON.parse(application['Form Data']) : {},
          documents, // Parsed documents array
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
      const message = req.body.message ?? req.body.query ?? '';
      const { requestedDocs, clarifications } = req.body;
      if (!message || !String(message).trim()) {
        res.status(400).json({ success: false, error: 'Message is required' });
        return;
      }
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
        Status: LoanStatus.CREDIT_QUERY_WITH_KAM,
        'Last Updated': new Date().toISOString(),
      });

      // Build query message
      const queryMessage = [
        String(message).trim(),
        requestedDocs?.length ? `Documents requested: ${requestedDocs.join(', ')}` : '',
        clarifications?.length ? `Clarifications: ${clarifications.join(', ')}` : '',
      ]
        .filter(Boolean)
        .join('. ');

      // Use query service to create query with proper File Auditing Log and Notification
      const { queryService } = await import('../services/queries/query.service.js');
      const queryId = await queryService.createQuery(
        application['File ID'],
        application.Client,
        req.user!.email,
        'credit_team',
        queryMessage,
        'kam',
        'credit_query'
      );

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
      // Fetch only Loan Application table
      const applications = await n8nClient.fetchTable('Loan Application');
      const application = applications.find((app) => app.id === id);

      if (!application) {
        res.status(404).json({ success: false, error: 'Application not found' });
        return;
      }

      // Module 3: Validate status transition using state machine
      const { validateTransition } = await import('../services/statusTracking/statusStateMachine.js');
      const { recordStatusChange } = await import('../services/statusTracking/statusHistory.service.js');
      
      const previousStatus = application.Status as LoanStatus;
      const newStatus = LoanStatus.IN_NEGOTIATION;
      
      try {
        validateTransition(previousStatus, newStatus, req.user!.role);
      } catch (transitionError: any) {
        res.status(400).json({
          success: false,
          error: transitionError.message || 'Invalid status transition',
        });
        return;
      }

      await n8nClient.postLoanApplication({
        ...application,
        Status: newStatus,
        'Last Updated': new Date().toISOString(),
      });

      // Module 3: Record status change in history
      await recordStatusChange(
        req.user!,
        application['File ID'],
        previousStatus,
        newStatus,
        'Application marked as in negotiation'
      );

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
   * POST /credit/loan-applications/:id/status
   * Update application status (Credit only - for approved, rejected, credit_query_with_kam, sent_to_nbfc, etc.)
   */
  async updateStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status: newStatusRaw, notes } = req.body;
      if (!newStatusRaw || typeof newStatusRaw !== 'string') {
        res.status(400).json({ success: false, error: 'Status is required' });
        return;
      }
      const newStatus = (newStatusRaw as string).trim().toLowerCase().replace(/-/g, '_') as LoanStatus;
      const applications = await n8nClient.fetchTable('Loan Application');
      const application = applications.find((app: any) => app.id === id);
      if (!application) {
        res.status(404).json({ success: false, error: 'Application not found' });
        return;
      }
      const previousStatus = (application.Status || '').toString().trim().toLowerCase().replace(/-/g, '_') as LoanStatus;
      const { validateTransition } = await import('../services/statusTracking/statusStateMachine.js');
      const { recordStatusChange } = await import('../services/statusTracking/statusHistory.service.js');
      try {
        validateTransition(previousStatus, newStatus, req.user!.role);
      } catch (transitionError: any) {
        res.status(400).json({
          success: false,
          error: transitionError.message || 'Invalid status transition',
        });
        return;
      }
      await n8nClient.postLoanApplication({
        ...application,
        Status: newStatus,
        'Last Updated': new Date().toISOString(),
      });
      await recordStatusChange(
        req.user!,
        application['File ID'],
        previousStatus,
        newStatus,
        notes || `Status updated to ${newStatus}`
      );
      res.json({ success: true, message: 'Status updated successfully' });
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
      // Fetch only Loan Application table
      const applications = await n8nClient.fetchTable('Loan Application');
      const application = applications.find((app) => app.id === id);

      if (!application) {
        res.status(404).json({ success: false, error: 'Application not found' });
        return;
      }

      // Module 3: Validate status transition using state machine
      const { validateTransition } = await import('../services/statusTracking/statusStateMachine.js');
      const { recordStatusChange } = await import('../services/statusTracking/statusHistory.service.js');
      
      const previousStatus = application.Status as LoanStatus;
      const newStatus = LoanStatus.SENT_TO_NBFC;
      
      try {
        validateTransition(previousStatus, newStatus, req.user!.role);
      } catch (transitionError: any) {
        res.status(400).json({
          success: false,
          error: transitionError.message || 'Invalid status transition',
        });
        return;
      }

      // Update with assigned NBFCs (comma-separated if multiple)
      await n8nClient.postLoanApplication({
        ...application,
        'Assigned NBFC': Array.isArray(nbfcIds) ? nbfcIds.join(', ') : nbfcIds,
        Status: newStatus,
        'Last Updated': new Date().toISOString(),
      });

      // Module 3: Record status change in history
      await recordStatusChange(
        req.user!,
        application['File ID'],
        previousStatus,
        newStatus,
        `Assigned NBFCs: ${Array.isArray(nbfcIds) ? nbfcIds.join(', ') : nbfcIds}`
      );

      // Module 0: Use admin logger helper
      const { logApplicationAction, AdminActionType } = await import('../utils/adminLogger.js');
      await logApplicationAction(
        req.user!,
        AdminActionType.ASSIGN_NBFC,
        application['File ID'],
        `Assigned NBFCs to application`,
        { nbfcIds: Array.isArray(nbfcIds) ? nbfcIds : [nbfcIds], statusChange: `${previousStatus} → ${newStatus}` }
      );

      // Email assigned NBFC(s) with application link (non-blocking)
      const ids = Array.isArray(nbfcIds) ? nbfcIds : [nbfcIds];
      if (ids.length > 0) {
        (async () => {
          try {
            const partners = await n8nClient.fetchTable('NBFC Partners');
            const baseUrl = process.env.FRONTEND_URL || 'https://lms.sevenfincorp.com';
            const appLink = `${baseUrl}/applications/${id}`;
            const emails: string[] = [];
            for (const nbfcId of ids) {
              const partner = partners.find(
                (p: any) => p.id === nbfcId || p['Lender ID'] === nbfcId || String(p.id) === String(nbfcId)
              );
              const contact = partner?.['Contact Email/Phone'] || partner?.['Contact Email / Phone'] || '';
              const email = contact.split(/\s*\/\s*/)[0]?.trim();
              if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) emails.push(email);
            }
            if (emails.length > 0) {
              await n8nClient.postEmail({
                to: emails,
                subject: `New application assigned – Seven Fincorp LMS`,
                body: `<p>An application has been assigned to you.</p><p><a href="${appLink}">View application</a></p><p>Application ID: ${id}</p>`,
              });
            }
          } catch (emailErr: any) {
            console.error('[assignNBFCs] Failed to send email to NBFC(s):', emailErr?.message || emailErr);
          }
        })();
      }

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
      // Fetch only Loan Application table
      const applications = await n8nClient.fetchTable('Loan Application');
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
        // Module 3: If any NBFC approves, status can move to approved (validate transition)
        if (application.Status === LoanStatus.SENT_TO_NBFC) {
          const { validateTransition } = await import('../services/statusTracking/statusStateMachine.js');
          try {
            validateTransition(application.Status as LoanStatus, LoanStatus.APPROVED, req.user!.role);
            updateData.Status = LoanStatus.APPROVED;
          } catch (transitionError) {
            // If transition invalid, keep current status but record decision
            console.warn('[captureNBFCDecision] Invalid transition, keeping current status');
          }
        }
      } else if (decision === LenderDecisionStatus.REJECTED) {
        updateData['Lender Decision Remarks'] = rejectionReason || '';
        // Module 3: Validate rejection transition
        const { validateTransition } = await import('../services/statusTracking/statusStateMachine.js');
        try {
          validateTransition(application.Status as LoanStatus, LoanStatus.REJECTED, req.user!.role);
          updateData.Status = LoanStatus.REJECTED;
        } catch (transitionError) {
          console.warn('[captureNBFCDecision] Invalid rejection transition, keeping current status');
        }
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
      // Fetch only Loan Application table
      const applications = await n8nClient.fetchTable('Loan Application');
      const application = applications.find((app) => app.id === id);

      if (!application) {
        res.status(404).json({ success: false, error: 'Application not found' });
        return;
      }

      // Fetch client's commission_rate from Client table
      // Note: Clients are stored in Airtable, we need to get it from the Client field
      // The Client field in Loan Applications is a reference to the Client table
      let commissionRate = 1.5; // Default fallback
      
      // Fetch only Clients table to get commission rate
      const clients = await n8nClient.fetchTable('Clients');
      const client = clients.find((c: any) => c.id === application.Client || c['Client ID'] === application.Client);
      
      if (client && client['Commission Rate']) {
        // Commission Rate is stored as string (e.g., "1.5" for 1.5%)
        const rateStr = client['Commission Rate'].toString().trim();
        commissionRate = parseFloat(rateStr) || 1.5;
      }

      // Use commission service to calculate commission
      const { commissionService } = await import('../services/commission/commission.service.js');

      // Module 3: Validate status transition using state machine
      const { validateTransition } = await import('../services/statusTracking/statusStateMachine.js');
      const { recordStatusChange } = await import('../services/statusTracking/statusHistory.service.js');
      
      const previousStatus = application.Status as LoanStatus;
      const newStatus = LoanStatus.DISBURSED;
      
      try {
        validateTransition(previousStatus, newStatus, req.user!.role);
      } catch (transitionError: any) {
        res.status(400).json({
          success: false,
          error: transitionError.message || 'Invalid status transition',
        });
        return;
      }

      // Update application status
      await n8nClient.postLoanApplication({
        ...application,
        Status: newStatus,
        'Approved Loan Amount': disbursedAmount.toString(),
        'Last Updated': new Date().toISOString(),
      });

      // Module 3: Record status change in history
      await recordStatusChange(
        req.user!,
        application['File ID'],
        previousStatus,
        newStatus,
        `Loan disbursed. Amount: ${disbursedAmount}, Commission: ${commissionRate}%`
      );

      // Calculate and create commission ledger entry using service
      const commissionResult = await commissionService.calculateCommission({
        loanFileId: application['File ID'],
        clientId: application.Client,
        disbursedAmount: parseFloat(disbursedAmount),
        disbursedDate: disbursedDate || new Date().toISOString().split('T')[0],
        commissionRate,
      });

      const disbursementTimestamp = new Date().toISOString();
      const ledgerEntryId = commissionResult.ledgerEntryId;

      // Log activities
      await n8nClient.postAdminActivityLog({
        id: `ACT-${Date.now()}`,
        'Activity ID': `ACT-${Date.now()}`,
        Timestamp: disbursementTimestamp,
        'Performed By': req.user!.email,
        'Action Type': 'mark_disbursed',
        'Description/Details': `Application ${application['File ID']} marked as disbursed. Amount: ${disbursedAmount}, Commission Rate: ${commissionResult.commissionRate}%, ${commissionResult.entryType}: ${Math.abs(commissionResult.payoutAmount)}`,
        'Target Entity': 'loan_application',
      });

      await n8nClient.postFileAuditLog({
        id: `AUDIT-${Date.now()}`,
        'Log Entry ID': `AUDIT-${Date.now()}`,
        File: application['File ID'],
        Timestamp: disbursementTimestamp,
        Actor: req.user!.email,
        'Action/Event Type': 'disbursed',
        'Details/Message': `Loan disbursed. Amount: ${disbursedAmount}, Commission Rate: ${commissionResult.commissionRate}%, ${commissionResult.entryType}: ${Math.abs(commissionResult.payoutAmount)}`,
        'Target User/Role': 'client',
        Resolved: 'False',
      });

      // Send notifications
      try {
        const { notificationService } = await import('../services/notifications/notification.service.js');
        
        // Get client email from Client table
        const clients = await n8nClient.fetchTable('Clients');
        const client = clients.find((c: any) => c.id === application.Client || c['Client ID'] === application.Client);
        const clientEmail = client?.['Contact Email / Phone']?.split(' / ')[0] || req.user!.email;
        
        // Notify client about disbursement
        await notificationService.notifyDisbursement(
          application['File ID'],
          application.Client,
          disbursedAmount,
          clientEmail
        );

        // Notify client about commission
        if (commissionResult.commissionAmount > 0) {
          await notificationService.notifyCommissionCreated(
            ledgerEntryId,
            application.Client,
            commissionResult.commissionAmount,
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
            ledgerEntryId: commissionResult.ledgerEntryId,
            entryType: commissionResult.entryType,
            commissionCalculated: commissionResult.commissionAmount,
            commissionRate: commissionResult.commissionRate,
            loanAmount: disbursedAmount,
            disbursementTimestamp,
            payoutAmount: commissionResult.payoutAmount,
            description: commissionResult.description,
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
   * POST /credit/loan-applications/:id/close
   * Close/archive loan application (Credit Team only)
   * Typically called when status is DISBURSED or another appropriate final stage
   */
  async closeApplication(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'credit_team') {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      const { id } = req.params;
      // Fetch only Loan Application table
      const applications = await n8nClient.fetchTable('Loan Application');
      const application = applications.find((app) => app.id === id);

      if (!application) {
        res.status(404).json({ success: false, error: 'Application not found' });
        return;
      }

      const previousStatus = application.Status;

      // Update status to CLOSED
      await n8nClient.postLoanApplication({
        ...application,
        Status: LoanStatus.CLOSED,
        'Last Updated': new Date().toISOString(),
      });

      // Log to file audit
      await n8nClient.postFileAuditLog({
        id: `AUDIT-${Date.now()}`,
        'Log Entry ID': `AUDIT-${Date.now()}`,
        File: application['File ID'],
        Timestamp: new Date().toISOString(),
        Actor: req.user.email,
        'Action/Event Type': 'credit_closed_file',
        'Details/Message': `Application closed by credit team. Previous status: ${previousStatus}`,
        'Target User/Role': 'client',
        Resolved: 'False',
      });

      // Log admin activity
      await n8nClient.postAdminActivityLog({
        id: `ACT-${Date.now()}`,
        'Activity ID': `ACT-${Date.now()}`,
        Timestamp: new Date().toISOString(),
        'Performed By': req.user.email,
        'Action Type': 'close_application',
        'Description/Details': `Credit team closed loan application ${application['File ID']}. Previous status: ${previousStatus}`,
        'Target Entity': 'loan_application',
      });

      res.json({
        success: true,
        message: 'Application closed successfully',
        data: {
          applicationId: application.id,
          fileId: application['File ID'],
          previousStatus,
          newStatus: LoanStatus.CLOSED,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to close application',
      });
    }
  }

  /**
   * GET /credit/payout-requests
   */
  async getPayoutRequests(req: Request, res: Response): Promise<void> {
    try {
      // Fetch only Commission Ledger table
      const ledgerEntries = await n8nClient.fetchTable('Commission Ledger');

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
      // Fetch only Commission Ledger table
      const ledgerEntries = await n8nClient.fetchTable('Commission Ledger');
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
        // Fetch only Clients table
        const clients = await n8nClient.fetchTable('Clients');
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
        data: payoutEntry,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to approve payout',
      });
    }
  }

  /**
   * POST /credit/ledger/entries
   * Create a new ledger entry (Credit Team only)
   * 
   * Webhook Mapping:
   * - POST → n8nClient.postCommissionLedger() → /webhook/COMISSIONLEDGER → Airtable: Commission Ledger
   * 
   * Used for manual ledger entries or corrections
   */
  async createLedgerEntry(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'credit_team') {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      const {
        clientId,
        loanFile,
        date,
        disbursedAmount,
        commissionRate,
        payoutAmount,
        description,
      } = req.body;

      // Validate required fields
      if (!clientId) {
        res.status(400).json({ success: false, error: 'Client ID is required' });
        return;
      }

      if (!payoutAmount) {
        res.status(400).json({ success: false, error: 'Payout Amount is required' });
        return;
      }

      // Create ledger entry
      const ledgerEntryId = `LEDGER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const entryDate = date || new Date().toISOString().split('T')[0];

      const ledgerEntry = {
        id: ledgerEntryId,
        'Ledger Entry ID': ledgerEntryId,
        Client: clientId,
        'Loan File': loanFile || '',
        Date: entryDate,
        'Disbursed Amount': disbursedAmount ? disbursedAmount.toString() : '',
        'Commission Rate': commissionRate ? commissionRate.toString() : '',
        'Payout Amount': payoutAmount.toString(),
        Description: description || 'Manual ledger entry',
        'Dispute Status': DisputeStatus.NONE,
        'Payout Request': 'False',
      };

      await n8nClient.postCommissionLedger(ledgerEntry);

      // Log activity
      await n8nClient.postFileAuditLog({
        id: `AUDIT-${Date.now()}`,
        'Log Entry ID': `AUDIT-${Date.now()}`,
        File: loanFile || '',
        Timestamp: new Date().toISOString(),
        Actor: req.user!.email,
        'Action/Event Type': 'ledger_entry_created',
        'Details/Message': `Ledger entry created: ${description || 'Manual entry'}. Amount: ${payoutAmount}`,
        'Target User/Role': 'client',
        Resolved: 'False',
      });

      res.json({
        success: true,
        message: 'Ledger entry created successfully',
        data: ledgerEntry,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create ledger entry',
      });
    }
  }

  /**
   * POST /credit/ledger/:ledgerEntryId/flag-dispute
   * Flag a ledger entry for dispute (Credit Team can also flag on behalf of client)
   * 
   * Webhook Mapping:
   * - GET → n8nClient.fetchTable('Commission Ledger') → /webhook/commisionledger → Airtable: Commission Ledger
   * - POST → n8nClient.postCommissionLedger() → /webhook/COMISSIONLEDGER → Airtable: Commission Ledger
   * - POST → n8nClient.postFileAuditLog() → /webhook/Fileauditinglog → Airtable: File Auditing Log
   */
  async flagLedgerDispute(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'credit_team') {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      const { ledgerEntryId } = req.params;
      const { reason } = req.body;

      if (!reason || reason.trim().length === 0) {
        res.status(400).json({ success: false, error: 'Reason is required' });
        return;
      }

      // Use commission service for dispute flagging
      const { commissionService } = await import('../services/commission/commission.service.js');

      await commissionService.flagDispute({
        ledgerEntryId,
        reason,
        raisedBy: req.user!,
      });

      res.json({
        success: true,
        message: 'Ledger entry flagged for dispute',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to flag dispute',
      });
    }
  }

  /**
   * POST /credit/ledger/:ledgerEntryId/resolve-dispute
   * Resolve a ledger entry dispute (Credit Team only)
   * 
   * Allows credit team to resolve disputes by accepting or rejecting them
   */
  async resolveLedgerDispute(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'credit_team') {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      const { ledgerEntryId } = req.params;
      const { resolved, adjustedAmount, notes } = req.body;

      if (resolved === undefined) {
        res.status(400).json({ success: false, error: 'resolved flag is required' });
        return;
      }

      // Use commission service for dispute resolution
      const { commissionService } = await import('../services/commission/commission.service.js');

      await commissionService.resolveDispute(
        req.user!,
        ledgerEntryId,
        {
          resolved: resolved === true || resolved === 'true',
          adjustedAmount: adjustedAmount ? parseFloat(adjustedAmount) : undefined,
          notes,
        }
      );

      res.json({
        success: true,
        message: `Dispute ${resolved ? 'resolved' : 'rejected'}`,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to resolve dispute',
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
      // Fetch only Commission Ledger table
      const ledgerEntries = await n8nClient.fetchTable('Commission Ledger');
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
        // Fetch only Clients table
        const clients = await n8nClient.fetchTable('Clients');
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

  /**
   * GET /credit/clients
   * List all clients (Credit Team only)
   */
  async listClients(req: Request, res: Response): Promise<void> {
    try {
      const [clients, kamUsers] = await Promise.all([
        n8nClient.fetchTable('Clients'),
        n8nClient.fetchTable('KAM Users'),
      ]);

      const kamNameMap = buildKAMNameMap(kamUsers as any[]);
      const mapKeys = Array.from(kamNameMap.keys());
      console.log('[listCreditClients] kamNameMap size:', kamNameMap.size, 'sample keys:', mapKeys.slice(0, 5));
      let logged = 0;
      for (const client of clients as any[]) {
        if (logged >= 3) break;
        const assignedKAM = client['Assigned KAM'] || client.assignedKAM;
        if (!assignedKAM) continue;
        const resolved = resolveKAMName(assignedKAM, kamNameMap);
        const failed = resolved === assignedKAM;
        console.log(
          '[listCreditClients] Client',
          client['Client Name'] || client.clientName,
          'assignedKAM:',
          assignedKAM,
          'resolved:',
          resolved,
          'lookupFailed:',
          failed
        );
        logged++;
      }

      const clientsData = (clients as any[]).map((client: any) => {
        const assignedKAM = client['Assigned KAM'] || client.assignedKAM;
        let assignedKAMName = resolveKAMName(assignedKAM, kamNameMap);
        // Defensive: if resolution returned raw ID (no match in KAM Users), prefer expanded name from Airtable if present
        if (assignedKAMName === assignedKAM && (client['Assigned KAM Name'] || client.assignedKAMName)) {
          assignedKAMName = client['Assigned KAM Name'] || client.assignedKAMName || assignedKAMName;
        }
        return {
          id: client.id || client['Client ID'],
          clientId: client['Client ID'] || client.id,
          clientName: client['Client Name'] || client.clientName,
          primaryContactName: client['Primary Contact Name'] || client.primaryContactName,
          contactEmailPhone: client['Contact Email / Phone'] || client.contactEmailPhone,
          assignedKAM,
          assignedKAMName,
          enabledModules: client['Enabled Modules'] || client.enabledModules,
          commissionRate: client['Commission Rate'] || client.commissionRate,
          status: client['Status'] || client.status || 'Active',
        };
      });

      res.json({
        success: true,
        data: clientsData,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch clients',
      });
    }
  }

  /**
   * GET /credit/clients/:id
   * Get client details (Credit Team only)
   */
  async getClient(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      // Fetch only Clients table
      const clients = await n8nClient.fetchTable('Clients');
      const client = clients.find(
        (c: any) => c.id === id || c['Client ID'] === id
      );

      if (!client) {
        res.status(404).json({ success: false, error: 'Client not found' });
        return;
      }

      res.json({
        success: true,
        data: {
          id: client.id || client['Client ID'],
          clientId: client['Client ID'] || client.id,
          clientName: client['Client Name'] || client.clientName,
          primaryContactName: client['Primary Contact Name'] || client.primaryContactName,
          contactEmailPhone: client['Contact Email / Phone'] || client.contactEmailPhone,
          assignedKAM: client['Assigned KAM'] || client.assignedKAM,
          enabledModules: client['Enabled Modules'] || client.enabledModules,
          commissionRate: client['Commission Rate'] || client.commissionRate,
          status: client['Status'] || client.status || 'Active',
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
   * POST /credit/clients/:id/assign-kam
   * Assign or reassign a KAM to a client (Credit Team only)
   */
  async assignKAMToClient(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { kamId } = req.body; // KAM ID to assign (can be null to unassign)

      // Fetch client
      const clients = await n8nClient.fetchTable('Clients');
      const client = clients.find((c) => c.id === id || c['Client ID'] === id);

      if (!client) {
        res.status(404).json({ success: false, error: 'Client not found' });
        return;
      }

      // If kamId provided, validate KAM exists
      if (kamId) {
        const kamUsers = await n8nClient.fetchTable('KAM Users');
        const kamUser = kamUsers.find(
          (k) => k.id === kamId || k['KAM ID'] === kamId
        );
        if (!kamUser) {
          res.status(400).json({ 
            success: false, 
            error: 'KAM not found' 
          });
          return;
        }
      }

      // Update client
      const updateData = {
        ...client,
        'Assigned KAM': kamId || '', // Empty string to unassign
        'Last Updated': new Date().toISOString(),
      };

      await n8nClient.postClient(updateData);

      // Log admin activity
      await n8nClient.postAdminActivityLog({
        id: `ACT-${Date.now()}`,
        'Activity ID': `ACT-${Date.now()}`,
        Timestamp: new Date().toISOString(),
        'Performed By': req.user!.email,
        'Action Type': kamId ? 'assign_kam_to_client' : 'unassign_kam_from_client',
        'Description/Details': kamId 
          ? `Assigned KAM ${kamId} to client ${client['Client ID'] || id}`
          : `Unassigned KAM from client ${client['Client ID'] || id}`,
        'Target Entity': 'client',
      });

      res.json({
        success: true,
        message: kamId ? 'KAM assigned successfully' : 'KAM unassigned successfully',
        data: {
          clientId: id,
          assignedKAM: kamId || null,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to assign KAM',
      });
    }
  }

  /**
   * GET /credit/kam-users
   * List all KAM users (Credit Team only)
   */
  async listKAMUsers(req: Request, res: Response): Promise<void> {
    try {
      console.log('[CreditController] Fetching KAM users...');
      const kamUsers = await n8nClient.fetchTable('KAM Users');
      console.log(`[CreditController] Found ${kamUsers.length} total KAM users`);
      
      // Filter active KAMs only (case-insensitive)
      const activeKAMs = kamUsers.filter(
        (k) => {
          const status = (k.Status || k.status || '').toString().trim().toLowerCase();
          return status === 'active';
        }
      );
      console.log(`[CreditController] Found ${activeKAMs.length} active KAM users`);

      const mappedKAMs = activeKAMs.map((kam) => ({
        id: kam.id,
        kamId: kam['KAM ID'] || kam.id,
        name: kam.Name || kam.name || 'Unknown',
        email: kam.Email || kam.email || '',
        phone: kam.Phone || kam.phone || '',
        status: kam.Status || kam.status || 'Unknown',
      }));

      console.log('[CreditController] Returning KAM users:', mappedKAMs.map(k => `${k.name} (${k.kamId})`).join(', '));

      res.json({
        success: true,
        data: mappedKAMs,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch KAM users',
      });
    }
  }
}

export const creditController = new CreditController();

