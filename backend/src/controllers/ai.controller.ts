/**
 * AI File Summary Controller
 */

import { Request, Response } from 'express';
import { n8nClient } from '../services/airtable/n8nClient.js';
import { dataFilterService } from '../services/airtable/dataFilter.service.js';

export class AIController {
  /**
   * POST /loan-applications/:id/generate-summary
   * Generate AI summary for a loan application (stub implementation)
   */
  async generateSummary(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const allData = await n8nClient.getAllData();
      const applications = allData['Loan Applications'] || [];
      const application = applications.find((app) => app.id === id);

      if (!application) {
        res.status(404).json({ success: false, error: 'Application not found' });
        return;
      }

      // Check access
      const filtered = dataFilterService.filterLoanApplications([application], req.user!);
      if (filtered.length === 0) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }

      // TODO: Call actual AI service here
      // For now, generate a basic summary from form data
      const formData = application['Form Data'] ? JSON.parse(application['Form Data']) : {};
      const summary = `
Application Summary for ${application['File ID']}:
- Applicant: ${application['Applicant Name'] || 'N/A'}
- Loan Product: ${application['Loan Product'] || 'N/A'}
- Requested Amount: ₹${application['Requested Loan Amount'] || '0'}
- Status: ${application.Status}
- Key Information: ${JSON.stringify(formData, null, 2)}
      `.trim();

      // Update application with summary
      await n8nClient.postLoanApplication({
        ...application,
        'AI File Summary': summary,
        'Last Updated': new Date().toISOString(),
      });

      res.json({
        success: true,
        data: {
          summary,
          generatedAt: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate summary',
      });
    }
  }

  /**
   * GET /loan-applications/:id/summary
   * Get cached AI summary for a loan application
   */
  async getSummary(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const allData = await n8nClient.getAllData();
      const applications = allData['Loan Applications'] || [];
      const application = applications.find((app) => app.id === id);

      if (!application) {
        res.status(404).json({ success: false, error: 'Application not found' });
        return;
      }

      // Check access
      const filtered = dataFilterService.filterLoanApplications([application], req.user!);
      if (filtered.length === 0) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }

      if (!application['AI File Summary']) {
        res.status(404).json({
          success: false,
          error: 'Summary not generated yet. Use POST /loan-applications/:id/generate-summary',
        });
        return;
      }

      res.json({
        success: true,
        data: {
          summary: application['AI File Summary'],
          fileId: application['File ID'],
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch summary',
      });
    }
  }
}

export const aiController = new AIController();

