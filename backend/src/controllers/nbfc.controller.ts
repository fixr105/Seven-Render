/**
 * NBFC Partner Controller
 */

import { Request, Response } from 'express';
import { n8nClient } from '../services/airtable/n8nClient.js';
import { LoanStatus, LenderDecisionStatus } from '../config/constants.js';

export class NBFController {
  /**
   * GET /nbfc/dashboard
   */
  async getDashboard(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'nbfc') {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      const allData = await n8nClient.getAllData();
      const applications = allData['Loan Applications'] || [];

      // Get applications assigned to this NBFC
      const assignedApplications = applications.filter(
        (app) => app['Assigned NBFC'] === req.user!.nbfcId
      );

      res.json({
        success: true,
        data: {
          assignedApplications: assignedApplications.map((app) => ({
            id: app.id,
            fileId: app['File ID'],
            client: app.Client,
            amount: app['Requested Loan Amount'],
            product: app['Loan Product'],
            dateSent: app['Last Updated'],
            status: app.Status,
          })),
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
   * GET /nbfc/loan-applications
   */
  async listApplications(req: Request, res: Response): Promise<void> {
    try {
      const { status, dateFrom, dateTo, amountMin, amountMax } = req.query;
      const allData = await n8nClient.getAllData();
      let applications = allData['Loan Applications'] || [];

      // Filter by assigned NBFC
      applications = applications.filter(
        (app) => app['Assigned NBFC'] === req.user!.nbfcId
      );

      if (status) {
        applications = applications.filter((app) => app.Status === status);
      }

      if (dateFrom || dateTo) {
        applications = applications.filter((app) => {
          const appDate = app['Creation Date'] || '';
          if (dateFrom && appDate < dateFrom) return false;
          if (dateTo && appDate > dateTo) return false;
          return true;
        });
      }

      if (amountMin || amountMax) {
        applications = applications.filter((app) => {
          const amount = parseFloat(app['Requested Loan Amount'] || '0');
          if (amountMin && amount < parseFloat(amountMin as string)) return false;
          if (amountMax && amount > parseFloat(amountMax as string)) return false;
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
          lenderDecision: app['Lender Decision Status'],
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
   * GET /nbfc/loan-applications/:id
   */
  async getApplication(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const allData = await n8nClient.getAllData();
      const applications = allData['Loan Applications'] || [];
      const application = applications.find((app) => app.id === id);

      if (!application) {
        res.status(404).json({ success: false, error: 'Application not found' });
        return;
      }

      // Check if assigned to this NBFC
      if (application['Assigned NBFC'] !== req.user!.nbfcId) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }

      // Return minimal info for underwriting
      res.json({
        success: true,
        data: {
          id: application.id,
          fileId: application['File ID'],
          client: application.Client,
          applicantName: application['Applicant Name'],
          product: application['Loan Product'],
          requestedAmount: application['Requested Loan Amount'],
          formData: application['Form Data'] ? JSON.parse(application['Form Data']) : {},
          documents: application.Documents,
          aiFileSummary: application['AI File Summary'],
          status: application.Status,
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
   * POST /nbfc/loan-applications/:id/decision
   * Record NBFC decision
   */
  async recordDecision(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { decision, approvedAmount, terms, rejectionReason, clarificationMessage } = req.body;
      const allData = await n8nClient.getAllData();
      const applications = allData['Loan Applications'] || [];
      const application = applications.find((app) => app.id === id);

      if (!application) {
        res.status(404).json({ success: false, error: 'Application not found' });
        return;
      }

      // Check if assigned to this NBFC
      if (application['Assigned NBFC'] !== req.user!.nbfcId) {
        res.status(403).json({ success: false, error: 'Access denied' });
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
      } else if (decision === LenderDecisionStatus.REJECTED) {
        updateData['Lender Decision Remarks'] = rejectionReason || '';
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
        message: 'Decision recorded successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to record decision',
      });
    }
  }
}

export const nbfcController = new NBFController();

