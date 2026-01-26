/**
 * AI File Summary Controller
 *
 * Generates AI-powered summaries for loan applications. Default for credit team:
 * - big-brain-bro (N8N_BIG_BRAIN_BRO_URL): POSTs same JSON as /webhook/loanapplications
 * - n8n AI (N8N_AI_WEBHOOK_URL), OpenAI (OPENAI_API_KEY), or structured fallback
 *
 * Webhook Mapping:
 * - GET → n8nClient.fetchTable('Loan Application') → /webhook/loanapplication → Airtable: Loan Applications
 * - GET → n8nClient.fetchTable('Clients') → /webhook/client → Airtable: Clients
 * - POST → N8N_BIG_BRAIN_BRO_URL (AI) then n8nClient.postLoanApplication() → /webhook/loanapplications → Airtable: Loan Applications
 */

import { Request, Response } from 'express';
import { n8nClient } from '../services/airtable/n8nClient.js';
import { rbacFilterService } from '../services/rbac/rbacFilter.service.js';
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
      
      // Step 1: Fetch applications first and find the specific one
      const applications = await n8nClient.fetchTable('Loan Application');
      const application = applications.find((app) => app.id === id);

      if (!application) {
        res.status(404).json({ success: false, error: 'Application not found' });
        return;
      }

      // Step 2: Check access BEFORE fetching clients
      const filtered = await rbacFilterService.filterLoanApplications([application as any], req.user!);
      if (filtered.length === 0) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }

      // Step 3: Only fetch clients if we have access and need them for the summary
      const clients = await n8nClient.fetchTable('Clients');

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

      // Generate AI summary (pass application for big-brain-bro: same POST body as /webhook/loanapplications)
      console.log('[AIController] Generating summary for application:', id, 'File ID:', application['File ID']);
      const summaryResult = await aiSummaryService.generateSummary(summaryRequest, application);
      console.log('[AIController] Summary generated, length:', summaryResult.fullSummary.length);

      // Update application with AI File Summary
      console.log('[AIController] Updating application with AI File Summary');
      await n8nClient.postLoanApplication({
        ...application,
        'AI File Summary': summaryResult.fullSummary,
        'Last Updated': new Date().toISOString(),
      });
      console.log('[AIController] Application updated successfully');

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
      console.error('[AIController] Error stack:', error.stack);
      
      // Provide more specific error messages
      let statusCode = 500;
      let errorMessage = error.message || 'Failed to generate summary';
      
      if (error.message?.includes('not found')) {
        statusCode = 404;
      } else if (error.message?.includes('Access denied') || error.message?.includes('permission')) {
        statusCode = 403;
      } else if (error.message?.includes('timeout') || error.message?.includes('ETIMEDOUT')) {
        statusCode = 504;
        errorMessage = 'Request timeout. The AI service may be slow. Please try again.';
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        statusCode = 503;
        errorMessage = 'Network error. Please check your connection and try again.';
      }
      
      res.status(statusCode).json({
        success: false,
        error: errorMessage,
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
      const filtered = await rbacFilterService.filterLoanApplications([application as any], req.user!);
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

