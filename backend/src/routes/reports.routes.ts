/**
 * Reports Routes
 */

import { Router } from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import { reportsController } from '../controllers/reports.controller.js';
import { requireCredit, requireCreditOrKAM } from '../middleware/rbac.middleware.js';

const router = Router();

router.use(authenticate);

// Generate - CREDIT only
router.post('/daily/generate', requireCredit, reportsController.generateDailySummary.bind(reportsController));

// Get - CREDIT or KAM
router.get('/daily/list', requireCreditOrKAM, reportsController.listDailySummaries.bind(reportsController));
router.get('/daily/latest', requireCreditOrKAM, reportsController.getLatestDailySummary.bind(reportsController));
router.get('/daily/:date', requireCreditOrKAM, reportsController.getDailySummary.bind(reportsController));

export default router;

