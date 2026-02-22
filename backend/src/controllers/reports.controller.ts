/**
 * Reports Controller
 */

import { Request, Response } from 'express';
import { n8nClient } from '../services/airtable/n8nClient.js';
import { dailySummaryService } from '../services/reports/dailySummary.service.js';
import { LoanStatus } from '../config/constants.js';

export class ReportsController {
  /**
   * POST /reports/daily/generate
   * Generate daily summary report (CREDIT admin only)
   * 
   * Uses DailySummaryService to aggregate metrics from:
   * - AdminActivityLog (last 24 hours)
   * - LoanFiles status changes (last 24 hours)
   * - Commission Ledger (last 24 hours)
   * - File Auditing Log (last 24 hours)
   * 
   * Webhook Mapping:
   * - GET → n8nClient.fetchTable('Loan Application') → /webhook/loanapplication → Airtable: Loan Applications
   * - GET → n8nClient.fetchTable('Admin Activity Log') → /webhook/adminactivitylog → Airtable: Admin Activity Log
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

      // Use daily summary service with overall timeout (60s to prevent hanging requests)
      const { dailySummaryService } = await import('../services/reports/dailySummary.service.js');
      
      // Generate report with timeout wrapper
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Report generation timed out after 60 seconds')), 60000);
      });

      const reportData = await Promise.race([
        dailySummaryService.generateDailySummary(reportDate),
        timeoutPromise,
      ]) as any;
      
      // Save to database
      const reportId = await dailySummaryService.saveDailySummary(
        reportData,
        emailRecipients
      );

      // Send email to management if recipients provided (non-blocking)
      if (emailRecipients && Array.isArray(emailRecipients) && emailRecipients.length > 0) {
        // Send email asynchronously to avoid blocking response
        (async () => {
          try {
          // Format email body as HTML
          const emailBody = reportData.summaryContent
            .replace(/\n/g, '<br>')
            .replace(/=/g, '═')
            .replace(/═+/g, '<hr>')
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
        })();
      }

      res.json({
        success: true,
        data: {
          reportId,
          reportDate: reportData.reportDate,
          summary: reportData.summaryContent,
          metrics: reportData.metrics,
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
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Authentication required' });
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
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Authentication required' });
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

  /**
   * Filter ledger entries by date range and optional client.
   * Date field is compared as YYYY-MM-DD string.
   */
  private filterLedgerByRange(
    entries: any[],
    from: string,
    to: string,
    clientId?: string
  ): any[] {
    return entries.filter((entry) => {
      const dateStr = (entry['Date'] || entry.date || '').toString().trim();
      const dateOnly = dateStr.startsWith('2') ? dateStr.slice(0, 10) : dateStr;
      if (!dateOnly || dateOnly.length < 10) return false;
      if (dateOnly < from || dateOnly > to) return false;
      if (clientId) {
        const client = (entry['Client'] || entry.client || '').toString().trim();
        if (client !== clientId) return false;
      }
      return true;
    });
  }

  /**
   * GET /reports/commission
   * Commission-only report: totals and entries in date range, optional client filter.
   */
  async getCommissionReport(req: Request, res: Response): Promise<void> {
    try {
      const from = (req.query.from as string)?.trim();
      const to = (req.query.to as string)?.trim();
      const clientId = (req.query.clientId as string)?.trim() || undefined;
      if (!from || !to) {
        res.status(400).json({ success: false, error: 'Query params from and to (YYYY-MM-DD) are required' });
        return;
      }
      const ledgerEntries = await n8nClient.fetchTable('Commission Ledger');
      const filtered = this.filterLedgerByRange(ledgerEntries, from, to, clientId);
      let totalPayoutAmount = 0;
      let totalPayinAmount = 0;
      let payoutCount = 0;
      let payinCount = 0;
      filtered.forEach((entry) => {
        const amount = parseFloat(entry['Payout Amount'] || '0');
        if (amount > 0) {
          totalPayoutAmount += amount;
          payoutCount += 1;
        } else if (amount < 0) {
          totalPayinAmount += Math.abs(amount);
          payinCount += 1;
        }
      });
      res.json({
        success: true,
        data: {
          from,
          to,
          ...(clientId && { clientId }),
          totalPayoutAmount,
          totalPayinAmount,
          payoutCount,
          payinCount,
          entries: filtered,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate commission report',
      });
    }
  }

  /**
   * GET /reports/ledger
   * Ledger report: entries in date range with optional client filter and summary totals.
   */
  async getLedgerReport(req: Request, res: Response): Promise<void> {
    try {
      const from = (req.query.from as string)?.trim();
      const to = (req.query.to as string)?.trim();
      const clientId = (req.query.clientId as string)?.trim() || undefined;
      if (!from || !to) {
        res.status(400).json({ success: false, error: 'Query params from and to (YYYY-MM-DD) are required' });
        return;
      }
      const ledgerEntries = await n8nClient.fetchTable('Commission Ledger');
      const filtered = this.filterLedgerByRange(ledgerEntries, from, to, clientId);
      let totalPayoutAmount = 0;
      let totalPayinAmount = 0;
      filtered.forEach((entry) => {
        const amount = parseFloat(entry['Payout Amount'] || '0');
        if (amount > 0) totalPayoutAmount += amount;
        else if (amount < 0) totalPayinAmount += Math.abs(amount);
      });
      res.json({
        success: true,
        data: {
          from,
          to,
          ...(clientId && { clientId }),
          entries: filtered,
          totalPayoutAmount,
          totalPayinAmount,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate ledger report',
      });
    }
  }

  /**
   * GET /reports/client-wise
   * Client-wise report: per-client commission breakdown in date range.
   */
  async getClientWiseReport(req: Request, res: Response): Promise<void> {
    try {
      const from = (req.query.from as string)?.trim();
      const to = (req.query.to as string)?.trim();
      if (!from || !to) {
        res.status(400).json({ success: false, error: 'Query params from and to (YYYY-MM-DD) are required' });
        return;
      }
      const [ledgerEntries, clientsRecords] = await Promise.all([
        n8nClient.fetchTable('Commission Ledger'),
        n8nClient.fetchTable('Clients').catch(() => []),
      ]);
      const filtered = this.filterLedgerByRange(ledgerEntries, from, to);
      const clientMap: Record<string, { totalPayoutAmount: number; totalPayinAmount: number; entryCount: number }> = {};
      const nameById: Record<string, string> = {};
      (clientsRecords as any[]).forEach((c) => {
        const id = c.id || c['Client ID'] || c['Name'];
        if (id) nameById[id] = c['Client Name'] || c['Name'] || c['Company Name'] || id;
      });
      filtered.forEach((entry) => {
        const clientId = (entry['Client'] || entry.client || '').toString().trim() || 'Unknown';
        if (!clientMap[clientId]) {
          clientMap[clientId] = { totalPayoutAmount: 0, totalPayinAmount: 0, entryCount: 0 };
        }
        const amount = parseFloat(entry['Payout Amount'] || '0');
        if (amount > 0) {
          clientMap[clientId].totalPayoutAmount += amount;
        } else if (amount < 0) {
          clientMap[clientId].totalPayinAmount += Math.abs(amount);
        }
        clientMap[clientId].entryCount += 1;
      });
      const clients = Object.entries(clientMap).map(([clientId, agg]) => ({
        clientId,
        clientName: nameById[clientId],
        totalPayoutAmount: agg.totalPayoutAmount,
        totalPayinAmount: agg.totalPayinAmount,
        entryCount: agg.entryCount,
      }));
      res.json({
        success: true,
        data: { from, to, clients },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate client-wise report',
      });
    }
  }

  /**
   * GET /reports/date-range
   * Date-range report: daily-summary-style metrics over [from, to].
   */
  async getDateRangeReport(req: Request, res: Response): Promise<void> {
    try {
      const from = (req.query.from as string)?.trim();
      const to = (req.query.to as string)?.trim();
      if (!from || !to) {
        res.status(400).json({ success: false, error: 'Query params from and to (YYYY-MM-DD) are required' });
        return;
      }
      const result = await dailySummaryService.generateDateRangeSummary(from, to);
      res.json({
        success: true,
        data: {
          from: result.from,
          to: result.to,
          metrics: result.metrics,
          summaryContent: result.summaryContent,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate date-range report',
      });
    }
  }
}

export const reportsController = new ReportsController();

