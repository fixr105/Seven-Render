/**
 * Config Routes
 * Exposes cached, n8n-synced configuration to the frontend.
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import { requireCreditOrAdmin } from '../middleware/rbac.middleware.js';
import { CibilRateMatrixService } from '../services/config/cibilRateMatrix.service.js';
import { CibilChancesService } from '../services/config/cibilChances.service.js';
import type { ApplicantParameters } from '../services/config/lenderBreCheckpoints.logic.js';
import { defaultLogger } from '../utils/logger.js';

const router = Router();

router.use(authenticate);

router.get('/cibil-rate-matrix', async (_req: Request, res: Response) => {
  try {
    const data = await CibilRateMatrixService.getMatrix();
    res.json({ success: true, data });
  } catch (error) {
    defaultLogger.error('Failed to load CIBIL rate matrix', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ success: false, error: 'Failed to load CIBIL rate matrix' });
  }
});

const STAFF_ROLES = new Set(['kam', 'credit_team', 'admin']);

router.get('/cibil-chances', async (req: Request, res: Response) => {
  try {
    const raw = req.query.cibil;
    const cibil = typeof raw === 'string' ? Number.parseInt(raw, 10) : Number.NaN;
    if (!Number.isFinite(cibil) || cibil < 300 || cibil > 900) {
      res.status(400).json({
        success: false,
        error: 'Query param cibil must be an integer between 300 and 900',
      });
      return;
    }

    const rawProduct = req.query.loanProduct;
    const loanProduct = (Array.isArray(rawProduct) ? rawProduct[0] : rawProduct) ?? '';
    if (typeof loanProduct !== 'string' || loanProduct.trim() === '') {
      res.status(400).json({ success: false, error: 'Query param loanProduct is required' });
      return;
    }

    const chances = await CibilChancesService.calculateChances(cibil, loanProduct.trim());
    const role = req.user?.role ?? '';
    if (!STAFF_ROLES.has(role)) {
      res.json({ success: true, data: { score: chances.score, label: chances.label } });
      return;
    }

    const recommendation = await CibilChancesService.getRecommendedLender(
      cibil,
      loanProduct.trim(),
      readApplicant(req.query)
    );
    res.json({
      success: true,
      data: {
        score: chances.score,
        label: chances.label,
        recommendedLender: recommendation.recommendedLender,
        recommendedLenderROI: recommendation.recommendedLenderROI,
      },
    });
  } catch (error) {
    defaultLogger.error('Failed to calculate CIBIL chances', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ success: false, error: 'Failed to calculate CIBIL chances' });
  }
});

const NUMERIC_APPLICANT_FIELDS = [
  'cibil_score',
  'emi_overdue',
  'cc_overdue',
  'enquiries_30d',
  'loan_amount',
] as const;

const BOOLEAN_APPLICANT_FIELDS = [
  'dpd_3m',
  'dpd_6m',
  'overdue_12m',
  'dpd_60plus_24m',
  'dpd_90plus_36m',
  'written_off_3y',
  'ntc_bank_statement',
  'bureau_report_present',
] as const;

function queryFlag(value: unknown): boolean {
  const raw = Array.isArray(value) ? value[0] : value;
  const text = String(raw ?? '').trim().toLowerCase();
  return text === 'true' || text === '1' || text === 'yes';
}

function readApplicant(query: Request['query']): ApplicantParameters {
  const applicant: ApplicantParameters = {};
  for (const field of NUMERIC_APPLICANT_FIELDS) {
    const raw = query[field];
    const text = Array.isArray(raw) ? raw[0] : raw;
    if (typeof text !== 'string' || text.trim() === '') continue;
    const n = Number(text);
    if (Number.isFinite(n)) applicant[field] = n;
  }
  for (const field of BOOLEAN_APPLICANT_FIELDS) {
    const raw = query[field];
    const text = Array.isArray(raw) ? raw[0] : raw;
    if (text == null || String(text).trim() === '') continue;
    applicant[field] = queryFlag(text);
  }
  return applicant;
}

router.get('/lender-bre-checkpoints', requireCreditOrAdmin, async (req: Request, res: Response) => {
  try {
    const rawUserId = req.query.userId;
    const userId = (Array.isArray(rawUserId) ? rawUserId[0] : rawUserId) ?? '';
    if (typeof userId !== 'string' || userId.trim() === '') {
      res.status(400).json({ success: false, error: 'Query param userId is required' });
      return;
    }

    const data = await CibilChancesService.evaluateLenderCheckpoints(
      userId,
      readApplicant(req.query),
      { bureauReportMissing: queryFlag(req.query.bureauReportMissing) }
    );
    res.json({ success: true, data });
  } catch (error) {
    defaultLogger.error('Failed to evaluate lender BRE checkpoints', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ success: false, error: 'Failed to evaluate lender BRE checkpoints' });
  }
});

export default router;
