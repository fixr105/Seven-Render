/**
 * AI Routes
 */

import { Router } from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import { aiController } from '../controllers/ai.controller.js';
import { requireCreditOrKAM } from '../middleware/rbac.middleware.js';

const router = Router();

router.use(authenticate);
router.use(requireCreditOrKAM);

router.post('/loan-applications/:id/generate-summary', aiController.generateSummary.bind(aiController));
router.get('/loan-applications/:id/summary', aiController.getSummary.bind(aiController));

export default router;

