/**
 * NBFC AI Tools Controller
 * Handles RAAD, PAGER, Query Drafter with Prisma, n8n webhooks, pdfkit, and Vercel Blob.
 */

import { Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import { n8nClient } from '../services/airtable/n8nClient.js';
import { matchIds } from '../utils/idMatcher.js';
import { getPrisma } from '../lib/prisma.js';
import { nbfcToolsStorage } from '../services/nbfcToolsStorage.service.js';
import { generateRaadPdf, type RaadResult } from '../services/raadPdfGenerator.service.js';

const N8N_NBFC_TOOLS_BASE_URL = 'https://n8n-h9n3.srv1314414.hstgr.cloud';

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function getN8nWebhookUrl(tool: 'raad' | 'pager'): string {
  const base = process.env.N8N_NBFC_TOOLS_BASE_URL || N8N_NBFC_TOOLS_BASE_URL;
  const baseClean = base.replace(/\/$/, '');
  if (tool === 'raad') {
    return process.env.N8N_RAAD_WEBHOOK_URL || `${baseClean}/webhook/upload-bankstatement-1`;
  }
  if (process.env.N8N_PAGER_WEBHOOK_URL) {
    return process.env.N8N_PAGER_WEBHOOK_URL;
  }
  return `${baseClean}/webhook/upload-pager`;
}

export class NBFCToolsController {
  /**
   * POST /nbfc/tools/raad
   * Accepts multipart: bankFile (required), gstFile (optional), loanApplicationId (optional)
   */
  async startRaad(req: Request, res: Response): Promise<void> {
    try {
      const { defaultLogger } = await import('../utils/logger.js');
      defaultLogger.info('RAAD submit received', { userId: req.user?.id, role: req.user?.role });
      const prisma = getPrisma();
      if (!prisma) {
        res.status(503).json({
          success: false,
          error: 'Database is not configured. Set DATABASE_URL in your environment.',
        });
        return;
      }

      const userId = req.user?.id;
      if (!userId || req.user?.role !== 'nbfc') {
        res.status(403).json({ success: false, error: 'NBFC role required' });
        return;
      }

      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const bankFile = files?.bankFile?.[0];
      if (!bankFile) {
        res.status(400).json({ success: false, error: 'bankFile is required' });
        return;
      }

      const loanApplicationId = (req.body?.loanApplicationId as string)?.trim() || null;
      const gstFile = files?.gstFile?.[0];

      const expiresAt = addDays(new Date(), 30);
      const job = await prisma.toolJob.create({
        data: {
          nbfcUserId: userId,
          tool: 'raad',
          status: 'processing',
          stage: 'uploading',
          loanApplicationId,
          expiresAt,
        },
      });

      res.status(202).json({ success: true, data: { jobId: job.id } });

      const runRaadWebhook = async () => {
        const { defaultLogger } = await import('../utils/logger.js');
        const webhookUrl = getN8nWebhookUrl('raad');
        defaultLogger.info('RAAD webhook starting', {
          jobId: job.id,
          webhookHost: new URL(webhookUrl).hostname,
          hasGstFile: !!gstFile,
        });

        try {
          const formData = new FormData();
          formData.append('bankFile', new Blob([bankFile.buffer], { type: bankFile.mimetype || 'application/pdf' }), bankFile.originalname || 'bank.pdf');
          if (gstFile) {
            formData.append('gstFile', new Blob([gstFile.buffer], { type: gstFile.mimetype || 'application/pdf' }), gstFile.originalname || 'gst.pdf');
          }
          if (loanApplicationId) {
            formData.append('loanApplicationId', loanApplicationId);
          }

          const n8nController = new AbortController();
          const n8nTimeoutId = setTimeout(() => n8nController.abort(), 120_000);
          let n8nRes: Response;
          try {
            n8nRes = await fetch(webhookUrl, {
              method: 'POST',
              body: formData,
              signal: n8nController.signal,
            });
          } finally {
            clearTimeout(n8nTimeoutId);
          }

          defaultLogger.info('RAAD webhook response', {
            jobId: job.id,
            status: n8nRes.status,
            ok: n8nRes.ok,
          });

          if (!n8nRes.ok) {
            const errText = await n8nRes.text();
            throw new Error(`n8n RAAD webhook failed: ${n8nRes.status} ${errText}`);
          }

          const n8nData = (await n8nRes!.json()) as Record<string, unknown>;
          const raadResult: RaadResult = {
            customer_name: String(n8nData.customer_name ?? n8nData.customerName ?? ''),
            total_revenue: typeof n8nData.total_revenue === 'number' ? n8nData.total_revenue : undefined,
            revenue_growth: typeof n8nData.revenue_growth === 'number' ? n8nData.revenue_growth : undefined,
            itc_available: typeof n8nData.itc_available === 'number' ? n8nData.itc_available : undefined,
            flagged_count: typeof n8nData.flagged_count === 'number' ? n8nData.flagged_count : undefined,
            compliance_status: typeof n8nData.compliance_status === 'string' ? n8nData.compliance_status : undefined,
            cash_flow_risk: typeof n8nData.cash_flow_risk === 'string' ? n8nData.cash_flow_risk : undefined,
            final_credit_limit: typeof n8nData.final_credit_limit === 'number' ? n8nData.final_credit_limit : undefined,
            parameters_used: typeof n8nData.parameters_used === 'object' ? (n8nData.parameters_used as Record<string, unknown>) : undefined,
          };
          const pdfBuffer = await generateRaadPdf(raadResult);
          const filename = `raad-${job.id}.pdf`;
          const reportUrl = await nbfcToolsStorage.uploadReport(pdfBuffer, filename);

          await prisma.toolJob.update({
            where: { id: job.id },
            data: { status: 'ready', reportUrl, completedAt: new Date(), stage: 'done' },
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          defaultLogger.error('RAAD webhook failed', { jobId: job.id, error: message });
          await prisma.toolJob.update({
            where: { id: job.id },
            data: { status: 'failed', errorMessage: message },
          });
        }
      };

      setImmediate(() => void runRaadWebhook());
    } catch (error: unknown) {
      const err = error as Error;
      res.status(500).json({ success: false, error: err.message || 'Failed to start RAAD job' });
    }
  }

  /**
   * POST /nbfc/tools/pager
   * Accepts multipart: borrowerFile (required), letterheadFile (optional), loanApplicationId (optional)
   */
  async startPager(req: Request, res: Response): Promise<void> {
    try {
      const prisma = getPrisma();
      if (!prisma) {
        res.status(503).json({
          success: false,
          error: 'Database is not configured. Set DATABASE_URL in your environment.',
        });
        return;
      }

      const userId = req.user?.id;
      if (!userId || req.user?.role !== 'nbfc') {
        res.status(403).json({ success: false, error: 'NBFC role required' });
        return;
      }

      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const borrowerFile = files?.borrowerFile?.[0];
      if (!borrowerFile) {
        res.status(400).json({ success: false, error: 'borrowerFile is required' });
        return;
      }

      const loanApplicationId = (req.body?.loanApplicationId as string)?.trim() || null;
      const letterheadFile = files?.letterheadFile?.[0];

      const expiresAt = addDays(new Date(), 30);
      const job = await prisma.toolJob.create({
        data: {
          nbfcUserId: userId,
          tool: 'pager',
          status: 'processing',
          stage: 'uploading',
          loanApplicationId,
          expiresAt,
        },
      });

      res.status(202).json({ success: true, data: { jobId: job.id } });

      const runPagerWebhook = async () => {
        const { defaultLogger } = await import('../utils/logger.js');
        const webhookUrl = getN8nWebhookUrl('pager');
        defaultLogger.info('PAGER webhook starting', {
          jobId: job.id,
          webhookHost: new URL(webhookUrl).hostname,
          hasLetterhead: !!letterheadFile,
        });

        try {
          const formData = new FormData();
          formData.append('borrowerFile', new Blob([borrowerFile.buffer], { type: borrowerFile.mimetype || 'application/pdf' }), borrowerFile.originalname || 'borrower.pdf');
          if (letterheadFile) {
            formData.append('letterheadFile', new Blob([letterheadFile.buffer], { type: letterheadFile.mimetype || 'application/pdf' }), letterheadFile.originalname || 'letterhead.pdf');
          }
          if (loanApplicationId) {
            formData.append('loanApplicationId', loanApplicationId);
          }

          const n8nController = new AbortController();
          const n8nTimeoutId = setTimeout(() => n8nController.abort(), 120_000);
          let n8nRes: Response;
          try {
            n8nRes = await fetch(webhookUrl, {
              method: 'POST',
              body: formData,
              signal: n8nController.signal,
            });
          } finally {
            clearTimeout(n8nTimeoutId);
          }

          defaultLogger.info('PAGER webhook response', {
            jobId: job.id,
            status: n8nRes.status,
            ok: n8nRes.ok,
          });

          if (!n8nRes.ok) {
            const errText = await n8nRes.text();
            throw new Error(`n8n PAGER webhook failed: ${n8nRes.status} ${errText}`);
          }

          const n8nData = (await n8nRes.json()) as Record<string, unknown>;
          const pdfBuffer = await this.buildPagerPdf(n8nData);
          const filename = `pager-${job.id}.pdf`;
          const reportUrl = await nbfcToolsStorage.uploadReport(pdfBuffer, filename);

          await prisma.toolJob.update({
            where: { id: job.id },
            data: { status: 'ready', reportUrl, completedAt: new Date(), stage: 'done' },
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          defaultLogger.error('PAGER webhook failed', { jobId: job.id, error: message });
          await prisma.toolJob.update({
            where: { id: job.id },
            data: { status: 'failed', errorMessage: message },
          });
        }
      };

      setImmediate(() => void runPagerWebhook());
    } catch (error: unknown) {
      const err = error as Error;
      res.status(500).json({ success: false, error: err.message || 'Failed to start PAGER job' });
    }
  }

  /**
   * POST /nbfc/tools/query-drafter
   * Accepts JSON: documentText?, roughQuery, tone, loanApplicationId? + optional loanDocument file
   */
  async draftQuery(req: Request, res: Response): Promise<void> {
    try {
      const prisma = getPrisma();
      if (!prisma) {
        res.status(503).json({
          success: false,
          error: 'Database is not configured. Set DATABASE_URL in your environment.',
        });
        return;
      }

      const userId = req.user?.id;
      if (!userId || req.user?.role !== 'nbfc') {
        res.status(403).json({ success: false, error: 'NBFC role required' });
        return;
      }

      const roughQuery = (req.body?.roughQuery as string)?.trim();
      if (!roughQuery) {
        res.status(400).json({ success: false, error: 'roughQuery is required' });
        return;
      }

      const tone = ((req.body?.tone as string) || 'formal').toLowerCase();
      if (!['formal', 'urgent', 'polite'].includes(tone)) {
        res.status(400).json({ success: false, error: 'tone must be formal, urgent, or polite' });
        return;
      }

      const documentText = (req.body?.documentText as string)?.trim() || '';
      const loanApplicationId = (req.body?.loanApplicationId as string)?.trim() || null;

      const openaiKey = process.env.OPENAI_API_KEY;
      if (!openaiKey) {
        res.status(503).json({
          success: false,
          error: 'OPENAI_API_KEY is not configured for Query Drafter',
        });
        return;
      }

      const prompt = `You are a credit analyst at an NBFC. Draft a professional query to send to a loan originator (KAM) or client. Tone: ${tone}. Context from document: ${documentText || 'None provided'}. The analyst's rough note is: ${roughQuery}. Write a clear, specific, professional query. Return only the query text, no preamble.`;

      const chatRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.5,
        }),
      });

      if (!chatRes.ok) {
        const errText = await chatRes.text();
        throw new Error(`OpenAI API error: ${chatRes.status} ${errText}`);
      }

      const chatData = (await chatRes.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const draftedQuery = chatData.choices?.[0]?.message?.content?.trim() || roughQuery;

      const expiresAt = addDays(new Date(), 30);
      await prisma.toolJob.create({
        data: {
          nbfcUserId: userId,
          tool: 'query',
          status: 'ready',
          draftedQuery,
          loanApplicationId,
          expiresAt,
          completedAt: new Date(),
        },
      });

      res.json({ success: true, data: { draftedQuery } });
    } catch (error: unknown) {
      const err = error as Error;
      res.status(500).json({ success: false, error: err.message || 'Failed to draft query' });
    }
  }

  /**
   * GET /nbfc/tools/jobs/:jobId/status
   */
  async getJobStatus(req: Request, res: Response): Promise<void> {
    try {
      const prisma = getPrisma();
      if (!prisma) {
        res.status(503).json({
          success: false,
          error: 'Database is not configured.',
        });
        return;
      }

      const userId = req.user?.id;
      if (!userId) {
        res.status(403).json({ success: false, error: 'Authentication required' });
        return;
      }

      const { jobId } = req.params;
      const job = await prisma.toolJob.findFirst({
        where: { id: jobId, nbfcUserId: userId },
      });

      if (!job) {
        res.status(404).json({ success: false, error: 'Job not found' });
        return;
      }

      res.json({
        success: true,
        data: {
          jobId: job.id,
          status: job.status,
          stage: job.stage ?? undefined,
          reportUrl: job.reportUrl ?? undefined,
          tool: job.tool,
          createdAt: job.createdAt.toISOString(),
        },
      });
    } catch (error: unknown) {
      const err = error as Error;
      res.status(500).json({ success: false, error: err.message || 'Failed to get job status' });
    }
  }

  /**
   * GET /nbfc/tools/history
   */
  async getHistory(req: Request, res: Response): Promise<void> {
    try {
      const prisma = getPrisma();
      if (!prisma) {
        res.status(503).json({
          success: false,
          error: 'Database is not configured.',
        });
        return;
      }

      const userId = req.user?.id;
      if (!userId) {
        res.status(403).json({ success: false, error: 'Authentication required' });
        return;
      }

      const jobs = await prisma.toolJob.findMany({
        where: { nbfcUserId: userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      res.json({
        success: true,
        data: {
          jobs: jobs.map((j) => ({
            jobId: j.id,
            tool: j.tool,
            status: j.status,
            reportUrl: j.reportUrl ?? undefined,
            loanApplicationId: j.loanApplicationId ?? undefined,
            createdAt: j.createdAt.toISOString(),
          })),
        },
      });
    } catch (error: unknown) {
      const err = error as Error;
      res.status(500).json({ success: false, error: err.message || 'Failed to fetch history' });
    }
  }

  /**
   * GET /nbfc/tools/jobs/:jobId/report
   */
  async getReport(req: Request, res: Response): Promise<void> {
    try {
      const prisma = getPrisma();
      if (!prisma) {
        res.status(503).json({ success: false, error: 'Database is not configured.' });
        return;
      }

      const userId = req.user?.id;
      if (!userId) {
        res.status(403).json({ success: false, error: 'Authentication required' });
        return;
      }

      const { jobId } = req.params;
      const job = await prisma.toolJob.findFirst({
        where: { id: jobId, nbfcUserId: userId },
      });

      if (!job) {
        res.status(404).json({ success: false, error: 'Report not found' });
        return;
      }

      if (job.status !== 'ready' || !job.reportUrl) {
        res.status(202).json({ success: false, error: 'Report not ready yet' });
        return;
      }

      res.redirect(302, job.reportUrl);
    } catch (error: unknown) {
      const err = error as Error;
      res.status(500).json({ success: false, error: err.message || 'Failed to get report' });
    }
  }

  /**
   * POST /nbfc/loan-applications/:id/queries
   * NBFC raises query (kept in nbfc.routes)
   */
  async raiseQuery(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const message = req.body.message ?? req.body.query ?? '';
      if (!message || !String(message).trim()) {
        res.status(400).json({ success: false, error: 'Message is required' });
        return;
      }

      const applications = await n8nClient.fetchTable('Loan Application');
      const application = applications.find(
        (app: { id?: string; 'File ID'?: string }) =>
          matchIds(app.id, id) || matchIds(app['File ID'], id)
      );

      if (!application) {
        res.status(404).json({ success: false, error: 'Application not found' });
        return;
      }

      const assignedNbfc = (application as { 'Assigned NBFC'?: string; Assigned_NBFC?: string })['Assigned NBFC'] ?? (application as { Assigned_NBFC?: string }).Assigned_NBFC;
      const nbfcId = req.user?.nbfcId;
      if (!nbfcId || !matchIds(assignedNbfc, nbfcId)) {
        res.status(403).json({ success: false, error: 'Access denied. This application is not assigned to you.' });
        return;
      }

      const { queryService } = await import('../services/queries/query.service.js');
      await queryService.createQuery(
        application['File ID'] as string,
        application.Client as string,
        req.user!.email,
        'nbfc',
        String(message).trim(),
        'credit_team',
        'query_raised'
      );

      res.json({ success: true, message: 'Query raised successfully' });
    } catch (error: unknown) {
      const err = error as Error;
      res.status(500).json({ success: false, error: err.message || 'Failed to raise query' });
    }
  }

  private buildPagerPdf(data: Record<string, unknown>): Promise<Buffer> {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    const result = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    doc.fontSize(18).text('Lender One-Pager', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12);

    const entries = Object.entries(data).filter(([, v]) => v != null && v !== '');
    for (const [key, value] of entries) {
      doc.text(`${String(key)}: ${String(value)}`);
      doc.moveDown(0.5);
    }

    doc.end();
    return result;
  }
}

export const nbfcToolsController = new NBFCToolsController();
