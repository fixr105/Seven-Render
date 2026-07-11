/**
 * Config Routes
 * Exposes cached, n8n-synced configuration to the frontend.
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import { CibilRateMatrixService } from '../services/config/cibilRateMatrix.service.js';
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

export default router;
