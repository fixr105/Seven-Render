/**
 * Audit & Activity Log Controller
 */

import { Request, Response } from 'express';
import { n8nClient } from '../services/airtable/n8nClient.js';
import { dataFilterService } from '../services/airtable/dataFilter.service.js';

export class AuditController {
  /**
   * GET /loan-applications/:id/audit-log
   * Get file audit log for a loan application
   */
  async getFileAuditLog(req: Request, res: Response): Promise<void> {
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

      // Check access permissions
      const filtered = dataFilterService.filterLoanApplications([application], req.user!);
      if (filtered.length === 0) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }

      // Get audit logs for this file
      let fileAuditLog = auditLogs.filter((log) => log.File === application['File ID']);

      // Filter by role if needed
      fileAuditLog = dataFilterService.filterFileAuditLog(fileAuditLog, req.user!);

      // Sort by timestamp (newest first)
      fileAuditLog.sort((a, b) => b.Timestamp.localeCompare(a.Timestamp));

      res.json({
        success: true,
        data: fileAuditLog.map((log) => ({
          id: log.id,
          logEntryId: log['Log Entry ID'],
          file: log.File,
          timestamp: log.Timestamp,
          actor: log.Actor,
          actionType: log['Action/Event Type'],
          message: log['Details/Message'],
          targetUserRole: log['Target User/Role'],
          resolved: log.Resolved === 'True',
        })),
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch audit log',
      });
    }
  }

  /**
   * GET /admin/activity-log
   * Get admin activity log (CREDIT admin only)
   */
  async getAdminActivityLog(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'credit_team') {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      const { dateFrom, dateTo, performedBy, actionType, targetEntity } = req.query;
      const allData = await n8nClient.getAllData();
      let activityLogs = allData['Admin Activity log'] || [];

      // Apply filters
      if (dateFrom || dateTo) {
        activityLogs = activityLogs.filter((log) => {
          const logDate = log.Timestamp.split('T')[0];
          if (dateFrom && logDate < dateFrom) return false;
          if (dateTo && logDate > dateTo) return false;
          return true;
        });
      }

      if (performedBy) {
        activityLogs = activityLogs.filter(
          (log) => log['Performed By']?.toLowerCase().includes((performedBy as string).toLowerCase())
        );
      }

      if (actionType) {
        activityLogs = activityLogs.filter((log) => log['Action Type'] === actionType);
      }

      if (targetEntity) {
        activityLogs = activityLogs.filter((log) => log['Target Entity'] === targetEntity);
      }

      // Sort by timestamp (newest first)
      activityLogs.sort((a, b) => b.Timestamp.localeCompare(a.Timestamp));

      res.json({
        success: true,
        data: activityLogs.map((log) => ({
          id: log.id,
          activityId: log['Activity ID'],
          timestamp: log.Timestamp,
          performedBy: log['Performed By'],
          actionType: log['Action Type'],
          description: log['Description/Details'],
          targetEntity: log['Target Entity'],
        })),
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch activity log',
      });
    }
  }
}

export const auditController = new AuditController();

