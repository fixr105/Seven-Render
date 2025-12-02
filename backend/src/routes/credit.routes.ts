/**
 * Credit Team Routes
 */

import { Router } from 'express';
import { creditController } from '../controllers/credit.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireCredit } from '../middleware/rbac.middleware.js';

const router = Router();

router.use(authenticate);
router.use(requireCredit);

router.get('/dashboard', creditController.getDashboard.bind(creditController));
router.get('/loan-applications', creditController.listApplications.bind(creditController));
router.get('/loan-applications/:id', creditController.getApplication.bind(creditController));
router.post('/loan-applications/:id/queries', creditController.raiseQuery.bind(creditController));
router.post('/loan-applications/:id/mark-in-negotiation', creditController.markInNegotiation.bind(creditController));
router.post('/loan-applications/:id/assign-nbfcs', creditController.assignNBFCs.bind(creditController));
router.post('/loan-applications/:id/nbfc-decision', creditController.captureNBFCDecision.bind(creditController));
router.post('/loan-applications/:id/mark-disbursed', creditController.markDisbursed.bind(creditController));
router.get('/payout-requests', creditController.getPayoutRequests.bind(creditController));
router.post('/payout-requests/:id/approve', creditController.approvePayout.bind(creditController));
router.post('/payout-requests/:id/reject', creditController.rejectPayout.bind(creditController));

export default router;

