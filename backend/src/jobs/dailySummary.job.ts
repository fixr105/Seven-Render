/**
 * Daily Summary Report Background Job
 * 
 * Cron job that runs daily to generate and save daily summary reports.
 * Aggregates AdminActivityLog and LoanFiles status changes for the last 24 hours.
 * 
 * Schedule: Runs daily at 00:00 (midnight) UTC
 * Can be configured via environment variable CRON_SCHEDULE
 */

import { dailySummaryService } from '../services/reports/dailySummary.service.js';

/**
 * Daily Summary Report Job
 */
export class DailySummaryJob {
  private task: { stop(): void } | null = null;
  private isRunning = false;

  /**
   * Start the daily summary job.
   * DISABLED: No automatic cron. GET/POST webhooks (n8n) must run only on page load or user action.
   * Use Reports page "Generate" button or dailySummaryJob.runManually() for on-demand reports.
   */
  start(): void {
    console.log('[DailySummaryJob] Automatic scheduling is disabled. Use Reports page Generate or runManually() for on-demand reports.');
    return; // No cron: avoid automated n8n GET/POST
  }

  /**
   * Stop the daily summary job
   */
  stop(): void {
    if (this.task) {
      this.task.stop();
      this.task = null;
      console.log('[DailySummaryJob] Daily summary job stopped');
    }
  }

  /**
   * Manually trigger the daily summary generation
   * Useful for testing or manual execution
   * 
   * @param reportDate - Optional date to generate report for (YYYY-MM-DD)
   */
  async runManually(reportDate?: string): Promise<string> {
    if (this.isRunning) {
      throw new Error('Daily summary job is already running');
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      console.log('[DailySummaryJob] Manual execution started...');
      
      const reportData = await dailySummaryService.generateDailySummary(reportDate);
      const reportId = await dailySummaryService.saveDailySummary(reportData);
      
      const duration = Date.now() - startTime;
      console.log(`[DailySummaryJob] Manual execution completed. Report ID: ${reportId}. Duration: ${duration}ms`);
      
      return reportId;
    } catch (error: any) {
      console.error('[DailySummaryJob] Error in manual execution:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get job status
   */
  getStatus(): { isRunning: boolean; isScheduled: boolean } {
    return {
      isRunning: this.isRunning,
      isScheduled: this.task !== null,
    };
  }
}

// Export singleton instance
export const dailySummaryJob = new DailySummaryJob();

