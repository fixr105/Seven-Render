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

