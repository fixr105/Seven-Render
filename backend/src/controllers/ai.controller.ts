/**
 * AI File Summary Controller
 * 
 * Generates AI-powered summaries for loan applications using:
 * - OpenAI API (if OPENAI_API_KEY is set)
 * - n8n AI node webhook (if N8N_AI_WEBHOOK_URL is set)
 * - Structured fallback summary (if neither is available)
 * 
 * Webhook Mapping:
 * - GET → n8nClient.fetchTable('Loan Application') → /webhook/loanapplication → Airtable: Loan Applications
 * - GET → n8nClient.fetchTable('Clients') → /webhook/client → Airtable: Clients
 * - POST → n8nClient.postLoanApplication() → /webhook/loanapplications → Airtable: Loan Applications
 */

import { Request, Response } from 'express';
import { n8nClient } from '../services/airtable/n8nClient.js';
import { dataFilterService } from '../services/airtable/dataFilter.service.js';
import { aiSummaryService } from '../services/ai/aiSummary.service.js';

export class AIController {
  /**
   * POST /loan-applications/:id/generate-summary
   * Generate AI summary for a loan application
   * 
   * Fetches application data, documents, and client info, then generates
   * a comprehensive AI summary with applicant profile, loan details, strengths, and risks.
   * Writes the summary back to the AI File Summary field.
   */
  async generateSummary(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      // Fetch application and related data
      const [applications, clients] = await Promise.all([
        n8nClient.fetchTable('Loan Application'),
        n8nClient.fetchTable('Clients'),
      ]);

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

      // Parse form data
      const formData = application['Form Data'] 
        ? (typeof application['Form Data'] === 'string' 
            ? JSON.parse(application['Form Data']) 
            : application['Form Data'])
        : {};

      // Parse documents from Documents field (format: fieldId:url|fileName,fieldId:url|fileName)
      const documents: Array<{ fieldId: string; url: string; fileName: string }> = [];
      if (application.Documents) {
        const documentEntries = application.Documents.split(',').filter(Boolean);
        documentEntries.forEach((entry: string) => {
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

      // Get client information
      const client = clients.find((c: any) => 
        c.id === application.Client || c['Client ID'] === application.Client
      );

      // Prepare AI summary request
      const summaryRequest = {
        fileId: application['File ID'] || id,
        applicantName: application['Applicant Name'] || 'N/A',
        loanProduct: application['Loan Product'] || 'N/A',
        requestedAmount: parseFloat(application['Requested Loan Amount'] || '0'),
        status: application.Status || 'draft',
        formData,
        documents,
        clientInfo: client ? {
          clientName: client['Client Name'] || client['Primary Contact Name'] || 'N/A',
          commissionRate: client['Commission Rate'] || '',
        } : undefined,
      };

      // Generate AI summary
      const summaryResult = await aiSummaryService.generateSummary(summaryRequest);

      // Update application with AI File Summary
      await n8nClient.postLoanApplication({
        ...application,
        'AI File Summary': summaryResult.fullSummary,
        'Last Updated': new Date().toISOString(),
      });

      res.json({
        success: true,
        data: {
          summary: summaryResult.fullSummary,
          structured: {
            applicantProfile: summaryResult.applicantProfile,
            loanDetails: summaryResult.loanDetails,
            strengths: summaryResult.strengths,
            risks: summaryResult.risks,
            recommendation: summaryResult.recommendation,
          },
          generatedAt: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      console.error('[AIController] Error generating summary:', error);
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
      // Fetch only Loan Application table
      const applications = await n8nClient.fetchTable('Loan Application');
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

