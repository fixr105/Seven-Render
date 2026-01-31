/**
 * AI Routes
 * Available to all authenticated roles; access to a specific application's summary
 * is enforced by rbacFilterService in the controller (Client, KAM, Credit, NBFC).
 */

import { Router } from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import { aiController } from '../controllers/ai.controller.js';

const router = Router();

router.use(authenticate);

router.post('/loan-applications/:id/generate-summary', aiController.generateSummary.bind(aiController));
router.get('/loan-applications/:id/summary', aiController.getSummary.bind(aiController));

export default router;

