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

      // Fetch only Loan Application table
      const applications = await n8nClient.fetchTable('Loan Application');

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
   * List loan applications assigned to this NBFC
   * 
   * Webhook Mapping:
   * - GET → n8nClient.fetchTable('Loan Application') → /webhook/loanapplication → Airtable: Loan Applications
   * 
   * All records are parsed using standardized N8nResponseParser
   * Returns ParsedRecord[] with clean field names (fields directly on object)
   * 
   * Frontend: src/pages/dashboards/NBFCDashboard.tsx
   * See WEBHOOK_MAPPING_TABLE.md for complete mapping
   */
  async listApplications(req: Request, res: Response): Promise<void> {
    try {
      const { status, dateFrom, dateTo, amountMin, amountMax } = req.query;
      // Fetch only Loan Application table
      // Records are automatically parsed by fetchTable() using N8nResponseParser
      // Returns ParsedRecord[] with clean field names (fields directly on object, not in 'fields' property)
      let applications = await n8nClient.fetchTable('Loan Application');

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
   * Get single application assigned to this NBFC
   * 
   * Webhook Mapping:
   * - GET → n8nClient.fetchTable('Loan Application') → /webhook/loanapplication → Airtable: Loan Applications
   * 
   * All records are parsed using standardized N8nResponseParser
   * Returns ParsedRecord[] with clean field names (fields directly on object)
   * 
   * Frontend: src/pages/ApplicationDetail.tsx (NBFC view)
   * See WEBHOOK_MAPPING_TABLE.md for complete mapping
   */
  async getApplication(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      // Fetch only Loan Application table
      // Records are automatically parsed by fetchTable() using N8nResponseParser
      // Returns ParsedRecord[] with clean field names (fields directly on object, not in 'fields' property)
      const applications = await n8nClient.fetchTable('Loan Application');
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

      // Parse Documents field (format: fieldId:url|fileName,fieldId:url|fileName)
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

      // Return complete application info including lender decision fields
      res.json({
        success: true,
        data: {
          id: application.id,
          fileId: application['File ID'],
          client: application.Client,
          applicantName: application['Applicant Name'],
          product: application['Loan Product'],
          requestedAmount: application['Requested Loan Amount'],
          approvedLoanAmount: application['Approved Loan Amount'],
          formData: application['Form Data'] 
            ? (typeof application['Form Data'] === 'string' 
                ? JSON.parse(application['Form Data']) 
                : application['Form Data'])
            : {},
          documents, // Parsed documents array
          aiFileSummary: application['AI File Summary'],
          status: application.Status,
          assignedNBFC: application['Assigned NBFC'],
          lenderDecisionStatus: application['Lender Decision Status'],
          lenderDecisionDate: application['Lender Decision Date'],
          lenderDecisionRemarks: application['Lender Decision Remarks'],
          creationDate: application['Creation Date'],
          submittedDate: application['Submitted Date'],
          lastUpdated: application['Last Updated'],
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
   * 
   * Enforces:
   * - Only applications assigned to logged-in NBFC can be updated
   * - Lender Decision Remarks is mandatory when decision is "Rejected"
   * - Updates Lender Decision Status, Lender Decision Date, and Lender Decision Remarks
   * 
   * Webhook Mapping:
   * - GET → n8nClient.fetchTable('Loan Application') → /webhook/loanapplication → Airtable: Loan Applications
   * - POST → n8nClient.postLoanApplication() → /webhook/loanapplications → Airtable: Loan Applications
   * - POST → n8nClient.postFileAuditLog() → /webhook/Fileauditinglog → Airtable: File Auditing Log
   * 
   * Frontend: src/pages/ApplicationDetail.tsx (NBFC view)
   * See WEBHOOK_MAPPING_TABLE.md for complete mapping
   */
  async recordDecision(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { 
        lenderDecisionStatus, 
        lenderDecisionRemarks,
        approvedAmount, // Optional: for approved decisions
      } = req.body;

      // Validate required fields
      if (!lenderDecisionStatus) {
        res.status(400).json({ 
          success: false, 
          error: 'Lender Decision Status is required' 
        });
        return;
      }

      // Validate decision status is one of the allowed values
      const validStatuses = [
        LenderDecisionStatus.APPROVED,
        LenderDecisionStatus.REJECTED,
        LenderDecisionStatus.NEEDS_CLARIFICATION,
      ];
      
      if (!validStatuses.includes(lenderDecisionStatus)) {
        res.status(400).json({ 
          success: false, 
          error: `Invalid decision status. Must be one of: ${validStatuses.join(', ')}` 
        });
        return;
      }

      // Enforce mandatory remarks on Reject
      if (lenderDecisionStatus === LenderDecisionStatus.REJECTED) {
        if (!lenderDecisionRemarks || lenderDecisionRemarks.trim() === '') {
          res.status(400).json({ 
            success: false, 
            error: 'Lender Decision Remarks is mandatory when decision is Rejected' 
          });
          return;
        }
      }

      // Fetch application
      const applications = await n8nClient.fetchTable('Loan Application');
      const application = applications.find((app) => app.id === id);

      if (!application) {
        res.status(404).json({ success: false, error: 'Application not found' });
        return;
      }

      // Check if assigned to this NBFC
      // Support both exact match and ID match (in case Assigned NBFC contains ID or name)
      const assignedNBFC = application['Assigned NBFC'];
      const isAssigned = assignedNBFC === req.user!.nbfcId || 
                        assignedNBFC?.includes(req.user!.nbfcId || '') ||
                        assignedNBFC === req.user!.name; // Fallback: match by name

      if (!isAssigned) {
        res.status(403).json({ 
          success: false, 
          error: 'Access denied. This application is not assigned to your NBFC.' 
        });
        return;
      }

      // Build update data with exact field names from SEVEN-DASHBOARD-2.json
      const updateData: any = {
        ...application,
        'Lender Decision Status': lenderDecisionStatus,
        'Lender Decision Date': new Date().toISOString().split('T')[0], // Format: YYYY-MM-DD
        'Last Updated': new Date().toISOString(),
      };

      // Set Lender Decision Remarks (required for Reject, optional for others)
      if (lenderDecisionRemarks && lenderDecisionRemarks.trim() !== '') {
        updateData['Lender Decision Remarks'] = lenderDecisionRemarks.trim();
      } else if (lenderDecisionStatus !== LenderDecisionStatus.REJECTED) {
        // Optional for non-reject decisions, but set empty string if not provided
        updateData['Lender Decision Remarks'] = '';
      }

      // For approved decisions, optionally update Approved Loan Amount
      if (lenderDecisionStatus === LenderDecisionStatus.APPROVED && approvedAmount) {
        updateData['Approved Loan Amount'] = approvedAmount.toString();
      }

      // Update application via loanapplications POST webhook
      await n8nClient.postLoanApplication(updateData);

      // Log decision in File Auditing Log
      const decisionMessage = lenderDecisionStatus === LenderDecisionStatus.APPROVED
        ? `NBFC decision: Approved${approvedAmount ? ` - Amount: ₹${approvedAmount.toLocaleString('en-IN')}` : ''}`
        : lenderDecisionStatus === LenderDecisionStatus.REJECTED
        ? `NBFC decision: Rejected - ${lenderDecisionRemarks?.substring(0, 100)}`
        : `NBFC decision: Needs Clarification - ${lenderDecisionRemarks?.substring(0, 100)}`;

      await n8nClient.postFileAuditLog({
        id: `AUDIT-${Date.now()}`,
        'Log Entry ID': `AUDIT-${Date.now()}`,
        File: application['File ID'],
        Timestamp: new Date().toISOString(),
        Actor: req.user!.email,
        'Action/Event Type': 'nbfc_decision',
        'Details/Message': decisionMessage,
        'Target User/Role': 'credit_team',
        Resolved: 'False',
      });

      res.json({
        success: true,
        message: 'Decision recorded successfully',
        data: {
          lenderDecisionStatus,
          lenderDecisionDate: updateData['Lender Decision Date'],
          lenderDecisionRemarks: updateData['Lender Decision Remarks'],
        },
      });
    } catch (error: any) {
      console.error('[NBFController] Error recording decision:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to record decision',
      });
    }
  }
}

/**
 * NBFC Partners Management Controller
 * Handles CRUD operations for NBFC Partners (Admin/Credit only)
 */
export class NBFCPartnersController {
  /**
   * GET /nbfc-partners
   * List all NBFC partners
   */
  async listPartners(req: Request, res: Response): Promise<void> {
    try {
      // Fetch only NBFC Partners table
      const partners = await n8nClient.fetchTable('NBFC Partners');

      res.json({
        success: true,
        data: partners.map((partner) => ({
          id: partner.id,
          lenderId: partner['Lender ID'],
          lenderName: partner['Lender Name'],
          contactPerson: partner['Contact Person'],
          contactEmailPhone: partner['Contact Email/Phone'],
          addressRegion: partner['Address/Region'],
          active: partner.Active === 'True' || partner.Active === true,
        })),
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch NBFC partners',
      });
    }
  }

  /**
   * POST /nbfc-partners
   * Create new NBFC partner (Admin/Credit only)
   */
  async createPartner(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || (req.user.role !== 'credit_team' && req.user.role !== 'admin')) {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      const { lenderName, contactPerson, contactEmailPhone, addressRegion, active } = req.body;

      if (!lenderName) {
        res.status(400).json({ success: false, error: 'Lender name is required' });
        return;
      }

      const partnerId = `NBFC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const partnerData = {
        id: partnerId,
        'Lender ID': partnerId,
        'Lender Name': lenderName,
        'Contact Person': contactPerson || '',
        'Contact Email/Phone': contactEmailPhone || '',
        'Address/Region': addressRegion || '',
        Active: active !== false ? 'True' : 'False',
      };

      await n8nClient.postNBFCPartner(partnerData);

      // Log admin activity
      await n8nClient.postAdminActivityLog({
        id: `ACT-${Date.now()}`,
        'Activity ID': `ACT-${Date.now()}`,
        Timestamp: new Date().toISOString(),
        'Performed By': req.user.email,
        'Action Type': 'create_nbfc_partner',
        'Description/Details': `Created NBFC partner: ${lenderName}`,
        'Target Entity': 'nbfc_partner',
      });

      res.json({
        success: true,
        data: partnerData,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create NBFC partner',
      });
    }
  }

  /**
   * PATCH /nbfc-partners/:id
   * Update NBFC partner (Admin/Credit only)
   */
  async updatePartner(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || (req.user.role !== 'credit_team' && req.user.role !== 'admin')) {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      const { id } = req.params;
      const { lenderName, contactPerson, contactEmailPhone, addressRegion, active } = req.body;

      // Fetch only NBFC Partners table
      const partners = await n8nClient.fetchTable('NBFC Partners');
      const partner = partners.find((p) => p.id === id);

      if (!partner) {
        res.status(404).json({ success: false, error: 'NBFC partner not found' });
        return;
      }

      // Update only provided fields
      const updateData: any = {
        ...partner,
      };

      if (lenderName !== undefined) updateData['Lender Name'] = lenderName;
      if (contactPerson !== undefined) updateData['Contact Person'] = contactPerson;
      if (contactEmailPhone !== undefined) updateData['Contact Email/Phone'] = contactEmailPhone;
      if (addressRegion !== undefined) updateData['Address/Region'] = addressRegion;
      if (active !== undefined) updateData.Active = active ? 'True' : 'False';

      await n8nClient.postNBFCPartner(updateData);

      // Log admin activity
      await n8nClient.postAdminActivityLog({
        id: `ACT-${Date.now()}`,
        'Activity ID': `ACT-${Date.now()}`,
        Timestamp: new Date().toISOString(),
        'Performed By': req.user.email,
        'Action Type': 'update_nbfc_partner',
        'Description/Details': `Updated NBFC partner: ${updateData['Lender Name']}`,
        'Target Entity': 'nbfc_partner',
      });

      res.json({
        success: true,
        message: 'NBFC partner updated successfully',
        data: updateData,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update NBFC partner',
      });
    }
  }
}

export const nbfcController = new NBFController();
export const nbfcPartnersController = new NBFCPartnersController();

