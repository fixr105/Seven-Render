/**
 * Daily Summary Report Service
 * 
 * Aggregates AdminActivityLog and LoanFiles status changes for the last 24 hours
 * and generates a daily summary report as specified in the PRD.
 * 
 * This service is designed to be called by a background job/cron task.
 */

import { n8nClient } from '../airtable/n8nClient.js';
import { LoanStatus } from '../../config/constants.js';

/**
 * Daily summary metrics
 */
export interface DailySummaryMetrics {
  // Loan Application metrics
  totalApplications: number;
  newApplications: number;
  applicationsByStatus: Record<string, number>;
  statusChanges: number;
  applicationsDisbursed: number;
  totalDisbursedAmount: number;
  
  // Admin Activity metrics
  totalActivities: number;
  activitiesByType: Record<string, number>;
  activitiesByRole: Record<string, number>;
  
  // Commission metrics
  totalCommissions: number;
  totalPayoutRequests: number;
  totalDisputes: number;
  
  // Query metrics
  queriesRaised: number;
  queriesResolved: number;
  openQueries: number;
}

/**
 * Daily summary report data
 */
export interface DailySummaryReportData {
  reportDate: string;
  summaryContent: string;
  metrics: DailySummaryMetrics;
  generatedTimestamp: string;
}

/**
 * Daily Summary Report Service
 */
export class DailySummaryService {
  /**
   * Generate daily summary report for a specific date
   * 
   * Aggregates data from:
   * - AdminActivityLog (last 24 hours)
   * - LoanFiles status changes (last 24 hours)
   * - Commission Ledger (last 24 hours)
   * - File Auditing Log (last 24 hours)
   * 
   * @param reportDate - Date to generate report for (YYYY-MM-DD), defaults to yesterday
   * @returns Daily summary report data
   */
  async generateDailySummary(reportDate?: string): Promise<DailySummaryReportData> {
    // Default to yesterday if not provided
    const targetDate = reportDate || this.getYesterdayDate();
    const startDate = new Date(targetDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);

    // Fetch all relevant data
    const [applications, adminActivities, auditLogs, ledgerEntries] = await Promise.all([
      n8nClient.fetchTable('Loan Application'),
      n8nClient.fetchTable('Admin Activity Log'),
      n8nClient.fetchTable('File Auditing Log'),
      n8nClient.fetchTable('Commission Ledger'),
    ]);

    // Filter data for the last 24 hours (target date)
    const dateApplications = this.filterByDate(applications, targetDate, [
      'Creation Date',
      'Submitted Date',
      'Last Updated',
    ]);

    const dateAdminActivities = this.filterByDate(adminActivities, targetDate, [
      'Timestamp',
    ]);

    const dateAuditLogs = this.filterByDate(auditLogs, targetDate, [
      'Timestamp',
    ]);

    const dateLedgerEntries = this.filterByDate(ledgerEntries, targetDate, [
      'Date',
    ]);

    // Calculate metrics
    const metrics = this.calculateMetrics(
      dateApplications,
      dateAdminActivities,
      dateAuditLogs,
      dateLedgerEntries
    );

    // Generate summary content
    const summaryContent = this.formatSummaryContent(targetDate, metrics);

    return {
      reportDate: targetDate,
      summaryContent,
      metrics,
      generatedTimestamp: new Date().toISOString(),
    };
  }

  /**
   * Save daily summary report to database
   * 
   * @param reportData - Daily summary report data
   * @param deliveredTo - Optional recipients list
   * @returns Saved report ID
   */
  async saveDailySummary(
    reportData: DailySummaryReportData,
    deliveredTo?: string[]
  ): Promise<string> {
    const reportId = `REPORT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const reportEntry = {
      id: reportId,
      'Report Date': reportData.reportDate,
      'Summary Content': reportData.summaryContent,
      'Generated Timestamp': reportData.generatedTimestamp,
      'Delivered To': deliveredTo ? deliveredTo.join(', ') : '',
    };

    await n8nClient.postDailySummary(reportEntry);

    return reportId;
  }

  /**
   * Calculate metrics from aggregated data
   */
  private calculateMetrics(
    applications: any[],
    adminActivities: any[],
    auditLogs: any[],
    ledgerEntries: any[]
  ): DailySummaryMetrics {
    // Loan Application metrics
    const totalApplications = applications.length;
    const newApplications = applications.filter((app) => 
      app['Creation Date'] === this.getYesterdayDate()
    ).length;

    const applicationsByStatus: Record<string, number> = {};
    applications.forEach((app) => {
      const status = app.Status || 'Unknown';
      applicationsByStatus[status] = (applicationsByStatus[status] || 0) + 1;
    });

    const statusChanges = auditLogs.filter((log) =>
      log['Action/Event Type'] === 'status_change' ||
      log['Action/Event Type']?.toLowerCase().includes('status')
    ).length;

    const disbursedApps = applications.filter((app) =>
      app.Status === LoanStatus.DISBURSED
    );
    const applicationsDisbursed = disbursedApps.length;
    const totalDisbursedAmount = disbursedApps.reduce((sum, app) => {
      const amount = parseFloat(app['Approved Loan Amount'] || app['Requested Loan Amount'] || '0');
      return sum + amount;
    }, 0);

    // Admin Activity metrics
    const totalActivities = adminActivities.length;
    const activitiesByType: Record<string, number> = {};
    const activitiesByRole: Record<string, number> = {};

    adminActivities.forEach((activity) => {
      const actionType = activity['Action Type'] || 'Unknown';
      activitiesByType[actionType] = (activitiesByType[actionType] || 0) + 1;

      const performedBy = activity['Performed By'] || '';
      const roleMatch = performedBy.match(/\(([^)]+)\)/);
      if (roleMatch) {
        const role = roleMatch[1];
        activitiesByRole[role] = (activitiesByRole[role] || 0) + 1;
      }
    });

    // Commission metrics
    const totalCommissions = ledgerEntries.filter((entry) =>
      parseFloat(entry['Payout Amount'] || '0') > 0
    ).length;

    const totalPayoutRequests = ledgerEntries.filter((entry) =>
      entry['Payout Request'] === 'Requested' ||
      entry['Payout Request'] === 'Approved'
    ).length;

    const totalDisputes = ledgerEntries.filter((entry) =>
      entry['Dispute Status'] === 'Under Query' ||
      entry['Dispute Status'] === 'UNDER_QUERY'
    ).length;

    // Query metrics
    const queriesRaised = auditLogs.filter((log) =>
      log['Action/Event Type']?.toLowerCase().includes('query') &&
      log['Action/Event Type']?.toLowerCase().includes('raised')
    ).length;

    const queriesResolved = auditLogs.filter((log) =>
      log['Action/Event Type']?.toLowerCase().includes('query') &&
      (log.Resolved === 'True' || log['Details/Message']?.includes('resolved'))
    ).length;

    const openQueries = auditLogs.filter((log) =>
      log['Action/Event Type']?.toLowerCase().includes('query') &&
      log.Resolved === 'False'
    ).length;

    return {
      totalApplications,
      newApplications,
      applicationsByStatus,
      statusChanges,
      applicationsDisbursed,
      totalDisbursedAmount,
      totalActivities,
      activitiesByType,
      activitiesByRole,
      totalCommissions,
      totalPayoutRequests,
      totalDisputes,
      queriesRaised,
      queriesResolved,
      openQueries,
    };
  }

  /**
   * Format summary content as HTML/text
   */
  private formatSummaryContent(
    reportDate: string,
    metrics: DailySummaryMetrics
  ): string {
    const lines: string[] = [];

    lines.push(`Daily Summary Report for ${reportDate}`);
    lines.push('='.repeat(50));
    lines.push('');

    // Loan Application Summary
    lines.push('LOAN APPLICATIONS');
    lines.push('-'.repeat(50));
    lines.push(`Total Applications: ${metrics.totalApplications}`);
    lines.push(`New Applications: ${metrics.newApplications}`);
    lines.push(`Status Changes: ${metrics.statusChanges}`);
    lines.push(`Applications Disbursed: ${metrics.applicationsDisbursed}`);
    lines.push(`Total Disbursed Amount: ₹${metrics.totalDisbursedAmount.toLocaleString('en-IN')}`);
    lines.push('');
    lines.push('Applications by Status:');
    Object.entries(metrics.applicationsByStatus).forEach(([status, count]) => {
      lines.push(`  - ${status}: ${count}`);
    });
    lines.push('');

    // Admin Activity Summary
    lines.push('ADMIN ACTIVITIES');
    lines.push('-'.repeat(50));
    lines.push(`Total Activities: ${metrics.totalActivities}`);
    lines.push('');
    lines.push('Activities by Type:');
    Object.entries(metrics.activitiesByType).forEach(([type, count]) => {
      lines.push(`  - ${type}: ${count}`);
    });
    lines.push('');
    lines.push('Activities by Role:');
    Object.entries(metrics.activitiesByRole).forEach(([role, count]) => {
      lines.push(`  - ${role}: ${count}`);
    });
    lines.push('');

    // Commission Summary
    lines.push('COMMISSION & LEDGER');
    lines.push('-'.repeat(50));
    lines.push(`Total Commissions: ${metrics.totalCommissions}`);
    lines.push(`Payout Requests: ${metrics.totalPayoutRequests}`);
    lines.push(`Disputes: ${metrics.totalDisputes}`);
    lines.push('');

    // Query Summary
    lines.push('QUERIES & AUDIT');
    lines.push('-'.repeat(50));
    lines.push(`Queries Raised: ${metrics.queriesRaised}`);
    lines.push(`Queries Resolved: ${metrics.queriesResolved}`);
    lines.push(`Open Queries: ${metrics.openQueries}`);
    lines.push('');

    lines.push('='.repeat(50));
    lines.push(`Report Generated: ${new Date().toISOString()}`);

    return lines.join('\n');
  }

  /**
   * Filter records by date
   */
  private filterByDate(
    records: any[],
    targetDate: string,
    dateFields: string[]
  ): any[] {
    return records.filter((record) => {
      for (const field of dateFields) {
        const fieldValue = record[field];
        if (!fieldValue) continue;

        // Check if field value matches target date
        if (typeof fieldValue === 'string') {
          // Check exact date match (YYYY-MM-DD)
          if (fieldValue.startsWith(targetDate)) {
            return true;
          }
          // Check date in ISO format
          if (fieldValue.includes(targetDate)) {
            return true;
          }
        }
      }
      return false;
    });
  }

  /**
   * Get yesterday's date in YYYY-MM-DD format
   */
  private getYesterdayDate(): string {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  }

  /**
   * Get date range for last 24 hours
   */
  private getLast24HoursRange(): { start: Date; end: Date } {
    const end = new Date();
    const start = new Date();
    start.setHours(start.getHours() - 24);
    return { start, end };
  }
}

// Export singleton instance
export const dailySummaryService = new DailySummaryService();

