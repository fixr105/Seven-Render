/**
 * Reports Controller
 */

import { Request, Response } from 'express';
import { n8nClient } from '../services/airtable/n8nClient.js';
import { LoanStatus } from '../config/constants.js';

export class ReportsController {
  /**
   * POST /reports/daily/generate
   * Generate daily summary report (CREDIT admin only)
   * 
   * Aggregates metrics from:
   * - Loan Applications table
   * - Commission Ledger table
   * - File Auditing Log table
   * 
   * Webhook Mapping:
   * - GET → n8nClient.fetchTable('Loan Application') → /webhook/loanapplication → Airtable: Loan Applications
   * - GET → n8nClient.fetchTable('Commission Ledger') → /webhook/commisionledger → Airtable: Commission Ledger
   * - GET → n8nClient.fetchTable('File Auditing Log') → /webhook/fileauditinglog → Airtable: File Auditing Log
   * - POST → n8nClient.postDailySummary() → /webhook/DAILYSUMMARY → Airtable: Daily Summary Reports
   * - POST → n8nClient.postEmail() → /webhook/email → Outlook Send a message
   */
  async generateDailySummary(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'credit_team') {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      const { date, emailRecipients } = req.body;
      const reportDate = date || new Date().toISOString().split('T')[0];
      
      // Fetch data from all relevant tables
      const [applications, ledgerEntries, auditLogs] = await Promise.all([
        n8nClient.fetchTable('Loan Application'),
        n8nClient.fetchTable('Commission Ledger'),
        n8nClient.fetchTable('File Auditing Log'),
      ]);

      // Filter applications for the report date
      const dateApplications = applications.filter(
        (app) =>
          app['Creation Date'] === reportDate ||
          app['Submitted Date'] === reportDate ||
          app['Last Updated']?.startsWith(reportDate)
      );

      // Filter ledger entries for the report date
      const dateLedgerEntries = ledgerEntries.filter(
        (entry) => entry.Date === reportDate
      );

      // Filter audit log entries for the report date
      const dateAuditLogs = auditLogs.filter(
        (log) => log.Timestamp?.startsWith(reportDate)
      );

      // Aggregate Loan Application metrics
      const applicationMetrics = {
        filesReceived: dateApplications.filter((app) => app['Creation Date'] === reportDate).length,
        filesSubmitted: dateApplications.filter((app) => app['Submitted Date'] === reportDate).length,
        filesSentToLenders: dateApplications.filter(
          (app) =>
            app.Status === LoanStatus.SENT_TO_NBFC &&
            app['Last Updated']?.startsWith(reportDate)
        ).length,
        filesApproved: dateApplications.filter(
          (app) =>
            app.Status === LoanStatus.APPROVED &&
            app['Last Updated']?.startsWith(reportDate)
        ).length,
        filesRejected: dateApplications.filter(
          (app) =>
            app.Status === LoanStatus.REJECTED &&
            app['Last Updated']?.startsWith(reportDate)
        ).length,
        filesDisbursed: dateApplications.filter(
          (app) =>
            app.Status === LoanStatus.DISBURSED &&
            app['Last Updated']?.startsWith(reportDate)
        ).length,
        totalDisbursed: dateApplications
          .filter(
            (app) =>
              app.Status === LoanStatus.DISBURSED &&
              app['Last Updated']?.startsWith(reportDate)
          )
          .reduce((sum, app) => sum + parseFloat(app['Approved Loan Amount'] || '0'), 0),
        pendingQueries: dateApplications.filter(
          (app) =>
            app.Status === LoanStatus.QUERY_WITH_CLIENT ||
            app.Status === LoanStatus.CREDIT_QUERY_WITH_KAM
        ).length,
      };

      // Aggregate Commission Ledger metrics
      const commissionMetrics = {
        totalEntries: dateLedgerEntries.length,
        totalPayoutAmount: dateLedgerEntries
          .filter((entry) => parseFloat(entry['Payout Amount'] || '0') > 0)
          .reduce((sum, entry) => sum + parseFloat(entry['Payout Amount'] || '0'), 0),
        totalPayinAmount: Math.abs(
          dateLedgerEntries
            .filter((entry) => parseFloat(entry['Payout Amount'] || '0') < 0)
            .reduce((sum, entry) => sum + parseFloat(entry['Payout Amount'] || '0'), 0)
        ),
        payoutRequests: dateLedgerEntries.filter(
          (entry) => entry['Payout Request'] && entry['Payout Request'] !== 'False'
        ).length,
        disputes: dateLedgerEntries.filter(
          (entry) => entry['Dispute Status'] && entry['Dispute Status'] !== 'None'
        ).length,
      };

      // Aggregate File Auditing Log metrics
      const auditMetrics = {
        totalActions: dateAuditLogs.length,
        queriesRaised: dateAuditLogs.filter(
          (log) => log['Action/Event Type']?.toLowerCase().includes('query')
        ).length,
        queriesResolved: dateAuditLogs.filter(
          (log) => log['Action/Event Type']?.toLowerCase().includes('query') && log.Resolved === 'True'
        ).length,
        statusChanges: dateAuditLogs.filter(
          (log) => log['Action/Event Type']?.toLowerCase().includes('status')
        ).length,
      };

      // Generate summary content
      const summaryContent = `
Daily Summary Report for ${reportDate}
Generated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}

═══════════════════════════════════════════════════════════
LOAN APPLICATIONS SUMMARY
═══════════════════════════════════════════════════════════
Total Applications Processed: ${dateApplications.length}
- New Applications Received: ${applicationMetrics.filesReceived}
- Applications Submitted: ${applicationMetrics.filesSubmitted}
- Sent to Lenders: ${applicationMetrics.filesSentToLenders}
- Approved: ${applicationMetrics.filesApproved}
- Rejected: ${applicationMetrics.filesRejected}
- Disbursed: ${applicationMetrics.filesDisbursed}
- Total Disbursed Amount: ₹${applicationMetrics.totalDisbursed.toLocaleString('en-IN')}
- Pending Queries: ${applicationMetrics.pendingQueries}

═══════════════════════════════════════════════════════════
COMMISSION LEDGER SUMMARY
═══════════════════════════════════════════════════════════
Total Ledger Entries: ${commissionMetrics.totalEntries}
- Total Payout Amount: ₹${commissionMetrics.totalPayoutAmount.toLocaleString('en-IN')}
- Total Payin Amount: ₹${commissionMetrics.totalPayinAmount.toLocaleString('en-IN')}
- Payout Requests: ${commissionMetrics.payoutRequests}
- Disputes: ${commissionMetrics.disputes}

═══════════════════════════════════════════════════════════
AUDIT LOG SUMMARY
═══════════════════════════════════════════════════════════
Total Actions Logged: ${auditMetrics.totalActions}
- Queries Raised: ${auditMetrics.queriesRaised}
- Queries Resolved: ${auditMetrics.queriesResolved}
- Status Changes: ${auditMetrics.statusChanges}

═══════════════════════════════════════════════════════════
KEY HIGHLIGHTS
═══════════════════════════════════════════════════════════
${applicationMetrics.filesReceived > 0 ? `✓ ${applicationMetrics.filesReceived} new applications received` : '• No new applications received'}
${applicationMetrics.filesApproved > 0 ? `✓ ${applicationMetrics.filesApproved} applications approved` : ''}
${applicationMetrics.totalDisbursed > 0 ? `✓ ₹${applicationMetrics.totalDisbursed.toLocaleString('en-IN')} disbursed today` : ''}
${commissionMetrics.totalPayoutAmount > 0 ? `✓ ₹${commissionMetrics.totalPayoutAmount.toLocaleString('en-IN')} in commission payouts` : ''}
${auditMetrics.queriesRaised > 0 ? `⚠ ${auditMetrics.queriesRaised} queries raised (${auditMetrics.queriesResolved} resolved)` : ''}
${applicationMetrics.pendingQueries > 0 ? `⚠ ${applicationMetrics.pendingQueries} queries still pending resolution` : ''}

═══════════════════════════════════════════════════════════
      `.trim();

      // Create daily summary report with exact fields for DAILYSUMMARY webhook
      // Only send: id, Report Date, Summary Content, Generated Timestamp, Delivered To
      const deliveredTo = ['Email to Management', 'Dashboard'];
      const reportId = `SUMMARY-${reportDate.replace(/-/g, '')}-${Date.now()}`;
      const reportData = {
        id: reportId,
        'Report Date': reportDate,
        'Summary Content': summaryContent,
        'Generated Timestamp': new Date().toISOString(),
        'Delivered To': Array.isArray(deliveredTo) ? deliveredTo.join(', ') : deliveredTo,
      };

      // POST to DAILYSUMMARY webhook to save in Airtable
      await n8nClient.postDailySummary(reportData);

      // Send email to management if recipients provided
      if (emailRecipients && Array.isArray(emailRecipients) && emailRecipients.length > 0) {
        try {
          // Format email body as HTML
          const emailBody = summaryContent
            .replace(/\n/g, '<br>')
            .replace(/═══════════════════════════════════════════════════════════/g, '<hr>')
            .replace(/✓/g, '✅')
            .replace(/⚠/g, '⚠️');

          await n8nClient.postEmail({
            to: emailRecipients,
            subject: `Daily Summary Report - ${reportDate}`,
            body: `
              <html>
                <head>
                  <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    h1 { color: #080B53; }
                    hr { border: none; border-top: 2px solid #080B53; margin: 20px 0; }
                  </style>
                </head>
                <body>
                  <h1>Daily Summary Report</h1>
                  <p><strong>Date:</strong> ${reportDate}</p>
                  <p><strong>Generated:</strong> ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
                  <br>
                  ${emailBody}
                  <br>
                  <hr>
                  <p style="color: #666; font-size: 12px;">This is an automated report from Seven Fincorp Loan Management System.</p>
                </body>
              </html>
            `,
          });
        } catch (emailError) {
          console.error('[ReportsController] Failed to send email:', emailError);
          // Don't fail the report generation if email fails
        }
      }

      res.json({
        success: true,
        data: {
          reportId: reportData.id,
          reportDate,
          summary: summaryContent,
          metrics: {
            applications: applicationMetrics,
            commission: commissionMetrics,
            audit: auditMetrics,
          },
          emailSent: emailRecipients && emailRecipients.length > 0,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate daily summary',
      });
    }
  }

  /**
   * GET /reports/daily/:date
   * Get daily summary report for a specific date
   */
  async getDailySummary(req: Request, res: Response): Promise<void> {
    try {
      const { date } = req.params;
      // Fetch only Daily Summary Report table
      const reports = await n8nClient.fetchTable('Daily Summary Report');

      const report = reports.find((r) => r['Report Date'] === date);

      if (!report) {
        res.status(404).json({ success: false, error: 'Report not found for this date' });
        return;
      }

      res.json({
        success: true,
        data: report,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch daily summary',
      });
    }
  }

  /**
   * GET /reports/daily/latest
   * Get latest daily summary report (Credit/Admin only)
   */
  async getLatestDailySummary(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || (req.user.role !== 'credit_team' && req.user.role !== 'admin')) {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      const { before } = req.query;

      // Fetch only Daily Summary Report table
      const reports = await n8nClient.fetchTable('Daily Summary Report');

      // Filter by date if 'before' query param is provided
      let filteredReports = reports;
      if (before) {
        filteredReports = reports.filter((r) => {
          const reportDate = r['Report Date'] || '';
          return reportDate < (before as string);
        });
      }

      // Sort by date descending (newest first)
      filteredReports.sort((a, b) => {
        const dateA = a['Report Date'] || '';
        const dateB = b['Report Date'] || '';
        return dateB.localeCompare(dateA);
      });

      const latestReport = filteredReports[0];

      if (!latestReport) {
        res.status(404).json({ success: false, error: 'No report found' });
        return;
      }

      res.json({
        success: true,
        data: latestReport,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch latest daily summary',
      });
    }
  }

  /**
   * GET /reports/daily/list
   * Get last N daily summary reports (Credit/Admin only)
   * 
   * Webhook Mapping:
   * - GET → n8nClient.fetchTable('Daily Summary Report') → /webhook/dailysummaryreport → Airtable: Daily Summary Reports
   */
  async listDailySummaries(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || (req.user.role !== 'credit_team' && req.user.role !== 'admin')) {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      const limit = parseInt(req.query.limit as string) || 7;

      // Fetch only Daily Summary Report table
      const reports = await n8nClient.fetchTable('Daily Summary Report');

      // Sort by date descending (newest first)
      reports.sort((a, b) => {
        const dateA = a['Report Date'] || '';
        const dateB = b['Report Date'] || '';
        if (dateA === dateB) {
          // If same date, sort by Generated Timestamp
          const timeA = a['Generated Timestamp'] || '';
          const timeB = b['Generated Timestamp'] || '';
          return timeB.localeCompare(timeA);
        }
        return dateB.localeCompare(dateA);
      });

      // Get last N reports
      const recentReports = reports.slice(0, limit);

      res.json({
        success: true,
        data: recentReports.map((report) => ({
          id: report.id,
          reportDate: report['Report Date'],
          summaryContent: report['Summary Content'],
          generatedTimestamp: report['Generated Timestamp'],
          deliveredTo: report['Delivered To'],
        })),
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch daily summaries',
      });
    }
  }
}

export const reportsController = new ReportsController();

