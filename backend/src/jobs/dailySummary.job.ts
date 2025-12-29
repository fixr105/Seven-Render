/**
 * Daily Summary Report Background Job
 * 
 * Cron job that runs daily to generate and save daily summary reports.
 * Aggregates AdminActivityLog and LoanFiles status changes for the last 24 hours.
 * 
 * Schedule: Runs daily at 00:00 (midnight) UTC
 * Can be configured via environment variable CRON_SCHEDULE
 */

import cron from 'node-cron';
import { dailySummaryService } from '../services/reports/dailySummary.service.js';

/**
 * Daily Summary Report Job
 */
export class DailySummaryJob {
  private task: cron.ScheduledTask | null = null;
  private isRunning = false;

  /**
   * Start the daily summary job
   * 
   * Schedule: Runs daily at 00:00 UTC (configurable via CRON_SCHEDULE env var)
   */
  start(): void {
    // Default schedule: Daily at 00:00 UTC
    // Can be overridden with CRON_SCHEDULE environment variable
    const schedule = process.env.CRON_SCHEDULE || '0 0 * * *'; // Every day at midnight UTC

    console.log(`[DailySummaryJob] Starting daily summary job with schedule: ${schedule}`);

    this.task = cron.schedule(schedule, async () => {
      if (this.isRunning) {
        console.warn('[DailySummaryJob] Previous job still running, skipping this execution');
        return;
      }

      this.isRunning = true;
      const startTime = Date.now();

      try {
        console.log('[DailySummaryJob] Starting daily summary generation...');
        
        // Generate report for yesterday (default)
        const reportData = await dailySummaryService.generateDailySummary();
        
        // Save to database
        const reportId = await dailySummaryService.saveDailySummary(reportData);
        
        const duration = Date.now() - startTime;
        console.log(`[DailySummaryJob] Daily summary generated successfully. Report ID: ${reportId}. Duration: ${duration}ms`);
        console.log(`[DailySummaryJob] Report Date: ${reportData.reportDate}`);
        console.log(`[DailySummaryJob] Metrics:`, {
          totalApplications: reportData.metrics.totalApplications,
          newApplications: reportData.metrics.newApplications,
          applicationsDisbursed: reportData.metrics.applicationsDisbursed,
          totalActivities: reportData.metrics.totalActivities,
        });
      } catch (error: any) {
        console.error('[DailySummaryJob] Error generating daily summary:', error);
        console.error('[DailySummaryJob] Error stack:', error.stack);
        
        // Log error but don't throw - job should continue running
        // In production, you might want to send an alert/notification here
      } finally {
        this.isRunning = false;
      }
    }, {
      scheduled: true,
      timezone: 'UTC',
    });

    console.log('[DailySummaryJob] Daily summary job started successfully');
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

