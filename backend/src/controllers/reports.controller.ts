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
   */
  async generateDailySummary(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'credit_team') {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      const { date } = req.body;
      const reportDate = date || new Date().toISOString().split('T')[0];
      const allData = await n8nClient.getAllData();
      const applications = allData['Loan Applications'] || [];

      // Filter applications for the report date
      const dateApplications = applications.filter(
        (app) =>
          app['Creation Date'] === reportDate ||
          app['Submitted Date'] === reportDate ||
          app['Last Updated']?.startsWith(reportDate)
      );

      // Aggregate metrics
      const metrics = {
        filesReceived: dateApplications.filter((app) => app['Creation Date'] === reportDate).length,
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

      // Generate summary content
      const summaryContent = `
Daily Summary Report for ${reportDate}

Total Applications Processed: ${dateApplications.length}
- Files Received: ${metrics.filesReceived}
- Files Sent to Lenders: ${metrics.filesSentToLenders}
- Files Approved: ${metrics.filesApproved}
- Files Rejected: ${metrics.filesRejected}
- Total Disbursed: ₹${metrics.totalDisbursed.toLocaleString()}
- Pending Queries: ${metrics.pendingQueries}

Key Highlights:
${metrics.filesReceived > 0 ? `- ${metrics.filesReceived} new applications received` : ''}
${metrics.filesApproved > 0 ? `- ${metrics.filesApproved} applications approved` : ''}
${metrics.totalDisbursed > 0 ? `- ₹${metrics.totalDisbursed.toLocaleString()} disbursed today` : ''}
${metrics.pendingQueries > 0 ? `- ${metrics.pendingQueries} queries pending resolution` : ''}
      `.trim();

      // Create daily summary report with exact fields for DAILYSUMMARY webhook
      // Only send: id, Report Date, Summary Content, Generated Timestamp, Delivered To
      const deliveredTo = ['Email to Management', 'Dashboard'];
      const reportData = {
        id: `SUMMARY-${reportDate.replace(/-/g, '')}`, // for matching
        'Report Date': reportDate,
        'Summary Content': summaryContent,
        'Generated Timestamp': new Date().toISOString(),
        'Delivered To': Array.isArray(deliveredTo) ? deliveredTo.join(', ') : deliveredTo, // Convert array to comma-separated string
      };

      // Always POST to DAILYSUMMARY webhook with exact fields only
      await n8nClient.postDailySummary(reportData);

      res.json({
        success: true,
        data: {
          reportId: reportData.id,
          reportDate,
          summary: summaryContent,
          metrics,
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
      const allData = await n8nClient.getAllData();
      const reports = allData['Daily summary Reports'] || [];

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
}

export const reportsController = new ReportsController();

