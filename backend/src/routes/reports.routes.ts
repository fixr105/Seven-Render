/**
 * Reports Routes
 */

import { Router } from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import { reportsController } from '../controllers/reports.controller.js';
import { requireCredit, requireCreditOrKAMOrAdmin } from '../middleware/rbac.middleware.js';

const router = Router();

router.use(authenticate);

// Generate - CREDIT only
router.post('/daily/generate', requireCredit, reportsController.generateDailySummary.bind(reportsController));

// Get - CREDIT, KAM, or ADMIN (all 3 report personas)
router.get('/daily/list', requireCreditOrKAMOrAdmin, reportsController.listDailySummaries.bind(reportsController));
router.get('/daily/latest', requireCreditOrKAMOrAdmin, reportsController.getLatestDailySummary.bind(reportsController));
// Ledger, Client-wise, Date-range (specific paths before :date)
router.get('/ledger', requireCreditOrKAMOrAdmin, reportsController.getLedgerReport.bind(reportsController));
router.get('/client-wise', requireCreditOrKAMOrAdmin, reportsController.getClientWiseReport.bind(reportsController));
router.get('/date-range', requireCreditOrKAMOrAdmin, reportsController.getDateRangeReport.bind(reportsController));
router.get('/daily/:date', requireCreditOrKAMOrAdmin, reportsController.getDailySummary.bind(reportsController));

export default router;

