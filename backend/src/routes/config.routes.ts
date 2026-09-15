/**
 * Config Routes
 * Exposes cached, n8n-synced configuration to the frontend.
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import { CibilRateMatrixService } from '../services/config/cibilRateMatrix.service.js';
import { CibilChancesService } from '../services/config/cibilChances.service.js';
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

    const role = req.user?.role ?? '';
    if (STAFF_ROLES.has(role)) {
      const data = await CibilChancesService.calculateChancesForStaff(cibil);
      res.json({ success: true, data });
      return;
    }

    const data = await CibilChancesService.calculateChances(cibil);
    res.json({ success: true, data });
  } catch (error) {
    defaultLogger.error('Failed to calculate CIBIL chances', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ success: false, error: 'Failed to calculate CIBIL chances' });
  }
});

export default router;
